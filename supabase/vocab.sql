-- MIRAÉ: словарь ученика для интервального повторения (страница «Слова»).
-- Выполнить целиком в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Безопасно запускать повторно. Сначала должен быть выполнен school-access.sql.
-- Без этого файла словарь работает, но хранится только на устройстве ученика, и учитель его не видит.
create extension if not exists pgcrypto;

-- 1) Одна строка на слово ученика. В data лежит карточка целиком (слово, перевод, пример, расписание повторений).
-- Строка с id = '_settings' хранит настройки ученика: интервалы и выбранные игры.
create table if not exists public.vocab (
  student text not null, id text not null, data jsonb not null, updated_at timestamptz not null default now(),
  primary key (student, id)
);
alter table public.vocab enable row level security;
revoke all on public.vocab from anon, authenticated;

-- 2) Ученик: отправить изменённые и удалённые слова, получить весь словарь.
-- Побеждает более свежая версия карточки (поле u), поэтому слова, добавленные учителем или с другого устройства, не теряются.
create or replace function public.vocab_sync(p_name text, p_pin text, p_words jsonb, p_deleted jsonb, p_settings jsonb)
returns jsonb as $fn$
declare
  n text; w jsonb;
  ws jsonb := coalesce(p_words, '[]'::jsonb);
  ds jsonb := coalesce(p_deleted, '[]'::jsonb);
begin
  n := public._school_auth(p_name, p_pin);
  if jsonb_typeof(ws) <> 'array' or jsonb_typeof(ds) <> 'array' or jsonb_array_length(ws) > 400 or jsonb_array_length(ds) > 400 then
    raise exception 'bad_input';
  end if;
  for w in select * from jsonb_array_elements(ws) loop
    if jsonb_typeof(w) <> 'object' or coalesce(w->>'id', '') !~ '^(ko|en):.{1,120}$' or length(w::text) > 3000
       or jsonb_typeof(w->'u') is distinct from 'number' then raise exception 'bad_input'; end if;
    insert into public.vocab(student, id, data, updated_at) values (n, w->>'id', w, now())
    on conflict (student, id) do update set data = excluded.data, updated_at = now()
      where coalesce((public.vocab.data->>'u')::numeric, 0) <= (excluded.data->>'u')::numeric;
  end loop;
  delete from public.vocab where student = n and id <> '_settings' and id in (select jsonb_array_elements_text(ds));
  if p_settings is not null and jsonb_typeof(p_settings) = 'object' then
    if length(p_settings::text) > 6000 or jsonb_typeof(p_settings->'t') is distinct from 'number' then raise exception 'bad_input'; end if;
    insert into public.vocab(student, id, data, updated_at) values (n, '_settings', p_settings, now())
    on conflict (student, id) do update set data = excluded.data, updated_at = now()
      where coalesce((public.vocab.data->>'t')::numeric, 0) <= (excluded.data->>'t')::numeric;
  end if;
  if (select count(*) from public.vocab where student = n) > 5000 then raise exception 'too_many'; end if;
  return jsonb_build_object(
    'words', coalesce((select jsonb_agg(data) from public.vocab where student = n and id <> '_settings'), '[]'::jsonb),
    'settings', (select data from public.vocab where student = n and id = '_settings'));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 3) Преподаватель: посмотреть словарь ученика.
create or replace function public.teacher_vocab(p_name text, p_pin text, p_student text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return coalesce((select jsonb_agg(data) from public.vocab
                   where student = lower(trim(coalesce(p_student, ''))) and id <> '_settings'), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 4) Преподаватель: добавить слова ученику. Если слово у ученика уже есть, оно вернётся на повторение раньше:
-- интервал делится пополам, слово встаёт в очередь на сегодня (то же правило, что на сайте при повторном добавлении).
create or replace function public.teacher_vocab_add(p_name text, p_pin text, p_student text, p_words jsonb)
returns jsonb as $fn$
declare
  s text := lower(trim(coalesce(p_student, '')));
  ws jsonb := coalesce(p_words, '[]'::jsonb);
  ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
  w jsonb; old jsonb; st int; added int := 0; bumped int := 0;
begin
  perform public._school_teacher(p_name, p_pin);
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

-- 5) Преподаватель: убрать слова из словаря ученика (например, добавленные по ошибке).
create or replace function public.teacher_vocab_delete(p_name text, p_pin text, p_student text, p_ids jsonb)
returns void as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  if jsonb_typeof(coalesce(p_ids, '[]'::jsonb)) <> 'array' then raise exception 'bad_input'; end if;
  delete from public.vocab where student = lower(trim(coalesce(p_student, ''))) and id <> '_settings'
     and id in (select jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb)));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- 6) Если ученика удаляют, его словарь удаляется вместе с ним.
create or replace function public._school_vocab_cleanup()
returns trigger as $fn$
begin
  if old.site = 'school' then delete from public.vocab where student = old.name; end if;
  return old;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;
drop trigger if exists school_vocab_cleanup on public.progress;
create trigger school_vocab_cleanup after delete on public.progress
  for each row execute function public._school_vocab_cleanup();

grant execute on function public.vocab_sync(text, text, jsonb, jsonb, jsonb) to anon;
grant execute on function public.teacher_vocab(text, text, text) to anon;
grant execute on function public.teacher_vocab_add(text, text, text, jsonb) to anon;
grant execute on function public.teacher_vocab_delete(text, text, text, jsonb) to anon;
