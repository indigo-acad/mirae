-- MIRAÉ: преподаватели школы.
-- Владелец школы (тот, кто был преподавателем до этого шага) добавляет преподавателей в панели «Ученики»
-- и подтверждает заявки. Каждый преподаватель видит только своих учеников, владелец — всех.
-- Стать преподавателем самому можно по коду преподавателя: на странице регистрации создаётся заявка,
-- доступ к ученикам появляется после подтверждения владельцем.
-- Выполнить целиком в Supabase: SQL Editor -> New query -> вставить -> Run. Безопасно запускать повторно.
-- Нужны прошлые шаги: school-access.sql, registration.sql, invite-students.sql, vocab.sql.
-- Файл только добавляет: таблицы и данные не удаляются, существующие ученики остаются у владельца.

-- ---------- 1. Роли и заявки ----------
alter table public.teachers add column if not exists role text not null default 'teacher';
alter table public.teachers add column if not exists status text not null default 'active';
alter table public.teachers add column if not exists email text not null default '';
alter table public.teachers add column if not exists created_at timestamptz not null default now();
do $do$ begin
  alter table public.teachers add constraint teachers_role_chk check (role in ('owner', 'teacher'));
exception when duplicate_object then null; end $do$;
do $do$ begin
  alter table public.teachers add constraint teachers_status_chk check (status in ('active', 'pending'));
exception when duplicate_object then null; end $do$;
-- кто был преподавателем до этого шага, становится владельцем школы (только при первом запуске)
update public.teachers set role = 'owner', status = 'active'
 where not exists (select 1 from public.teachers where role = 'owner');

-- ---------- 2. Какой преподаватель ведёт ученика ----------
-- Ученик без строки здесь — ученик владельца. Удаление ученика или преподавателя удаляет и связь.
create table if not exists public.student_teachers (
  site text not null default 'school' check (site = 'school'),
  student text not null,
  teacher text not null references public.teachers(name) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (site, student),
  foreign key (site, student) references public.progress(site, name) on delete cascade
);
create index if not exists student_teachers_teacher on public.student_teachers(teacher);
alter table public.student_teachers enable row level security;
revoke all on public.student_teachers from anon, authenticated;

-- ---------- 3. Проверки ----------
-- преподаватель: действующий (заявка ещё не преподаватель)
create or replace function public._school_teacher(p_name text, p_pin text)
returns text as $fn$
declare n text;
begin
  n := public._school_auth(p_name, p_pin);
  if not exists (select 1 from public.teachers where name = n and status = 'active') then raise exception 'not_teacher'; end if;
  return n;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.is_teacher(p_name text, p_pin text)
returns boolean as $fn$
declare n text;
begin
  n := public._school_auth(p_name, p_pin);
  return exists (select 1 from public.teachers where name = n and status = 'active');
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public._school_owner(p_name text, p_pin text)
returns text as $fn$
declare n text;
begin
  n := public._school_teacher(p_name, p_pin);
  if not exists (select 1 from public.teachers where name = n and role = 'owner') then raise exception 'not_owner'; end if;
  return n;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;
revoke execute on function public._school_owner(text, text) from public, anon, authenticated;

-- ученик доступен преподавателю: владельцу — любой, остальным — только свои. Вызывается только из функций ниже.
create or replace function public._school_mine(p_teacher text, p_student text)
returns text as $fn$
declare s text := lower(trim(coalesce(p_student, '')));
begin
  if exists (select 1 from public.teachers where name = p_teacher and role = 'owner') then return s; end if;
  if not exists (select 1 from public.student_teachers where site = 'school' and student = s and teacher = p_teacher) then
    raise exception 'no_student';
  end if;
  return s;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;
revoke execute on function public._school_mine(text, text) from public, anon, authenticated;

-- роль вошедшего: owner, teacher, pending (заявка ждёт подтверждения) или student
create or replace function public.my_role(p_name text, p_pin text)
returns text as $fn$
declare n text;
begin
  n := public._school_auth(p_name, p_pin);
  return coalesce((select case when status = 'pending' then 'pending' else role end from public.teachers where name = n), 'student');
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- ---------- 4. Панель преподавателя: только свои ученики ----------
create or replace function public.teacher_students(p_name text, p_pin text)
returns jsonb as $fn$
declare t text; own boolean;
begin
  t := public._school_teacher(p_name, p_pin);
  own := exists (select 1 from public.teachers where name = t and role = 'owner');
  return coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'updated_at', p.updated_at,
              'email', coalesce(p.state->>'email', ''),
              'assigned', (select count(*) from public.assignments a where a.student = p.name),
              'signup_at', s.created_at, 'teacher', st.teacher) order by p.name)
            from public.progress p
            left join public.school_signups s on s.name = p.name
            left join public.student_teachers st on st.site = 'school' and st.student = p.name
           where p.site = 'school'
             and not exists (select 1 from public.teachers tt where tt.name = p.name)
             and (own or st.teacher = t)), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_create_student(p_name text, p_pin text, p_login text, p_email text, p_new_pin text)
