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
    { no: 11, title: "-아/어다 주다", id: "l11-adaju" }
  ]
};
window.PRACTICE_TOPICS = [
  { id: "p12-jiyo-1", lesson: 12, title: "-지요: формы и времена", desc: "Основа + -지요, прошедшее и будущее время", ready: true },
  { id: null, lesson: 12, title: "Вопросительные слова с -지요", desc: "누구, 언제, 어디, 얼마…", ready: false },
  { id: null, lesson: 12, title: "Значения -지요 в диалогах", desc: "Подтверждение, смягчение, приглашение", ready: false }
];
window.HOMEWORK = [
  { id: "hw12-1", lesson: "l12-jiyo", title: "12과 · упражнения 1–3 (-지요)", blocks: ["practice-0", "practice-1", "practice-2"], due: "срок не задан" },
  { id: "hw11-1", lesson: "l11-adaju", title: "2급 11과 · упражнения 1–5 (-아/어다 주다)", blocks: ["practice-0", "practice-1", "practice-2", "practice-3", "practice-4"], due: "срок не задан" },
  { id: "hw12-2", lesson: "l12-jiyo", title: "12과 · поговорить с партнёром", blocks: ["speak-0"], due: "срок не задан" }
];
