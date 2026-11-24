-- Урок 2급 · 10과 (높임말과 반말): добавить в каталог материалов, чтобы его можно было назначать ученикам и группам.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('lesson-l10-banmal','course','lesson','2급 · 10과 · 높임말과 반말','2급','lesson.html?l=l10-banmal',40)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