returns void as $fn$
declare l text := lower(trim(p_login)); t text;
begin
  t := public._school_teacher(p_name, p_pin);
  if l is null or length(l) < 2 or length(l) > 40 then raise exception 'bad_input'; end if;
  if p_new_pin !~ '^\d{4,8}$' then raise exception 'bad_input'; end if;
  if exists (select 1 from public.progress where site = 'school' and name = l)
     or exists (select 1 from public.teachers where name = l) then raise exception 'exists'; end if;
  perform set_config('app.school_invite', '1', true);
  insert into public.progress(site, name, pin_hash, state, updated_at)
  values ('school', l, crypt(p_new_pin, gen_salt('bf')),
          jsonb_build_object('email', coalesce(trim(p_email), ''), 'progress', '{}'::jsonb,
                             'taken', jsonb_build_object('l', '[]'::jsonb, 't', 0)),
          now());
  perform set_config('app.school_invite', '', true);
  insert into public.student_teachers(site, student, teacher) values ('school', l, t);   -- ученик того, кто его создал
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_assignments(p_name text, p_pin text, p_student text)
returns jsonb as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.material_id, 'due', a.due, 'note', a.note) order by a.assigned_at desc)
          from public.assignments a where a.student = lower(trim(p_student))), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_assign(p_name text, p_pin text, p_student text, p_material text, p_due date, p_note text)
returns void as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  if not exists (select 1 from public.progress where site = 'school' and name = lower(trim(p_student))) then raise exception 'no_student'; end if;
  insert into public.assignments(student, material_id, due, note)
  values (lower(trim(p_student)), p_material, p_due, coalesce(p_note, ''))
  on conflict (student, material_id) do update set due = excluded.due, note = excluded.note;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_unassign(p_name text, p_pin text, p_student text, p_material text)
returns void as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  delete from public.assignments where student = lower(trim(p_student)) and material_id = p_material;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_student_state(p_name text, p_pin text, p_student text)
returns jsonb as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  return (select state from public.progress where site = 'school' and name = lower(trim(p_student)));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_reset_pin(p_name text, p_pin text, p_student text, p_new_pin text)
returns void as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  if p_new_pin !~ '^\d{4,8}$' then raise exception 'bad_input'; end if;
  if exists (select 1 from public.teachers where name = lower(trim(p_student))) then raise exception 'bad_input'; end if;
  update public.progress set pin_hash = crypt(p_new_pin, gen_salt('bf')), updated_at = now()
   where site = 'school' and name = lower(trim(p_student));
  if not found then raise exception 'no_student'; end if;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_delete_student(p_name text, p_pin text, p_student text)
returns void as $fn$
declare s text := lower(trim(coalesce(p_student, '')));
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), s);
  if exists (select 1 from public.teachers where name = s) then raise exception 'bad_input'; end if;
  delete from public.assignments where student = s;
  delete from public.school_signups where name = s;
  delete from public.progress where site = 'school' and name = s;
  if not found then raise exception 'no_student'; end if;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_vocab(p_name text, p_pin text, p_student text)
returns jsonb as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  return coalesce((select jsonb_agg(data) from public.vocab
                   where student = lower(trim(coalesce(p_student, ''))) and id <> '_settings'), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_vocab_add(p_name text, p_pin text, p_student text, p_words jsonb)
returns jsonb as $fn$
declare
  s text := lower(trim(coalesce(p_student, '')));
  ws jsonb := coalesce(p_words, '[]'::jsonb);
  ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
  w jsonb; old jsonb; st int; added int := 0; bumped int := 0;
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), s);
  if not exists (select 1 from public.progress where site = 'school' and name = s) then raise exception 'no_student'; end if;
  if jsonb_typeof(ws) <> 'array' or jsonb_array_length(ws) > 300 then raise exception 'bad_input'; end if;
  for w in select * from jsonb_array_elements(ws) loop
    if jsonb_typeof(w) <> 'object' or coalesce(w->>'id', '') !~ '^(ko|en):.{1,120}$' or length(w::text) > 3000
       or coalesce(w->>'w', '') = '' then raise exception 'bad_input'; end if;
    select data into old from public.vocab where student = s and id = w->>'id';
    if old is null then
      insert into public.vocab(student, id, data, updated_at)
      values (s, w->>'id', w || jsonb_build_object('st', 0, 'due', ms, 'a', ms, 'u', ms, 'src', 'teacher'), now());
      added := added + 1;
    else
      st := coalesce((old->>'st')::int, 0);
      update public.vocab set updated_at = now(), data = old
          || case when st = 2 then jsonb_build_object('ivl', greatest(1, round(coalesce((old->>'ivl')::numeric, 1) / 2)),
                                                      'due', least(coalesce((old->>'due')::numeric, ms), ms))
                  when st in (1, 3) then jsonb_build_object('step', 0, 'due', ms)
                  else jsonb_build_object('pri', ms) end
          || jsonb_build_object('b', coalesce((old->>'b')::int, 0) + 1, 'u', ms)
       where student = s and id = w->>'id';
      bumped := bumped + 1;
    end if;
  end loop;
  if (select count(*) from public.vocab where student = s) > 5000 then raise exception 'too_many'; end if;
  return jsonb_build_object('added', added, 'bumped', bumped);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_vocab_delete(p_name text, p_pin text, p_student text, p_ids jsonb)
