-- MIRAÉ: регистрация учеников на сайте. Режим выбирает преподаватель в панели «Ученики»:
--   closed — закрыта (как раньше: учеников создаёт только преподаватель);
--   code   — по коду школы (ученик сам придумывает логин и PIN, но должен знать код);
--   open   — открыта для всех.
-- Выполнить целиком в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Безопасно запускать повторно. Сначала должны быть выполнены school-access.sql и invite-students.sql.
-- После запуска режим остаётся closed, пока преподаватель сам его не переключит.
create extension if not exists pgcrypto;

-- 1) Настройки школы и журнал регистраций (журнал нужен для суточного лимита и пометки «новый»).
create table if not exists public.school_settings (key text primary key, value text not null default '');
insert into public.school_settings(key, value) values ('signup_mode', 'closed'), ('signup_code', '')
on conflict (key) do nothing;
create table if not exists public.school_signups (
  name text primary key, email text not null default '', created_at timestamptz not null default now()
);
alter table public.school_settings enable row level security;
alter table public.school_signups enable row level security;
revoke all on public.school_settings, public.school_signups from anon, authenticated;

-- 2) Что видно всем: только режим. Сам код школы наружу не отдаётся.
create or replace function public.signup_info()
returns jsonb as $fn$
begin
  return jsonb_build_object('mode', coalesce((select value from public.school_settings where key = 'signup_mode'), 'closed'));
end;
$fn$ language plpgsql stable security definer set search_path = public, extensions;

-- 3) Ученик регистрируется сам: логин, email, PIN из 6–8 цифр и, если режим code, код школы.
-- Нельзя занять логин преподавателя. Не больше 40 регистраций в сутки (защита от наплыва).
create or replace function public.register_student(p_login text, p_email text, p_new_pin text, p_code text)
returns void as $fn$
declare
  l text := lower(trim(coalesce(p_login, '')));
  e text := trim(coalesce(p_email, ''));
  m text := coalesce((select value from public.school_settings where key = 'signup_mode'), 'closed');
  c text := coalesce((select value from public.school_settings where key = 'signup_code'), '');
begin
  if m not in ('code', 'open') then raise exception 'signup_closed'; end if;
  if m = 'code' and (c = '' or lower(trim(coalesce(p_code, ''))) <> lower(c)) then raise exception 'bad_code'; end if;
  if l !~ '^[a-z0-9а-яё._-]{2,40}$' then raise exception 'bad_input'; end if;
  if p_new_pin is null or p_new_pin !~ '^\d{6,8}$' then raise exception 'bad_input'; end if;
  if length(e) > 200 or e !~ '^\S+@\S+\.\S+$' then raise exception 'bad_input'; end if;
  if exists (select 1 from public.progress where site = 'school' and name = l)
     or exists (select 1 from public.teachers where name = l) then raise exception 'exists'; end if;
  if (select count(*) from public.school_signups where created_at > now() - interval '1 day') >= 40 then raise exception 'too_many'; end if;
  begin
    perform set_config('app.school_invite', '1', true);
    insert into public.progress(site, name, pin_hash, state, updated_at)
    values ('school', l, crypt(p_new_pin, gen_salt('bf')),
            jsonb_build_object('email', e, 'progress', '{}'::jsonb,
                               'taken', jsonb_build_object('l', '[]'::jsonb, 't', 0)),
            now());
    perform set_config('app.school_invite', '', true);
  exception when unique_violation then
    perform set_config('app.school_invite', '', true);
    raise exception 'exists';
  end;
  insert into public.school_signups(name, email) values (l, e)
  on conflict (name) do update set email = excluded.email, created_at = now();
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 4) Преподаватель: посмотреть и поменять режим регистрации и код школы.
create or replace function public.teacher_signup_settings(p_name text, p_pin text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return jsonb_build_object(
    'mode', coalesce((select value from public.school_settings where key = 'signup_mode'), 'closed'),
    'code', coalesce((select value from public.school_settings where key = 'signup_code'), ''));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_set_signup(p_name text, p_pin text, p_mode text, p_code text)
returns void as $fn$
declare c text := trim(coalesce(p_code, ''));
begin
  perform public._school_teacher(p_name, p_pin);
  if p_mode is null or p_mode not in ('closed', 'code', 'open') then raise exception 'bad_input'; end if;
  if length(c) > 40 or (p_mode = 'code' and length(c) < 4) then raise exception 'bad_input'; end if;
  insert into public.school_settings(key, value) values ('signup_mode', p_mode), ('signup_code', c)
  on conflict (key) do update set value = excluded.value;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 5) Список учеников: добавлена дата самостоятельной регистрации (signup_at; пусто, если ученика создал преподаватель).
create or replace function public.teacher_students(p_name text, p_pin text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'updated_at', p.updated_at,
            'email', coalesce(p.state->>'email', ''),
            'assigned', (select count(*) from public.assignments a where a.student = p.name),
            'signup_at', s.created_at) order by p.name)
          from public.progress p left join public.school_signups s on s.name = p.name
          where p.site = 'school'), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 6) Преподаватель может удалить ученика (например, случайную или чужую регистрацию).
-- Удаляются кабинет, прогресс и назначения. Аккаунт преподавателя удалить нельзя.
create or replace function public.teacher_delete_student(p_name text, p_pin text, p_student text)
returns void as $fn$
declare s text := lower(trim(coalesce(p_student, '')));
begin
  perform public._school_teacher(p_name, p_pin);
  if exists (select 1 from public.teachers where name = s) then raise exception 'bad_input'; end if;
  delete from public.assignments where student = s;
  delete from public.school_signups where name = s;
  delete from public.progress where site = 'school' and name = s;
  if not found then raise exception 'no_student'; end if;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.signup_info() to anon;
grant execute on function public.register_student(text, text, text, text) to anon;
grant execute on function public.teacher_signup_settings(text, text) to anon;
grant execute on function public.teacher_set_signup(text, text, text, text) to anon;
grant execute on function public.teacher_students(text, text) to anon;
grant execute on function public.teacher_delete_student(text, text, text) to anon;
