-- Курс «CLT-синтез · A1», юниты 1–2 (4 урока): добавить в каталог материалов, чтобы их можно было назначать ученикам.
-- Модуль A0 этого курса — «Хангыль с нуля» (add-hangul.sql). Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('lesson-c101','course','lesson','CLT A1 · 1.1 · Представиться','A1','lesson.html?l=c101',20),
  ('lesson-c102','course','lesson','CLT A1 · 1.2 · Откуда вы','A1','lesson.html?l=c102',21),
  ('lesson-c201','course','lesson','CLT A1 · 2.1 · Что есть в классе','A1','lesson.html?l=c201',22),
  ('lesson-c202','course','lesson','CLT A1 · 2.2 · Чьё это','A1','lesson.html?l=c202',23)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
