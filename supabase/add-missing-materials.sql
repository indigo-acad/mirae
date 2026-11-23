-- Материалы из data/materials.js, которых не было в public.materials (без них их нельзя назначить ученику)
insert into public.materials(id,section,kind,title,level,path,sort) values
  ('ko-pidong-start-quest','korean','trainer','피동 · квест «Вор в Сеуле» (разминка)','3급','materials/korean/ko-pidong-start-quest/',21),
  ('ko-pidong-iss-jida','korean','lesson','피동 + -아/어 있다 + -아/어지다 · урок с кей-попом','3급','materials/korean/ko-pidong-iss-jida/',27),
  ('ko-sejong4-10-disasters','korean','class','자연재해 · видео «1분 브리핑» (세종 회화 4 · 10과)','3급','materials/korean/ko-sejong4-10-disasters/',31),
  ('ko-invite-vocab','korean','trainer','어휘 · 초대와 약속 (приглашения и встречи)','2급','materials/korean/ko-invite-vocab/',32),
  ('ko-2a6-quest','korean','quest','유키의 바쁜 토요일 · квест-проверка 2A 4–6과 (집안일, 마다, -(으)ㄹ게요, -기 전에, -(으)ㄴ 후에)','2A','materials/korean/ko-2a6-quest/',35),
  ('ko-2a-review2','korean','class','복습 2 · 2A 4–6과 + TOPIK II + 쓰기 51–52 (с подсказками)','2A','materials/korean/ko-2a-review2/',36),
  ('ko-grammar-randomizer','korean','game','Рандомайзер грамматики · 1급–2B','1급–2B','materials/korean/ko-grammar-randomizer/',37),
  ('ko-g2724-2-lesson','korean','trainer','Группа 2724 · урок 2 · слова и ошибки теста','3급','materials/korean/ko-g2724-2-lesson/',40),
  ('ko-g2724-2-games','korean','game','Группа 2724 · урок 2 · игры со словами','3급','materials/korean/ko-g2724-2-games/',41),
  ('ko-g2724-2-quiz','korean','trainer','Группа 2724 · урок 2 · проверка на начало урока','3급','materials/korean/ko-g2724-2-quiz/',42),
  ('ko-g2724-2-class','korean','class','Группа 2724 · урок 2 (для урока)','3급','materials/korean/ko-g2724-2-class/',43),
  ('ko-g2724-3-lesson','korean','trainer','Группа 2724 · урок 3 · слова, ошибки проверки и игры','3급','materials/korean/ko-g2724-3-lesson/',44),
  ('ko-g2724-3-quiz','korean','trainer','Группа 2724 · урок 3 · проверка на начало урока','3급','materials/korean/ko-g2724-3-quiz/',45),
  ('ko-g2724-3-class','korean','class','Группа 2724 · урок 3 (для урока)','3급','materials/korean/ko-g2724-3-class/',46),
  ('ko-skz-holiday','korean','quest','SKZ CODE · Holiday House (видео-уроки)','2급','materials/korean/ko-skz-holiday/',53),
  ('lesson-sw5-l4','course','lesson','3급 · видео · 슈취타 EP.5 · 4 · 신청곡과 시그니처','3급','lesson.html?l=sw5-l4',63)
on conflict (id) do update set section=excluded.section, kind=excluded.kind, title=excluded.title, level=excluded.level, path=excluded.path;
