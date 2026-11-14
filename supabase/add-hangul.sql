-- Курс «Хангыль с нуля»: 10 занятий и игры. Добавляет их в каталог, чтобы их можно было назначать ученикам. Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('ko-hangul-games','korean','game','Хангыль с нуля · игры и итоговый тест','с нуля','materials/korean/ko-hangul-games/',60),
  ('lesson-h01','course','lesson','한글 · Занятие 1 · Что такое хангыль','с нуля','lesson.html?l=h01',30),
  ('lesson-h02','course','lesson','한글 · Занятие 2 · Базовые гласные','с нуля','lesson.html?l=h02',31),
  ('lesson-h03','course','lesson','한글 · Занятие 3 · Йотированные и составные гласные','с нуля','lesson.html?l=h03',32),
  ('lesson-h04','course','lesson','한글 · Занятие 4 · Основные согласные','с нуля','lesson.html?l=h04',33),
  ('lesson-h05','course','lesson','한글 · Занятие 5 · Придыхательные и напряжённые','с нуля','lesson.html?l=h05',34),
  ('lesson-h06','course','lesson','한글 · Занятие 6 · Как собирать слоговой блок','с нуля','lesson.html?l=h06',35),
  ('lesson-h07','course','lesson','한글 · Занятие 7 · 받침 — конечная согласная','с нуля','lesson.html?l=h07',36),
  ('lesson-h08','course','lesson','한글 · Занятие 8 · Семь звуков 받침','с нуля','lesson.html?l=h08',37),
  ('lesson-h09','course','lesson','한글 · Занятие 9 · Первые правила чтения','с нуля','lesson.html?l=h09',38),
  ('lesson-h10','course','lesson','한글 · Занятие 10 · Читаем настоящие слова','с нуля','lesson.html?l=h10',39)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
