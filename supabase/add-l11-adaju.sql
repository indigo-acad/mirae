-- Урок 2급 · 11과 (-아/어다 주다): добавить в каталог материалов, чтобы его можно было назначать ученикам.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('lesson-l11-adaju','course','lesson','2급 · 11과 · -아/어다 주다','2급','lesson.html?l=l11-adaju',41)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
