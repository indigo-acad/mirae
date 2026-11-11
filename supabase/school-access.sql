-- MIRAÉ: каталог материалов, преподаватели и назначения заданий.
-- Выполнить целиком в Supabase: SQL Editor -> New query -> вставить -> Run.
-- Безопасно запускать повторно. Нужны функции входа из прошлого шага (таблица public.progress).
create extension if not exists pgcrypto;

create table if not exists public.teachers (name text primary key);
-- ВАЖНО: впиши сюда имя (строчными буквами), под которым ты зарегистрируешься на сайте как преподаватель.
insert into public.teachers(name) values ('ксения') on conflict do nothing;

create table if not exists public.materials (
  id text primary key, section text not null, kind text not null, title text not null,
  level text not null default '', path text not null, sort int not null default 0
);
create table if not exists public.assignments (
  student text not null, material_id text not null references public.materials(id) on delete cascade,
  assigned_at timestamptz not null default now(), due date, note text not null default '',
  primary key (student, material_id)
);
alter table public.teachers enable row level security;
alter table public.materials enable row level security;
alter table public.assignments enable row level security;
revoke all on public.teachers, public.materials, public.assignments from anon, authenticated;

-- проверка имени и PIN ученика сайта school
create or replace function public._school_auth(p_name text, p_pin text)
returns text as $fn$
declare r public.progress;
begin
  select * into r from public.progress where site = 'school' and name = lower(trim(p_name));
  if not found or r.pin_hash <> crypt(p_pin, r.pin_hash) then raise exception 'wrong_pin'; end if;
  return r.name;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public._school_teacher(p_name text, p_pin text)
returns text as $fn$
declare n text;
begin
  n := public._school_auth(p_name, p_pin);
  if not exists (select 1 from public.teachers where name = n) then raise exception 'not_teacher'; end if;
  return n;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.is_teacher(p_name text, p_pin text)
returns boolean as $fn$
declare n text;
begin
  n := public._school_auth(p_name, p_pin);
  return exists (select 1 from public.teachers where name = n);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- ученик: свои назначенные материалы
create or replace function public.my_assignments(p_name text, p_pin text)
returns jsonb as $fn$
declare n text;
begin
  n := public._school_auth(p_name, p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.material_id, 'due', a.due, 'note', a.note, 'assigned_at', a.assigned_at) order by a.assigned_at desc)
                   from public.assignments a where a.student = n), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

-- преподаватель
create or replace function public.teacher_students(p_name text, p_pin text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'updated_at', p.updated_at,
            'assigned', (select count(*) from public.assignments a where a.student = p.name)) order by p.name)
          from public.progress p where p.site = 'school'), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_assignments(p_name text, p_pin text, p_student text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.material_id, 'due', a.due, 'note', a.note) order by a.assigned_at desc)
          from public.assignments a where a.student = lower(trim(p_student))), '[]'::jsonb);
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_assign(p_name text, p_pin text, p_student text, p_material text, p_due date, p_note text)
returns void as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  if not exists (select 1 from public.progress where site = 'school' and name = lower(trim(p_student))) then raise exception 'no_student'; end if;
  insert into public.assignments(student, material_id, due, note)
  values (lower(trim(p_student)), p_material, p_due, coalesce(p_note, ''))
  on conflict (student, material_id) do update set due = excluded.due, note = excluded.note;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_unassign(p_name text, p_pin text, p_student text, p_material text)
returns void as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  delete from public.assignments where student = lower(trim(p_student)) and material_id = p_material;
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

create or replace function public.teacher_student_state(p_name text, p_pin text, p_student text)
returns jsonb as $fn$
begin
  perform public._school_teacher(p_name, p_pin);
  return (select state from public.progress where site = 'school' and name = lower(trim(p_student)));
end;
$fn$ language plpgsql security definer set search_path = public, extensions;

grant execute on function public.is_teacher(text, text) to anon;
grant execute on function public.my_assignments(text, text) to anon;
grant execute on function public.teacher_students(text, text) to anon;
grant execute on function public.teacher_assignments(text, text, text) to anon;
grant execute on function public.teacher_assign(text, text, text, text, date, text) to anon;
grant execute on function public.teacher_unassign(text, text, text, text) to anon;
grant execute on function public.teacher_student_state(text, text, text) to anon;
revoke execute on function public._school_auth(text, text) from public, anon;
revoke execute on function public._school_teacher(text, text) from public, anon;

