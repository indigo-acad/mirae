-- Проверка слов «예절과 규칙» (этикет со старшими, культурные различия, правила в общественных местах):
-- в каталог, чтобы её можно было задавать домашкой. Сама страница открывается и без входа по ссылке.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('ko-yejeol-quiz','korean','trainer','예절과 규칙 · проверка слов (этикет, культурные различия, общественные места)','3급','materials/korean/ko-yejeol-quiz/',47)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
