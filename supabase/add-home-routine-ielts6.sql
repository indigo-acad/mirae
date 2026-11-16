-- Урок «My Home, My Routine» (Present Simple + наречия частотности + слова My Home → IELTS 6): добавить в каталог. Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('en-home-routine-ielts6','english','lesson','My Home, My Routine · how often + IELTS 6','IELTS с нуля → band 6','materials/english/en-home-routine-ielts6/',4)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
