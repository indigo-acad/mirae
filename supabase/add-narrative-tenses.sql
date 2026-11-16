-- Урок «Narrative Tenses · B1»: добавить в каталог материалов, чтобы его можно было назначать ученикам. Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('en-narrative-tenses','english','lesson','Narrative Tenses · рассказываем истории','B1','materials/english/en-narrative-tenses/',4)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
