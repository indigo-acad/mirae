-- Тренажёр «IELTS Speaking · гайд и тренажёр»: добавить в каталог материалов, чтобы его можно было назначать ученикам. Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('en-ielts-speaking','english','trainer','IELTS Speaking · гайд и тренажёр (Part 1–3, openers)','band 5 → 8+','materials/english/en-ielts-speaking/',11)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
