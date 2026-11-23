-- MIRAÉ: исправить написание слова, которое уже есть у учеников.
-- Выполнить целиком в Supabase после vocab.sql и vocab2.sql: SQL Editor -> New query -> вставить -> Run.
-- Безопасно запускать повторно.
--
-- Карточка слова у ученика хранится под id «язык:слово строчными» (js/srs.js, SRS.id). Раньше поэтому написание слова,
-- которое уже у учеников, менять было нельзя. Теперь при исправлении карточка ученика переезжает под новый id:
-- расписание повторений, звёздочка, заметка и история остаются. Если у ученика уже есть слово с новым написанием,
-- остаётся оно, а карточка с ошибкой убирается.

-- Перенести карточку ученика под новое написание. Возвращает true, если карточка была.
create or replace function public._vocab_move(p_student text, p_old text, p_new text, p_word text)
returns boolean as $fn$
declare
  d jsonb;
  ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  select data into d from public.vocab where student = p_student and id = p_old;
  if d is null then return false; end if;
  if p_old = p_new then
    update public.vocab set data = d || jsonb_build_object('w', p_word, 'u', ms), updated_at = now()
     where student = p_student and id = p_old;
    return true;
  end if;
  if not exists (select 1 from public.vocab where student = p_student and id = p_new) then
    insert into public.vocab(student, id, data, updated_at)
    values (p_student, p_new, d || jsonb_build_object('id', p_new, 'w', p_word, 'u', ms), now());
  end if;
  delete from public.vocab where student = p_student and id = p_old;
  return true;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;
revoke execute on function public._vocab_move(text, text, text, text) from public, anon, authenticated;

-- Сохранить слово базы школы (страница «Словари»). Как в vocab2.sql, но написание можно исправить и у слова,
-- которое уже у учеников: их карточки переезжают под новое написание. Язык такого слова по-прежнему не меняется.
create or replace function public.teacher_word_save(p_name text, p_pin text, p_word jsonb)
returns jsonb as $fn$
declare
  t text;
  w jsonb := coalesce(p_word, '{}'::jsonb);
  wid bigint;
  l text := coalesce(w->>'lang', '');
  wd text := trim(regexp_replace(normalize(coalesce(w->>'word', ''), NFC), '\s+', ' ', 'g'));
  nrm text := lower(trim(regexp_replace(normalize(coalesce(w->>'word', ''), NFC), '\s+', ' ', 'g')));
  ps text := coalesce(w->>'pos', '');
  sn text := trim(regexp_replace(coalesce(w->>'sense', ''), '\s+', ' ', 'g'));
  lv text := trim(coalesce(w->>'level', ''));
  i1 text := trim(coalesce(w->>'ipa_uk', ''));
  i2 text := trim(coalesce(w->>'ipa_us', ''));
  ex text := trim(coalesce(w->>'explanation', ''));
  img text := trim(coalesce(w->>'image', ''));
  old public.vocabulary;
  r public.vocabulary;
  sv record;
