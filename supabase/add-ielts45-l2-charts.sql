-- Урок «IELTS 4–5 · Урок 2 · Comparing charts» (Writing Task 1): добавить в каталог. Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('en-ielts45-l2-charts','english','lesson','IELTS 4–5 · Урок 2 · Comparing charts (Writing Task 1)','band 4–5','materials/english/en-ielts45-l2-charts/',0)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
