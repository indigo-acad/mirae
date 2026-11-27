-- Игра для малышей «Домик лисички» (урок 4: звери и их голоса, «똑똑! 누구야? — 나야!», буква ㅁ):
-- в каталог, чтобы её можно было назначать и задавать домашкой (целиком или по режимам).
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('kid-house','kids','game','Домик лисички','дошкольник','materials/kids/kid-house/',61)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