-- ===== каталог материалов (41 шт.) =====
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('en-ielts-unit1-places','english','trainer','IELTS Practice · Unit 1: Places','','materials/english/en-ielts-unit1-places/',0),
  ('en-ielts-places-vocab','english','trainer','IELTS Vocabulary · Places','band 9','materials/english/en-ielts-places-vocab/',1),
  ('en-ielts-band6-transport','english','trainer','IELTS Band 6 · Transport & towns','band 6','materials/english/en-ielts-band6-transport/',2),
  ('en-ielts-band9-advertising','english','trainer','IELTS Band 9 · Advertising: vocabulary, unit checks & essay','band 9','materials/english/en-ielts-band9-advertising/',3),
  ('en-hw-feelings','english','homework','Homework · Work, people & feelings','','materials/english/en-hw-feelings/',4),
  ('en-test-places','english','test','Vocabulary check · Places','','materials/english/en-test-places/',5),
  ('en-test-places-class','english','class','Vocabulary check · Places (в классе)','','materials/english/en-test-places-class/',6),
  ('en-test-band9','english','test','Проверочная · Advertising (band 9)','band 9','materials/english/en-test-band9/',7),
  ('en-test-band9-class','english','class','Advertising · на уроке (band 9)','band 9','materials/english/en-test-band9-class/',8),
  ('ko-topik3-vocab','korean','trainer','TOPIK II · 3급 · лексика','3급','materials/korean/ko-topik3-vocab/',9),
  ('ko-topik3-test','korean','test','Проверочная · 어휘 테스트','3급','materials/korean/ko-topik3-test/',10),
  ('ko-topik3-class','korean','class','Слова · 어휘 (для урока)','3급','materials/korean/ko-topik3-class/',11),
  ('ko-pidong-vocab','korean','trainer','피동 · пассивные глаголы','3급','materials/korean/ko-pidong-vocab/',12),
  ('ko-pidong-game','korean','quest','피동 · квест «Запертый дом»','3급','materials/korean/ko-pidong-game/',13),
  ('ko-pidong-lesson','korean','trainer','Урок · слова, 피동 и грамматика','3급','materials/korean/ko-pidong-lesson/',14),
  ('ko-pidong-lesson-games','korean','game','피동 · игры со словами','3급','materials/korean/ko-pidong-lesson-games/',15),
  ('ko-pidong-lesson-quest','korean','quest','피동 · квест «Запертая квартира»','3급','materials/korean/ko-pidong-lesson-quest/',16),
  ('ko-pidong-lesson-class','korean','class','Урок 피동 (для урока)','3급','materials/korean/ko-pidong-lesson-class/',17),
  ('ko-sago-vocab','korean','trainer','사고와 사건 · лексика','3급','materials/korean/ko-sago-vocab/',18),
  ('ko-sago-quiz','korean','trainer','사고와 사건 · быстрые задания','3급','materials/korean/ko-sago-quiz/',19),
  ('ko-sago-test','korean','test','Проверочная · 사고와 사건','3급','materials/korean/ko-sago-test/',20),
  ('ko-school-vocab','korean','trainer','어휘 · школа и встречи','','materials/korean/ko-school-vocab/',21),
  ('ko-snu-review','korean','trainer','서울대 한국어+ · повторение слов','1A–2A','materials/korean/ko-snu-review/',22),
  ('ko-g2724-lesson','korean','trainer','Группа 2724 · слова урока','3급','materials/korean/ko-g2724-lesson/',23),
  ('ko-g2724-games','korean','game','Группа 2724 · игры со словами','3급','materials/korean/ko-g2724-games/',24),
  ('ko-g2724-class','korean','class','Группа 2724 (для урока)','3급','materials/korean/ko-g2724-class/',25),
  ('ko-games','korean','game','Игры со словами','','materials/korean/ko-games/',26),
  ('ko-gajeon-warmup','korean','game','가전제품 · игра на повторение','','materials/korean/ko-gajeon-warmup/',27),
  ('ko-nuguna-cards','korean','game','누구나 · 언제나 · 어디나 · 무엇이나 — карточная игра','','materials/korean/ko-nuguna-cards/',28),
  ('ko-drama-bomnal','korean','quest','봄날의 너 · интерактивная драма','','materials/korean/ko-drama-bomnal/',29),
  ('ko-drama-party','korean','quest','파티의 주인공 · интерактивная драма','1B','materials/korean/ko-drama-party/',30),
  ('ko-listening-grandpa','korean','trainer','한국어 듣기 · 할아버지 댁에서','','materials/korean/ko-listening-grandpa/',31),
  ('qu-where-sua','quests','quest','Где Суа?','','materials/quests/qu-where-sua/',32),
  ('qu-concert','quests','quest','Билет на концерт','','materials/quests/qu-concert/',33),
  ('qu-marathon','quests','quest','하준의 마라톤','','materials/quests/qu-marathon/',34),
  ('qu-gajeon','quests','quest','가전제품 · онлайн-задание','','materials/quests/qu-gajeon/',35),
  ('kid-fox','kids','game','Покорми лисичку','дошкольник','materials/kids/kid-fox/',36),
  ('kid-forest','kids','game','Лиса в лесу','дошкольник','materials/kids/kid-forest/',37),
  ('kid-letters','kids','game','Лисичка и пропавшие буквы','дошкольник','materials/kids/kid-letters/',38),
  ('lesson-l12-jiyo','course','lesson','1급 · 12과 · -지요?','1급','lesson.html?l=l12-jiyo',39),
  ('practice-p12-jiyo-1','course','practice','12과 · -지요: формы и времена (отработка)','1급','lesson.html?l=p12-jiyo-1',40)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
