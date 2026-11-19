-- Урок 3급 «피동 + -아/어 있다 + -아/어지다»: в каталог, чтобы его можно было назначать ученикам.
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('ko-pidong-iss-jida','korean','lesson','피동 + -아/어 있다 + -아/어지다 · урок с кей-попом','3급','materials/korean/ko-pidong-iss-jida/',18)
on conflict (id) do update set section=excluded.section,kind=excluded.kind,title=excluded.title,level=excluded.level,path=excluded.path,sort=excluded.sort;
