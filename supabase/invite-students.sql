-- MIRAÉ: ученики создаются только преподавателем, самостоятельная регистрация закрыта.
-- Выполнить целиком в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Безопасно запускать повторно. Сначала должен быть выполнен supabase/school-access.sql.
create extension if not exists pgcrypto;

-- 1) Закрыть регистрацию на сервере.
-- Новую строку для сайта school в public.progress теперь можно создать только через
-- функцию teacher_create_student (она ставит флаг). Обновление существующих учеников работает как раньше.
-- Остальные сайты (тренажёры со своими ключами) не затрагиваются.
create or replace function public._school_block_signup()
returns trigger as $fn$
begin
  if new.site = 'school'
     and coalesce(current_setting('app.school_invite', true), '') <> '1'
     and not exists (select 1 from public.progress p where p.site = new.site and p.name = new.name) then
    raise exception 'signup_closed';
  end if;
  return new;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

drop trigger if exists school_block_signup on public.progress;
create trigger school_block_signup before insert on public.progress
  for each row execute function public._school_block_signup();

-- 2) Преподаватель создаёт ученика: логин, email и PIN (PIN придумывает сайт).
create or replace function public.teacher_create_student(p_name text, p_pin text, p_login text, p_email text, p_new_pin text)
returns void as $fn$
declare l text := lower(trim(p_login));
begin
  perform public._school_teacher(p_name, p_pin);
  if l is null or length(l) < 2 or length(l) > 40 then raise exception 'bad_input'; end if;
  if p_new_pin !~ '^\d{4,8}$' then raise exception 'bad_input'; end if;
  if exists (select 1 from public.progress where site = 'school' and name = l) then raise exception 'exists'; end if;
  perform set_config('app.school_invite', '1', true);
  insert into public.progress(site, name, pin_hash, state, updated_at)
  values ('school', l, crypt(p_new_pin, gen_salt('bf')),
          jsonb_build_object('email', coalesce(trim(p_email), ''), 'progress', '{}'::jsonb,
                             'taken', jsonb_build_object('l', '[]'::jsonb, 't', 0)),
          now());
  perform set_config('app.school_invite', '', true);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 3) Сброс PIN, если ученик забыл.
create or replace function public.teacher_reset_pin(p_name text, p_pin text, p_student text, p_new_pin text)
returns void as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  if p_new_pin !~ '^\d{4,8}$' then raise exception 'bad_input'; end if;
  update public.progress set pin_hash = crypt(p_new_pin, gen_salt('bf')), updated_at = now()
   where site = 'school' and name = lower(trim(p_student));
  if not found then raise exception 'no_student'; end if;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 4) Список учеников теперь отдаёт ещё и email.
create or replace function public.teacher_students(p_name text, p_pin text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'updated_at', p.updated_at,
            'email', coalesce(p.state->>'email', ''),
            'assigned', (select count(*) from public.assignments a where a.student = p.name)) order by p.name)
          from public.progress p where p.site = 'school'), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.teacher_create_student(text, text, text, text, text) to anon;
grant execute on function public.teacher_reset_pin(text, text, text, text) to anon;
grant execute on function public.teacher_students(text, text) to anon;