begin
  t := public._school_teacher(p_name, p_pin);
  if jsonb_typeof(w) <> 'object' or length(w::text) > 16000 then raise exception 'bad_input'; end if;
  if coalesce(w->>'id', '') !~ '^\d{0,18}$' then raise exception 'bad_input'; end if;
  wid := nullif(w->>'id', '')::bigint;
  if l not in ('ko', 'en') or wd = '' or length(wd) > 120 or length(sn) > 80 or length(lv) > 20 or length(i1) > 120 or length(i2) > 120
     or length(ex) > 1000 or (img <> '' and (img !~ '^https://' or length(img) > 500)) then raise exception 'bad_input'; end if;
  if w ? 'sources' and (jsonb_typeof(w->'sources') <> 'object' or length((w->'sources')::text) > 2000
     or exists (select 1 from jsonb_each(w->'sources') e where jsonb_typeof(e.value) <> 'string' or length(e.key) > 40 or length(e.value #>> '{}') > 40)) then
    raise exception 'bad_input';
  end if;
  if wid is not null then
    select * into old from public.vocabulary where id = wid;
    if not found then raise exception 'no_word'; end if;
    -- язык слова, которое уже у учеников или в словарях, не меняется
    if old.lang <> l and (exists (select 1 from public.student_vocabulary where word_id = wid)
                          or exists (select 1 from public.vocabulary_set_items where word_id = wid)) then raise exception 'in_use'; end if;
    update public.vocabulary set lang = l, word = wd, norm = nrm, pos = ps, sense = sn, level = lv,
           sources = case when w ? 'sources' then w->'sources' else sources end,
           tr_ru = public._vocab2_strs(w->'tr_ru', 10, 160), tr_ko = public._vocab2_strs(w->'tr_ko', 10, 160),
           ipa_uk = i1, ipa_us = i2, examples = public._vocab2_examples(w->'examples'), explanation = ex,
           synonyms = public._vocab2_strs(w->'synonyms', 12, 80), image = img,
           topics = public._vocab2_strs(w->'topics', 10, 40), checked = true, updated_at = now()
     where id = wid returning * into r;
    -- написание исправлено: карточки учеников переезжают под новое
    if old.word <> wd then
      for sv in select student, card_id from public.student_vocabulary where word_id = wid loop
        perform public._vocab_move(sv.student, sv.card_id, l || ':' || nrm, wd);
      end loop;
    end if;
  else
    insert into public.vocabulary(lang, word, norm, pos, sense, level, tr_ru, tr_ko, ipa_uk, ipa_us, examples, explanation,
                                  synonyms, image, topics, checked, sources, created_by)
    values (l, wd, nrm, ps, sn, lv, public._vocab2_strs(w->'tr_ru', 10, 160), public._vocab2_strs(w->'tr_ko', 10, 160),
            i1, i2, public._vocab2_examples(w->'examples'), ex, public._vocab2_strs(w->'synonyms', 12, 80), img,
            public._vocab2_strs(w->'topics', 10, 40), true, coalesce(w->'sources', '{}'::jsonb), t)
    returning * into r;
  end if;
  return public._vocab2_card(r);
exception
  when unique_violation then raise exception 'exists';
  when check_violation then raise exception 'bad_input';
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- Преподаватель: исправить слово в словаре ученика (панель «Ученики» → «Словарь ученика» → «Все слова» → карандаш).
-- p_card: {"id": прежний id, "w": новое написание, "t": переводы, "ex", "et"}. Расписание повторений сохраняется.
create or replace function public.teacher_vocab_edit(p_name text, p_pin text, p_student text, p_card jsonb)
returns jsonb as $fn$
declare
  s text := lower(trim(coalesce(p_student, '')));
  c jsonb := coalesce(p_card, '{}'::jsonb);
  oid text := coalesce(c->>'id', '');
  wd text := trim(regexp_replace(normalize(coalesce(c->>'w', ''), NFC), '\s+', ' ', 'g'));
  l text := split_part(oid, ':', 1);
  nid text;
  ms numeric := floor(extract(epoch from clock_timestamp()) * 1000);
  d jsonb;
begin
  s := public._school_mine(public._school_teacher(p_name, p_pin), s);
  if jsonb_typeof(c) <> 'object' or length(c::text) > 3000 or oid !~ '^(ko|en):.{1,120}$' or wd = '' or length(wd) > 120 then
    raise exception 'bad_input';
  end if;
  nid := l || ':' || lower(wd);
  if nid <> oid and exists (select 1 from public.vocab where student = s and id = nid) then raise exception 'exists'; end if;
  if not public._vocab_move(s, oid, nid, wd) then raise exception 'no_word'; end if;
  select data into d from public.vocab where student = s and id = nid;
  d := d || jsonb_build_object('t', left(trim(coalesce(c->>'t', d->>'t', '')), 300), 'u', ms + 1);
  if c ? 'ex' then
    if trim(coalesce(c->>'ex', '')) = '' then d := d - 'ex' - 'et' - 'f';
    else d := d || jsonb_build_object('ex', left(trim(c->>'ex'), 240), 'et', left(trim(coalesce(c->>'et', '')), 240)); end if;
  end if;
  update public.vocab set data = d, updated_at = now() where student = s and id = nid;
  return d;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.teacher_word_save(text, text, jsonb) to anon;
grant execute on function public.teacher_vocab_edit(text, text, text, jsonb) to anon;