returns void as $fn$
begin
  perform public._school_mine(public._school_teacher(p_name, p_pin), p_student);
  if jsonb_typeof(coalesce(p_ids, '[]'::jsonb)) <> 'array' then raise exception 'bad_input'; end if;
  delete from public.vocab where student = lower(trim(coalesce(p_student, ''))) and id <> '_settings'
     and id in (select jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb)));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- ---------- 5. Регистрация: код школы для учеников меняет только владелец ----------
create or replace function public.teacher_signup_settings(p_name text, p_pin text)
returns jsonb as $fn$
declare t text; own boolean;
begin
  t := public._school_teacher(p_name, p_pin);
  own := exists (select 1 from public.teachers where name = t and role = 'owner');
  return jsonb_build_object(
    'mode', coalesce((select value from public.school_settings where key = 'signup_mode'), 'closed'),
    'code', case when own then coalesce((select value from public.school_settings where key = 'signup_code'), '') else '' end,
    'owner', own,
    'teacher_code', case when own then coalesce((select value from public.school_settings where key = 'teacher_code'), '') else '' end);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_set_signup(p_name text, p_pin text, p_mode text, p_code text)
returns void as $fn$
declare c text := trim(coalesce(p_code, ''));
begin
  perform public._school_owner(p_name, p_pin);
  if p_mode is null or p_mode not in ('closed', 'code', 'open') then raise exception 'bad_input'; end if;
  if length(c) > 40 or (p_mode = 'code' and length(c) < 4) then raise exception 'bad_input'; end if;
  insert into public.school_settings(key, value) values ('signup_mode', p_mode), ('signup_code', c)
    on conflict (key) do update set value = excluded.value;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.signup_info()
returns jsonb as $fn$
begin
  return jsonb_build_object('mode', coalesce((select value from public.school_settings where key = 'signup_mode'), 'closed'),
                            'teacher', coalesce((select value from public.school_settings where key = 'teacher_code'), '') <> '');
end;
$fn$ language plpgsql stable security definer set search_path = public, extensions;

-- заявка преподавателя по коду: аккаунт создаётся, доступ к ученикам — после подтверждения владельцем
create or replace function public.register_teacher(p_login text, p_email text, p_new_pin text, p_code text)
returns void as $fn$
declare
  l text := lower(trim(coalesce(p_login, '')));
  e text := trim(coalesce(p_email, ''));
  c text := coalesce((select value from public.school_settings where key = 'teacher_code'), '');
begin
  if c = '' then raise exception 'signup_closed'; end if;
  if lower(trim(coalesce(p_code, ''))) <> lower(c) then raise exception 'bad_code'; end if;
  if l !~ '^[a-z0-9а-яё._-]{2,40}$' then raise exception 'bad_input'; end if;
  if p_new_pin is null or p_new_pin !~ '^\d{6,8}$' then raise exception 'bad_input'; end if;
  if length(e) > 200 or e !~ '^\S+@\S+\.\S+$' then raise exception 'bad_input'; end if;
  if exists (select 1 from public.progress where site = 'school' and name = l)
     or exists (select 1 from public.teachers where name = l) then raise exception 'exists'; end if;
  if (select count(*) from public.teachers where status = 'pending' and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many';
  end if;
  perform set_config('app.school_invite', '1', true);
  insert into public.progress(site, name, pin_hash, state, updated_at)
  values ('school', l, crypt(p_new_pin, gen_salt('bf')),
          jsonb_build_object('email', e, 'progress', '{}'::jsonb, 'taken', jsonb_build_object('l', '[]'::jsonb, 't', 0)), now());
  perform set_config('app.school_invite', '', true);
  insert into public.teachers(name, role, status, email) values (l, 'teacher', 'pending', e);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- ---------- 6. Владелец: преподаватели, заявки, код, передача учеников ----------
create or replace function public.owner_teachers(p_name text, p_pin text)
returns jsonb as $fn$
begin
  perform public._school_owner(p_name, p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object('name', t.name, 'role', t.role, 'status', t.status, 'email', t.email,
              'created_at', t.created_at, 'updated_at', p.updated_at,
              'students', (select count(*) from public.student_teachers st where st.teacher = t.name))
            order by (t.role = 'owner') desc, (t.status = 'pending') desc, t.name)
           from public.teachers t left join public.progress p on p.site = 'school' and p.name = t.name), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- новый преподаватель: аккаунт с логином и PIN, сразу действующий
