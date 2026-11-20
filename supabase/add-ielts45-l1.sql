-- IELTS 4–5 · Урок 1 и проверочная Advertising на начало урока: добавить в каталог (без этого «Задать домашку» отвечает «Тренажёр не найден»). Запускать повторно безопасно.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('en-ielts45-l1-free-time','english','lesson','IELTS 4–5 · Урок 1 · Free time & adventure holidays','band 4–5','materials/english/en-ielts45-l1-free-time/',0),
  ('en-test-band9-start','english','class','Advertising · проверочная на начало урока (band 9)','band 9','materials/english/en-test-band9-start/',0)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path;
