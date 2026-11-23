// Программа курса. На странице «Курс» уроки показаны как главы на пути.
// Необязательное поле урока scene: "…" — короткая сюжетная вставка, она появится в карточке главы.
window.COURSE = {
  id: "snu1", title: "서울대 한국어+ · 1급", subtitle: "Основной курс",
  lessons: [
    { no: 11, title: "", id: null },
    { no: 12, title: "-지요?", id: "l12-jiyo", practice: ["p12-jiyo-1"] },
    { no: 13, title: "", id: null },
    { no: 14, title: "", id: null },
    { no: 15, title: "", id: null }
  ]
};
window.COURSE2 = {
  id: "snu2", title: "서울대 한국어+ · 2급", subtitle: "Основной курс",
  lessons: [
    { no: "복습 2", tag: "2A · 4–6과 · 복습", title: "복습 2 · Workbook 2A (말하기, 쓰기, TOPIK II, 51–52)", mat: "ko-2a-review2" },
    { no: "퀘스트", tag: "2A · 4–6과 · квест-проверка", title: "유키의 바쁜 토요일", mat: "ko-2a6-quest" },
    { no: 11, title: "-아/어다 주다", id: "l11-adaju" },
    { no: "어휘", tag: "어휘", title: "초대와 약속", id: "v2-invite" }
  ]
};
window.COURSE4 = {
  id: "snu3", title: "서울대 한국어+ · 3급", subtitle: "Основной курс",
  lessons: [
    { no: "피동", tag: "Грамматика · 피동", title: "피동 + -아/어 있다 + -아/어지다", id: "l3-pidong" }
  ]
};
window.PRACTICE_TOPICS = [
  { id: "p12-jiyo-1", lesson: 12, title: "-지요: формы и времена", desc: "Основа + -지요, прошедшее и будущее время", ready: true },
  { id: null, lesson: 12, title: "Вопросительные слова с -지요", desc: "누구, 언제, 어디, 얼마…", ready: false },
  { id: null, lesson: 12, title: "Значения -지요 в диалогах", desc: "Подтверждение, смягчение, приглашение", ready: false }
];
// Домашку задаёт преподаватель на сайте (Ученики → карточка ученика → «Задать домашку»), см. supabase/homework.sql.