create or replace function public.owner_add_teacher(p_name text, p_pin text, p_login text, p_email text, p_new_pin text)
returns void as $fn$
declare l text := lower(trim(coalesce(p_login, '')));
begin
  perform public._school_owner(p_name, p_pin);
  if length(l) < 2 or length(l) > 40 or p_new_pin !~ '^\d{4,8}$' then raise exception 'bad_input'; end if;
  if exists (select 1 from public.progress where site = 'school' and name = l)
     or exists (select 1 from public.teachers where name = l) then raise exception 'exists'; end if;
  perform set_config('app.school_invite', '1', true);
  insert into public.progress(site, name, pin_hash, state, updated_at)
  values ('school', l, crypt(p_new_pin, gen_salt('bf')),
          jsonb_build_object('email', coalesce(trim(p_email), ''), 'progress', '{}'::jsonb,
                             'taken', jsonb_build_object('l', '[]'::jsonb, 't', 0)), now());
  perform set_config('app.school_invite', '', true);
  insert into public.teachers(name, role, status, email) values (l, 'teacher', 'active', coalesce(trim(p_email), ''));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- заявка: подтвердить (p_ok = true) или отклонить. Отклонённый аккаунт остаётся обычным, его можно удалить из списка учеников.
create or replace function public.owner_approve_teacher(p_name text, p_pin text, p_login text, p_ok boolean)
returns void as $fn$
declare l text := lower(trim(coalesce(p_login, '')));
begin
  perform public._school_owner(p_name, p_pin);
  if p_ok then
    update public.teachers set status = 'active' where name = l and status = 'pending';
  else
    delete from public.teachers where name = l and status = 'pending';
  end if;
  if not found then raise exception 'no_teacher'; end if;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- снять роль преподавателя: его ученики возвращаются владельцу. Владельца снять нельзя.
create or replace function public.owner_remove_teacher(p_name text, p_pin text, p_login text)
returns void as $fn$
declare l text := lower(trim(coalesce(p_login, '')));
begin
  perform public._school_owner(p_name, p_pin);
  delete from public.teachers where name = l and role <> 'owner';
  if not found then raise exception 'no_teacher'; end if;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- код преподавателя: пустой выключает самостоятельные заявки
create or replace function public.owner_set_teacher_code(p_name text, p_pin text, p_code text)
returns void as $fn$
declare c text := trim(coalesce(p_code, ''));
begin
  perform public._school_owner(p_name, p_pin);
  if length(c) > 40 or (c <> '' and length(c) < 6) then raise exception 'bad_input'; end if;
  insert into public.school_settings(key, value) values ('teacher_code', c)
    on conflict (key) do update set value = excluded.value;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- передать ученика преподавателю; пустой p_teacher возвращает ученика владельцу
create or replace function public.owner_assign_student(p_name text, p_pin text, p_student text, p_teacher text)
returns void as $fn$
declare s text := lower(trim(coalesce(p_student, ''))); t text := lower(trim(coalesce(p_teacher, '')));
begin
  perform public._school_owner(p_name, p_pin);
  if not exists (select 1 from public.progress where site = 'school' and name = s)
     or exists (select 1 from public.teachers where name = s) then raise exception 'no_student'; end if;
  if t = '' or exists (select 1 from public.teachers where name = t and role = 'owner') then
    delete from public.student_teachers where site = 'school' and student = s;
    return;
  end if;
  if not exists (select 1 from public.teachers where name = t and status = 'active') then raise exception 'no_teacher'; end if;
  insert into public.student_teachers(site, student, teacher) values ('school', s, t)
    on conflict (site, student) do update set teacher = excluded.teacher, created_at = now();
end;
$fn$ language plpgsql security definer set search_path = public, extensions;
