/* MIRAÉ · Stories. Course milestones come from the same KR progress store as course.html. */
(function () {
  "use strict";
  var $ = function (selector) { return document.querySelector(selector); };
  var key = "kr_story:" + ((window.KR && KR.user()) || "guest");
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
  var state = { step: Math.max(0, Math.min(2, Number(saved.step) || 0)), koreaStep: Math.max(0, Number(saved.koreaStep) || 0), xp: Math.max(0, Number(saved.xp) || 0), ready: !!saved.ready, arrived: !!saved.arrived };
  var cityScenes = [
    { npc: "СОРА · ЗНАКОМАЯ ЗАГОВОРИЛА ПЕРВОЙ", ko: "한국어를 공부해요?", ru: "Ты изучаешь корейский? Сора заметила учебник.", task: "ответь, что изучаешь корейский, используя -아요/어요.", answers: [["네, 한국어를 공부해요.", "Да, я изучаю корейский."], ["아니요, 영어를 공부해요.", "Нет, я изучаю английский."]], valid: ["한국어를공부해요", "네한국어공부해요"], hint: "Скажи 네 (да), 한국어 (корейский) и 공부해요 (изучаю)." },
    { npc: "СОРА · СПРАШИВАЕТ ДАЛЬШЕ", ko: "한국어를 얼마나 공부했어요?", ru: "Как долго ты изучаешь корейский?", task: "скажи, что учишься один год. Используй 년 и -았/었어요.", answers: [["일 년 공부했어요.", "Я учился(ась) один год."], ["한 달 공부했어요.", "Я учился(ась) один месяц."]], valid: ["일년공부했어요", "한국어를일년공부했어요", "일년동안공부했어요"], hint: "일 년 — один год; 공부했어요 — учился(ась)." },
    { npc: "СОРА · ЗАГОВОРИЛА О ПЛАНАХ", ko: "서울에 가고 싶어요?", ru: "Хочешь поехать в Сеул?", task: "ответь, что хочешь поехать в Сеул. Используй -고 싶어요.", answers: [["네, 서울에 가고 싶어요.", "Да, хочу поехать в Сеул."], ["집에 가고 싶어요.", "Хочу пойти домой."]], valid: ["서울에가고싶어요", "네서울에가고싶어요"], hint: "서울에 — в Сеул; 가고 싶어요 — хочу поехать." }
  ];
  var seoulScenes = {
    cafe: { npc: "ЮНА · СОСЕДКА ЗАГОВОРИЛА ПЕРВОЙ", ko: "카페가 어디에 있어요?", ru: "Где находится кафе? Юна спрашивает тебя у станции метро.", task: "подскажи, где кафе. Используй 여기 или 저기 и 있어요.", answers: [["저기 있어요.", "Вон там."], ["여기에 있어요.", "Оно здесь."]], valid: ["저기있어요", "여기에있어요", "카페는저기있어요"], hint: "여기 — здесь; 저기 — вон там; 있어요 — находится." },
    jiyo: { npc: "ЮНА · ПРОДОЛЖАЕТ РАЗГОВОР", ko: "한국어 공부가 재미있지요?", ru: "Учить корейский интересно, правда? Юна ждёт подтверждения.", task: "подтверди, что тебе интересно. Используй -지요.", answers: [["네, 재미있지요.", "Да, интересно, правда."], ["조금 어렵지만 재미있지요.", "Немного сложно, но интересно."]], valid: ["재미있지요", "네재미있지요", "조금어렵지만재미있지요"], hint: "К прилагательному 재미있다 добавь -지요: 재미있지요." },
    adaju: { npc: "ЮНА · ПРОСИТ О ПОМОЩИ", ko: "할머니께 차를 갖다 드릴까요?", ru: "Юна спрашивает, не отнести ли чай бабушке.", task: "предложи принести чай. Используй -아/어다 드리다.", answers: [["네, 제가 차를 갖다 드릴게요.", "Да, я принесу ей чай."], ["제가 차를 마셨어요.", "Я выпил(а) чай."]], valid: ["제가차를갖다드릴게요", "네제가차를갖다드릴게요", "차를가져다드릴게요"], hint: "갖다 드리다 — взять и принести старшему; 드릴게요 — я сделаю это для вас." }
  };
  function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} }
  function assignedCourseLessons() {
    if (!window.KR || !KR.user()) return [];
    var catalogs = [window.COURSE0, window.COURSE, window.COURSE2];
    var seen = {};
    var result = [];
    catalogs.forEach(function (course) {
      (course && course.lessons || []).forEach(function (lesson) {
        if (!lesson.id || seen[lesson.id] || !KR.can("lesson-" + lesson.id)) return;
        seen[lesson.id] = true;
        var p = KR.progress(lesson.id);
        result.push({
          id: lesson.id,
          title: lesson.title || lesson.tag || lesson.id,
          course: course.title || "Курс",
          n: p.n,
          total: p.tot,
          pct: p.pct,
          done: p.tot > 0 && p.pct >= 100
        });
      });
    });
    (window.MATERIALS || []).forEach(function (item) {
      if (item.section !== "course" || item.kind !== "lesson" || !item.id || item.id.indexOf("lesson-") !== 0) return;
      var id = item.id.slice("lesson-".length);
      if (seen[id] || !KR.can(item.id)) return;
      seen[id] = true;
      var p = KR.progress(id);
      result.push({
        id: id,
        title: item.title || id,
        course: item.level ? "Курс · " + item.level : "Основной курс",
        n: p.n,
        total: p.tot,
        pct: p.pct,
        done: p.tot > 0 && p.pct >= 100
      });
    });
    return result;
  }

  function courseState() {
    var lessons = assignedCourseLessons(), done = lessons.filter(function (lesson) { return lesson.done; });
    var blocksDone = lessons.reduce(function (sum, lesson) { return sum + lesson.n; }, 0);
    var blocksTotal = lessons.reduce(function (sum, lesson) { return sum + lesson.total; }, 0);
    var next = lessons.find(function (lesson) { return !lesson.done; }) || null;
    var doneIds = done.map(function (lesson) { return lesson.id; });
    return { lessons: lessons, done: done, next: next, blocksDone: blocksDone, blocksTotal: blocksTotal, pct: blocksTotal ? Math.round(blocksDone / blocksTotal * 100) : 0, seoul: done.length > 0, hasJiyo: doneIds.indexOf("l12-jiyo") >= 0, hasAdaju: doneIds.indexOf("l11-adaju") >= 0 };
  }
  function normalize(text) { return String(text || "").toLowerCase().replace(/[\s.,!?…'’“”]/g, ""); }
  function activeScene(info) {
    if (!state.arrived || !info.seoul) return cityScenes[state.step];
    var extra = [];
    if (info.hasJiyo) extra.push(seoulScenes.jiyo);
    if (info.hasAdaju) extra.push(seoulScenes.adaju);
    return [seoulScenes.cafe].concat(extra)[Math.min(state.koreaStep, extra.length)];
  }
  function setCourseCard(info) {
    var title = $("#courseTitle"), status = $("#courseStatus"), progress = $("#courseProgress"), link = $("#courseLink");
    if (!KR.user()) { title.textContent = "Свяжи историю с учёбой"; status.textContent = "Войди в кабинет, чтобы история увидела назначенные уроки и их прогресс."; progress.style.width = "0%"; link.href = "auth.html"; link.textContent = "Войти в кабинет"; return; }
    if (!info.lessons.length) { title.textContent = "Корейский курс пока не открыт"; status.textContent = "Когда преподаватель назначит уроки, их завершение будет открывать новые сцены."; progress.style.width = "0%"; link.href = "course.html"; link.textContent = "Открыть курс"; return; }
    title.textContent = "Прогресс курса";
    status.textContent = "Завершено уроков: " + info.done.length + " из " + info.lessons.length + " · выполнено блоков: " + info.blocksDone + " из " + info.blocksTotal + ".";
    progress.style.width = info.pct + "%";
    link.href = info.next ? "lesson.html?l=" + encodeURIComponent(info.next.id) : "course.html";
    link.textContent = info.next ? "Продолжить: " + info.next.title : "Открыть курс";
  }
  function setMap(info) {
    var seoul = $("#seoul"); seoul.className = info.seoul ? "active" : "locked";
    seoul.innerHTML = "<b>♧ Сеул, Корея</b>" + (info.seoul ? "Глава открыта · новая соседка" : "Откроется после первого завершённого урока");
    var extra = $("#advancedMap");
    if (extra) { var labels = []; if (info.hasJiyo) labels.push("-지요? · подтверждение"); if (info.hasAdaju) labels.push("-아/어다 주다 · помощь соседке"); extra.className = labels.length ? "active" : "locked"; extra.innerHTML = "<b>✦ Новые диалоги</b>" + (labels.length ? labels.join(" · ") : "Откроются после связанных уроков курса"); }
  }
  function render() {
    var info = courseState(), scene = activeScene(info), isSeoul = state.arrived && info.seoul;
    $("#chapter").textContent = isSeoul ? "Глава 2 · В Корее" : "Глава 1 · До Кореи";
    $("#title").textContent = isSeoul ? "Новый разговор в Сеуле" : "Случайная встреча";
    $("#scene").classList.toggle("korea", isSeoul); $("#place").textContent = isSeoul ? "📍 Сеул · у станции метро" : "📍 Твой город · книжный";
    $("#npc").textContent = scene.npc; $("#ko").textContent = scene.ko; $("#ru").textContent = scene.ru; $("#task").innerHTML = "<b>Твоя задача:</b> " + scene.task;
    $("#answers").innerHTML = "";
    scene.answers.forEach(function (answer) { var button = document.createElement("button"); button.type = "button"; button.innerHTML = answer[0] + "<small>" + answer[1] + "</small>"; button.addEventListener("click", function () { checkAnswer(answer[0]); }); $("#answers").appendChild(button); });
    $("#progress").style.width = (isSeoul ? 70 + Math.min(25, state.koreaStep * 12) : 12 + (state.step + 1) * 18) + "%";
    $("#xp").textContent = state.xp;
    $("#status").textContent = info.seoul ? "Сеул открыт по прогрессу курса. Пройдено связанных уроков: " + info.done.length + "." : "Первый назначенный урок завершён: " + info.done.length + ". Это откроет переезд в Сеул.";
    $("#next").classList.remove("show"); $("#next").textContent = isSeoul ? "Продолжить разговор →" : "Продолжить →";
    $("#feedback").textContent = ""; $("#feedback").className = "story-feedback";
    setCourseCard(info); setMap(info);
  }
  function showGate(info) {
    var modal = $("#modal"), action = $("#modalAction");
    $("#modalTitle").textContent = info.seoul ? "Ты готов(а) к Сеулу" : "Продолжи урок, чтобы переехать";
    $("#modalText").textContent = info.seoul ? "Первый назначенный корейский урок завершён. Теперь Сора прощается, а в Сеуле начинается новая глава." : "Сора уже знает, что ты изучаешь корейский. Закончи первый назначенный урок в курсе, чтобы открыть Сеул и продолжить историю.";
    $("#modalCourse").textContent = info.next ? "Следующий урок: " + info.next.course + " · " + info.next.title + " (" + info.next.n + " из " + info.next.total + " блоков)." : (info.lessons.length ? "Все назначенные уроки завершены." : "Войди в кабинет и дождись, когда преподаватель назначит корейский урок.");
    action.textContent = info.seoul ? "Открыть главу «В Корее»" : (info.next ? "Продолжить урок курса" : "Открыть курс");
    action.href = info.seoul ? "#" : (!KR.user() ? "auth.html" : (info.next ? "lesson.html?l=" + encodeURIComponent(info.next.id) : "course.html"));
    modal.classList.add("show");
  }
  function renderKeepFeedback() {
    var info = courseState(), scene = activeScene(info);
    $("#answers").innerHTML = "";
    scene.answers.forEach(function (answer) { var button = document.createElement("button"); button.type = "button"; button.innerHTML = answer[0] + "<small>" + answer[1] + "</small>"; button.addEventListener("click", function () { checkAnswer(answer[0]); }); $("#answers").appendChild(button); });
    $("#xp").textContent = state.xp;
  }
  function checkAnswer(raw) {
    var scene = activeScene(courseState()), value = normalize(raw);
    if (!scene.valid.some(function (candidate) { return value.indexOf(normalize(candidate)) >= 0; })) { $("#feedback").className = "story-feedback bad"; $("#feedback").textContent = "Почти. Проверь слова и окончание; подсказка поможет."; return; }
    state.xp += 10; save(); $("#feedback").className = "story-feedback"; $("#feedback").textContent = "Собеседница поняла тебя. Хорошая работа!";
    $("#next").classList.add("show"); if (!state.arrived && state.step === 2) $("#next").textContent = "Проверить прогресс курса →"; renderKeepFeedback();
  }
  $("#form").addEventListener("submit", function (event) { event.preventDefault(); var value = $("#answer").value.trim(); if (!value) return; checkAnswer(value); $("#answer").value = ""; });
  $("#hint").addEventListener("click", function () { $("#feedback").className = "story-feedback"; $("#feedback").textContent = "Подсказка: " + activeScene(courseState()).hint; });
  $("#next").addEventListener("click", function () {
    var info = courseState();
    if (!state.arrived) { if (state.step < cityScenes.length - 1) { state.step += 1; save(); render(); } else { state.ready = true; save(); showGate(info); } return; }
    var extras = []; if (info.hasJiyo) extras.push(seoulScenes.jiyo); if (info.hasAdaju) extras.push(seoulScenes.adaju);
    if (state.koreaStep < extras.length) { state.koreaStep += 1; save(); render(); }
    else { $("#feedback").textContent = "Этот диалог пройден. Новые сцены появятся вместе с уроками курса."; $("#next").classList.remove("show"); }
  });
  $("#modalAction").addEventListener("click", function (event) { var info = courseState(); if (!info.seoul) return; event.preventDefault(); state.arrived = true; state.koreaStep = 0; save(); $("#modal").classList.remove("show"); render(); $("#feedback").textContent = "Ты переехал(а) в Сеул. Юна начинает разговор."; });
  $("#modalClose").addEventListener("click", function () { $("#modal").classList.remove("show"); });
  function initSpeech() {
    var button = $("#mic"), install = $("#installSpeech"), note = $("#speechNote");
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || !Recognition.prototype || !("processLocally" in Recognition.prototype) || typeof Recognition.available !== "function") { button.disabled = true; note.textContent = "В этом браузере нет локального распознавания корейской речи. Можно ответить текстом или выбрать реплику."; return; }
    Recognition.available({ langs: ["ko-KR"], processLocally: true }).then(function (availability) {
      if (availability === "available") { button.disabled = false; note.textContent = "Голос распознаётся на устройстве. Нажми микрофон и разреши браузеру доступ к нему."; }
      else if ((availability === "downloadable" || availability === "downloading") && typeof Recognition.install === "function") { button.disabled = true; install.hidden = false; note.textContent = "Для локального распознавания нужен корейский языковой пакет. Установи его кнопкой ниже или ответь текстом."; }
      else { button.disabled = true; note.textContent = "Локальный пакет корейского языка недоступен в этом браузере. Можно ответить текстом или выбрать реплику."; }
    }).catch(function () { button.disabled = true; note.textContent = "Не удалось проверить локальное распознавание. Можно ответить текстом или выбрать реплику."; });
    install.addEventListener("click", function () {
      if (typeof Recognition.install !== "function") return;
      install.disabled = true; note.textContent = "Устанавливаю языковой пакет для обработки речи на устройстве…";
      Recognition.install({ langs: ["ko-KR"], processLocally: true }).then(function (installed) {
        install.disabled = false; install.hidden = true;
        if (installed) { button.disabled = false; note.textContent = "Пакет установлен на устройстве. Нажми микрофон, чтобы сказать фразу."; }
        else note.textContent = "Пакет не установлен. Можно ответить текстом или выбрать реплику.";
      }).catch(function () { install.disabled = false; note.textContent = "Не удалось установить пакет. Можно ответить текстом или выбрать реплику."; });
    });
    button.addEventListener("click", function () {
      var recognition = new Recognition(); recognition.lang = "ko-KR"; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 3; recognition.processLocally = true;
      button.disabled = true; note.textContent = "Слушаю корейскую фразу…";
      recognition.onresult = function (event) { var transcript = event.results && event.results[0] && event.results[0][0] && event.results[0][0].transcript; if (transcript) { $("#answer").value = transcript.trim(); $("#answer").focus(); note.textContent = "Распознано: «" + transcript.trim() + "». Проверь фразу и нажми «Ответить»."; } };
      recognition.onerror = function (event) {
        var messages = { "not-allowed": "Разреши доступ к микрофону в настройках браузера и попробуй ещё раз.", "no-speech": "Речь не услышана. Попробуй сказать фразу ещё раз.", "language-not-supported": "Корейский языковой пакет ещё не готов. Установи его кнопкой ниже.", "service-not-allowed": "Браузер не разрешил локальное распознавание. Используй текстовый ответ." };
        note.textContent = messages[event.error] || "Не удалось распознать речь. Можно ответить текстом."; if (event.error === "language-not-supported") install.hidden = false;
      };
      recognition.onend = function () { button.disabled = false; };
      try { recognition.start(); } catch (error) { button.disabled = false; note.textContent = "Не удалось запустить микрофон. Проверь разрешение браузера или ответь текстом."; }
    });
  }
  if (window.KR) { KR.topbar("story"); if (KR.user()) KR.load().then(render).catch(render); else render(); }
  initSpeech(); window.addEventListener("pageshow", render);
})();
