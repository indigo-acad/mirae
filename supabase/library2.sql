-- MIRAÉ: библиотека, шаг 2 — блоки по номерам (для правки урока из библиотеки на странице «Библиотека»).
-- Выполнить в Supabase после supabase/library.sql: SQL Editor -> New query -> вставить -> Run. Безопасно запускать повторно.

-- блоки по списку номеров: [12, 15, 40]; удалённые просто не возвращаются
create or replace function public.teacher_lib_get(p_name text, p_pin text, p_ids jsonb)
returns jsonb as $fn$
declare t text;
begin
  t := public._school_teacher(p_name, p_pin);
  if jsonb_typeof(p_ids) is distinct from 'array' or jsonb_array_length(p_ids) > 200 then raise exception 'bad_input'; end if;
  return coalesce((select jsonb_agg(public._lib_json(b, t)) from public.library_blocks b
    where b.id in (select (v #>> '{}')::bigint from jsonb_array_elements(p_ids) v where jsonb_typeof(v) = 'number')), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.teacher_lib_get(text, text, jsonb) to anon;
