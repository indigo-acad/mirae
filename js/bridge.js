/* MIRAÉ · мост между материалами (папка materials/: тесты, тренажёры, игры) и сайтом.
   Подключается в начале <body> каждого материала: <script src="../../../js/bridge.js"></script>
   (ставит tools/inject.py). Работает, только если ученик вошёл на сайт: в localStorage есть kr_user и kr_pin.

   Что делает:
   1) Считает открытия материала и время занятий: секунды идут, пока вкладка видна и ученик что-то делает
      (последнее касание, клавиша или прокрутка не старше 3 минут).
   2) Ловит «Отправить учителю». Материалы шлют отчёт Telegram-боту; мост сохраняет тот же текст в записи ученика,
      и преподаватель видит его в панели «Ученики», даже если Telegram не дошёл. Если Telegram не ответил или ответил
      ошибкой, а сайт отчёт сохранил, материал получает ответ «отправлено» и показывает ученику успех.
   Где хранится: общая запись ученика в Supabase (save_progress, site = "school"), ключи state.mat и state.rep,
   на устройстве — localStorage "kr_mat:<логин>". Правила слияния те же, что в js/common.js (mergeMat, mergeRep). */
/* Домашка с отдельными заданиями. Преподаватель может задать не весь тренажёр, а только выбранные задания
   («Задать домашку» → тренажёр → «выбрать отдельные»). Работает с любым материалом, в том числе с новыми:

   1) Список заданий. Панель преподавателя открывает материал в скрытой рамке с ?mirae-parts=<метка>; здесь материал
      ничего не отправляет и не сохраняет, а после загрузки отдаёт родителю список заданий (postMessage):
      - если материал сам объявил window.MIRAE_PARTS = [{g: "группа", t: [{k: "ключ", n: "название"}]}] — его;
      - иначе список собирается сам: шаги пути слов (глобальный массив STEPS с key/name/set, как в тренажёрах слов)
        и вкладки (nav button[data-tab] с разделом #tab-<имя>).
   2) Домашка. Ссылка из домашки открывает материал с ?hw=<номер>&only=<ключ,ключ,…>:
      - window.MIRAE_PICK: has(k), keep(arr, key) — оставить в массиве (на месте) только выбранное, key(x, i) — ключ
        по исходному номеру, возвращает исходные номера; take(arr, ix) — то же по номерам (для параллельных массивов);
        tabs({вкладка: число заданий}) — спрятать пустые вкладки. Материал со своим MIRAE_PARTS фильтрует сам, до первой
        отрисовки; если он этого не сделал, после загрузки сами отфильтруются STEPS и вкладки;
      - прогресс домашки хранится отдельно от обычного прохождения: ключи localStorage материала (кроме kr_… сайта)
        и облачная запись материала (load_progress / save_progress с его p_site) получают добавку ":hw<номер>";
      - сверху плашка «Домашка от преподавателя» со ссылкой на весь тренажёр. */
(function () {
  "use strict";
  var q; try { q = new URLSearchParams(location.search) } catch (e) { return }
  var path = location.pathname, at = path.indexOf("/materials/");
  var MID = at < 0 ? "" : (path.slice(at + 11).split("/")[1] || "").trim();

  // ---------- общий разбор заданий ----------
  function glob(name) { try { return (0, eval)("typeof " + name + " !== 'undefined' ? " + name + " : undefined") } catch (e) { return undefined } }
  var clean = function (s) { return String(s == null ? "" : s).replace(/^[^0-9A-Za-zА-Яа-яЁёㄱ-ㆎ가-힣]+/, "").trim() };
  function tabBtns() { return [].slice.call(document.querySelectorAll("nav [data-tab], [role=tablist] [data-tab]")).filter(function (b) { return document.getElementById("tab-" + b.dataset.tab) }) }
  function stepsOf() { var S = glob("STEPS"); return Array.isArray(S) && S.length && S.every(function (x) { return x && x.key && x.name }) ? S : null }
  function autoParts() {
    var out = [], S = stepsOf(), groups = {}, order = [];
    if (S) S.forEach(function (x) {
      var g = x.set && x.set.name ? "Слова · " + x.set.name : "Итоговые задания";
      if (!groups[g]) { groups[g] = []; order.push(g) }
      groups[g].push({ k: "v:" + x.key, n: clean(x.name) });
    });
    order.forEach(function (g) { out.push({ g: g, t: groups[g] }) });
    var pathTab = null, p = document.getElementById("path");
    if (S && p) { var sec = p.closest("[id^='tab-']"); if (sec) pathTab = sec.id.slice(4) }
    var tabs = tabBtns().filter(function (b) { return b.dataset.tab !== pathTab && !/finish|send|result|итог/i.test(b.dataset.tab) })
      .map(function (b) { return { k: "t:" + b.dataset.tab, n: clean(b.textContent) || b.dataset.tab } });
    if (tabs.length) out.push({ g: "Разделы", t: tabs });
    return out;
  }
  function partsNow() {
    var P = window.MIRAE_PARTS;
    if (Array.isArray(P)) return P.filter(function (g) { return g && Array.isArray(g.t) && g.t.length })
      .map(function (g) { return { g: String(g.g || ""), t: g.t.map(function (x) { return { k: String(x.k), n: clean(x.n) || String(x.k) } }) } });
    return autoParts();
  }

  // ---------- 1) список заданий для панели преподавателя ----------
  var ask = q.get("mirae-parts");
  if (ask !== null) {
    window.MIRAE_DISCOVER = true;
    var noop = function () {};
    window.alert = noop; window.confirm = function () { return false }; window.prompt = function () { return null };
    try { Storage.prototype.setItem = noop; Storage.prototype.removeItem = noop } catch (e) {}   // у преподавателя ничего не меняется
    try { if (window.speechSynthesis) window.speechSynthesis.speak = noop } catch (e) {}
    var rf = window.fetch && window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var same = false; try { same = new URL(url, location.href).origin === location.origin } catch (e) {}
      return same && rf && !(init && init.method && init.method !== "GET") ? rf(input, init) : new Promise(function () {});
    };
    var sent = false;
    var send = function () {
      if (sent) return; sent = true;
      var parts = []; try { parts = partsNow() } catch (e) {}
      try { parent.postMessage({ mirae: "parts", ask: ask, id: MID, parts: parts }, location.origin) } catch (e) {}
    };
    window.addEventListener("load", function () { setTimeout(send, 400) });
    setTimeout(send, 8000);
    return;
  }

  // ---------- 2) домашка с выбранными заданиями ----------
  var only = q.get("only"); if (!only) return;
  var set = {}, n = 0;
  only.split(",").forEach(function (k) { k = k.trim(); if (k && set[k] !== 1) { set[k] = 1; n++ } });
  if (!n) return;
  var hw = (q.get("hw") || "").replace(/[^0-9a-z_-]/gi, "").slice(0, 20), SUF = ":hw" + (hw || "x");
  var P = window.MIRAE_PICK = {
    hw: hw, n: n, suffix: SUF, used: false,
    has: function (k) { return set[k] === 1 },
    take: function (arr, ix) { P.used = true; var c = ix.map(function (i) { return arr[i] }); arr.length = 0; Array.prototype.push.apply(arr, c); return arr },
    keep: function (arr, key) { var ix = []; for (var i = 0; i < arr.length; i++) if (set[key(arr[i], i)] === 1) ix.push(i); P.take(arr, ix); return ix },
    tabs: function (map) {
      P.used = true; var first = null, act = null;
      Object.keys(map).forEach(function (t) {
        var b = document.querySelector('[data-tab="' + t + '"]'), sec = document.getElementById("tab-" + t);
        if (!map[t]) { if (b) b.style.display = "none"; if (sec) sec.classList.add("hidden"); return }
        if (b && !first) first = b;
        if (b && b.classList.contains("active")) act = b;
      });
      if (first && !act) first.click();
    }
  };
  // прогресс домашки отдельно: свои ключи материала в localStorage и его облачная запись
  var mine = function (k) { k = String(k); return k.indexOf("kr_") !== 0 && k.slice(-SUF.length) !== SUF };
  try {
    var SP = Storage.prototype, gI = SP.getItem, sI = SP.setItem, rI = SP.removeItem;
    SP.getItem = function (k) { return gI.call(this, this === window.localStorage && mine(k) ? k + SUF : k) };
    SP.setItem = function (k, v) { return sI.call(this, this === window.localStorage && mine(k) ? k + SUF : k, v) };
    SP.removeItem = function (k) { return rI.call(this, this === window.localStorage && mine(k) ? k + SUF : k) };
  } catch (e) {}
  if (window.fetch) {
    var f0 = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (/\/rest\/v1\/rpc\/(load_progress|save_progress)\b/.test(url) && init && typeof init.body === "string") {
          var b = JSON.parse(init.body);
          if (b && typeof b.p_site === "string" && b.p_site !== "school" && b.p_site.slice(-SUF.length) !== SUF) {
            b.p_site += SUF; init = Object.assign({}, init, { body: JSON.stringify(b) });
          }
        }
      } catch (e) {}
      return f0(input, init);
    };
  }
  // материал без своего фильтра: после загрузки оставить выбранные шаги пути и вкладки
  function auto() {
    if (P.used) return;
    var S = stepsOf();
    if (S) { P.keep(S, function (x) { return "v:" + x.key }); var r = glob("renderPath"); if (typeof r === "function") try { r() } catch (e) {} }
    var pathTab = null, p = document.getElementById("path");
    if (S && p) { var sec = p.closest("[id^='tab-']"); if (sec) pathTab = sec.id.slice(4) }
    var map = {};
    tabBtns().forEach(function (b) { var t = b.dataset.tab; map[t] = t === pathTab ? S.length : /finish|send|result|итог/i.test(t) || set["t:" + t] === 1 ? 1 : 0 });
    if (Object.keys(map).length) P.tabs(map);
  }
  function banner() {
    if (document.getElementById("mirae-pick")) return;
    var box = document.getElementById("app") || document.body, d = document.createElement("div");
    d.id = "mirae-pick";
    d.style.cssText = "margin:10px 0 14px;padding:12px 16px;border-radius:12px;background:#FFF6E3;border:1.5px solid #D4AF7C;color:#0B1535;font:15px/1.45 system-ui,sans-serif";
    d.innerHTML = "<b>📌 Домашка от преподавателя.</b> Здесь только задания, которые выбрал преподаватель (" + n + "). " +
      "Сделай их и нажми «Отправить учителю». <a href=\"" + location.pathname + "\" style=\"color:#1E2A56\">Открыть весь тренажёр</a>";
    var h = box.querySelector("header");
    if (h && h.parentNode === box) box.insertBefore(d, h.nextSibling); else box.insertBefore(d, box.firstChild);
  }
  function ready() { banner(); auto() }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();

(function () {
  "use strict";
  var path = location.pathname, at = path.indexOf("/materials/");
  if (at < 0 || !window.fetch) return;
  var ROOT = path.slice(0, at + 1);                                  // корень сайта
  var MID = (path.slice(at + 11).split("/")[1] || "").trim();        // materials/<раздел>/<id>/ → id
  if (!MID || window.MIRAE_DISCOVER) return;   // список заданий для панели преподавателя: ничего не считаем и не сохраняем
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) {} return null }
  var USER = ls("kr_user"), PIN = ls("kr_pin");
  if (!USER || !PIN) return;
  var KEY = "kr_mat:" + USER, now = function () { return Date.now() };

  // ---------- слияние (как в js/common.js) ----------
  function mergeMat(a, b) {
    a = a || {}; b = b || {}; var out = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function (id) {
      var x = a[id] || {}, y = b[id] || {};
      out[id] = { o: Math.max(x.o || 0, y.o || 0), s: Math.max(x.s || 0, y.s || 0), l: Math.max(x.l || 0, y.l || 0),
                  f: Math.min(x.f || Infinity, y.f || Infinity) };
      if (out[id].f === Infinity) out[id].f = out[id].l;
    });
    return out;
  }
  function mergeRep(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (r) {
      if (!r || !r.id) return;
      var k = seen[r.id];
      if (k === undefined) { seen[r.id] = out.length; out.push(r) }
      else if (r.u || out[k].u) { if ((r.u || 0) > (out[k].u || 0)) out[k] = r }   // живой отчёт: берём более свежий
      else if ((r.x || "").length > (out[k].x || "").length) out[k] = r;   // длинная версия: отчёт, собранный из частей
    });
    out.sort(function (x, y) { return (y.t || 0) - (x.t || 0) });
    var total = 0;
    return out.filter(function (r, i) { total += (r.x || "").length; return i < 40 && total < 90000 });
  }
  function readLocal() { try { var v = JSON.parse(ls(KEY) || "{}"); return { mat: v.mat || {}, rep: v.rep || [] } } catch (e) { return { mat: {}, rep: [] } } }
  function writeLocal(s) { ls(KEY, JSON.stringify({ mat: s.mat || {}, rep: s.rep || [] })) }

  var realFetch = window.fetch.bind(window);

  // ---------- облако: адрес и ключ берём из js/config.js, не трогая глобальные переменные материала ----------
  var cfgP = null;
  function config() {
    if (!cfgP) cfgP = realFetch(ROOT + "js/config.js", { cache: "no-cache" }).then(function (r) { return r.ok ? r.text() : "" }).then(function (t) {
      var w = {}; try { new Function("window", t)(w) } catch (e) {}
      var c = w.CONFIG || {}; return c.SUPABASE_URL && c.SUPABASE_ANON_KEY ? c : null;
    }).catch(function () { return null });
    return cfgP;
  }
  function rpc(c, fn, body) {
    return realFetch(c.SUPABASE_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: c.SUPABASE_ANON_KEY, Authorization: "Bearer " + c.SUPABASE_ANON_KEY }, body: JSON.stringify(body) })
      .then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error("http " + r.status); return t ? JSON.parse(t) : null }) });
  }
  var pushing = null, again = false;
  function push() {
    if (pushing) { again = true; return pushing }
    pushing = config().then(function (c) {
      if (!c) return false;
      var site = { p_site: "school", p_name: USER, p_pin: PIN };
      return rpc(c, "load_progress", site).then(function (remote) {
        if (!remote) return false;                                     // нет записи ученика на сайте: ничего не создаём
        var loc = readLocal(), mat = mergeMat(remote.mat, loc.mat), rep = mergeRep(remote.rep, loc.rep);
        var st = Object.assign({}, remote, { mat: mat, rep: rep });
        return rpc(c, "save_progress", Object.assign({ p_state: st }, site)).then(function () { writeLocal({ mat: mat, rep: rep }); dirty = false; return true });
      });
    }).catch(function () { return false }).then(function (ok) {
      pushing = null; if (again) { again = false; return push() } return ok;
    });
    return pushing;
  }

  // ---------- 1) открытия и время ----------
  var dirty = true, lastAct = now();
  function touch(sec) {
    var s = readLocal(), m = s.mat[MID] || { o: 0, s: 0, f: now(), l: now() };
    if (sec < 0) m.o = (m.o || 0) + 1; else m.s = (m.s || 0) + sec;
    m.l = now(); if (!m.f) m.f = m.l; s.mat[MID] = m; writeLocal(s); dirty = true;
  }
  touch(-1);
  ["pointerdown", "keydown", "touchstart", "wheel", "input"].forEach(function (ev) {
    addEventListener(ev, function () { lastAct = now() }, { passive: true, capture: true });
  });
  setInterval(function () {
    if (document.visibilityState === "visible" && now() - lastAct < 180000) touch(15);
  }, 15000);
  setTimeout(push, 4000);
  setInterval(function () { if (dirty) push() }, 120000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden" && dirty) push() });

  // ---------- живой отчёт: материал сам сообщает результаты по ходу работы ----------
  // window.MIRAE.live(text) — отчёт этой попытки (одна запись на открытие страницы, каждый раз перезаписывается
  // свежей версией). Сохраняется на устройстве сразу, в облако — через 4 секунды после последнего ответа
  // и при уходе со страницы. window.MIRAE.user — логин ученика.
  var LIVE_ID = MID + "-live-" + now().toString(36), liveT = 0, liveTm = null;
  window.MIRAE = {
    user: USER,
    live: function (text) {
      var x = String(text || "").slice(0, 16000); if (!x) return;
      var s = readLocal(), t = now(); if (!liveT) liveT = t;
      s.rep = s.rep.filter(function (r) { return r.id !== LIVE_ID });
      s.rep.unshift({ id: LIVE_ID, m: MID, t: t, u: t, x: x });
      s.rep = mergeRep(s.rep, []); writeLocal(s); dirty = true;
      clearTimeout(liveTm); liveTm = setTimeout(push, 4000);
    },
    flush: function () { return push() }
  };

  // ---------- 2) «Отправить учителю» ----------
  function textOf(b) {
    try {
      if (!b) return "";
      if (typeof URLSearchParams !== "undefined" && b instanceof URLSearchParams) return b.get("text") || "";
      if (typeof FormData !== "undefined" && b instanceof FormData) return String(b.get("text") || "");
      if (typeof b === "string") { try { var j = JSON.parse(b); if (j && j.text) return String(j.text) } catch (e) {} return new URLSearchParams(b).get("text") || "" }
    } catch (e) {}
    return "";
  }
  function plain(t) {
    return String(t).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
  }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return h.toString(36) }
  // Длинный отчёт материалы режут на части до 3800 знаков и шлют подряд. Следующая часть приклеивается к отчёту,
  // только если предыдущая была длинной (от 3000 знаков) и пришла не раньше чем 30 секунд назад.
  var lastRep = null;
  function addReport(text) {
    var x = plain(text).slice(0, 8000); if (!x) return;
    var s = readLocal(), t = now();
    if (lastRep && t - lastRep.t < 30000 && lastRep.raw >= 3000) {
      s.rep.forEach(function (r) { if (r.id === lastRep.id) r.x = (r.x + "\n" + x).slice(0, 16000) });
      lastRep.t = t; lastRep.raw = String(text).length;
    } else {
      lastRep = { id: MID + "-" + hash(x), t: t, raw: String(text).length };
      s.rep = s.rep.filter(function (r) { return r.id !== lastRep.id });
      s.rep.unshift({ id: lastRep.id, m: MID, t: t, x: x });
    }
    s.rep = mergeRep(s.rep, []); writeLocal(s); dirty = true;
  }
  function sentOk() { return new Response(JSON.stringify({ ok: true, result: { message_id: 0 }, mirae: "saved" }), { status: 200, headers: { "Content-Type": "application/json" } }) }
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (!/api\.telegram\.org\/bot[^/]*\/sendMessage/.test(url)) return realFetch(input, init);
    // отчёт из домашки с выбранными заданиями: пометка сверху (если материал не поставил её сам)
    if (window.MIRAE_PICK && init && init.body) try {
      var b0 = init.body, t0 = textOf(b0);
      if (t0 && !/домашка/i.test(t0.slice(0, 300)) && ((typeof URLSearchParams !== "undefined" && b0 instanceof URLSearchParams) || (typeof FormData !== "undefined" && b0 instanceof FormData)))
        b0.set("text", "📌 Домашка: выбранные задания\n" + t0);
    } catch (e) {}
    var text = textOf(init && init.body);
    if (text) addReport(text);
    var saved = text ? push() : Promise.resolve(false);
    return new Promise(function (resolve, reject) {
      var done = false;
      function fin(v, bad) { if (done) return; done = true; if (bad) reject(v); else resolve(v) }
      realFetch(input, init).then(function (res) {
        res.clone().json().then(function (j) { return res.ok && j && j.ok }, function () { return false }).then(function (good) {
          // бот ответил: ждём сохранения на сайте (до 4 секунд), чтобы отчёт не потерялся, если ученик сразу закроет вкладку
          if (good) { var tm = setTimeout(function () { fin(res) }, 4000); saved.then(function () { clearTimeout(tm); fin(res) }) }
          else saved.then(function (ok) { fin(ok ? sentOk() : res) });
        });
      }, function (err) { saved.then(function (ok) { if (ok) fin(sentOk()); else fin(err, true) }) });
      // Telegram может долго не отвечать: если отчёт уже на сайте, ученику незачем ждать
      setTimeout(function () { saved.then(function (ok) { if (ok) fin(sentOk()) }) }, 9000);
    });
  };
})();

/* ---------- 4) «В словарь»: слова материала в словарь ученика ----------
   В материалах со словами (тренажёры слов, видео-уроки, тесты по лексике) внизу справа появляется кнопка «В словарь».
   Она открывает список слов материала с галочками; отмеченные слова ждут в localStorage «kr_vinbox:<ученик>», а
   js/vocab.js забирает их, как только ученик откроет страницу сайта со словарём (кабинет, «Слова», урок).
   Слова, которые уже есть в словаре на этом устройстве, отмечены «уже в словаре».
   Откуда список (первое, что нашлось):
   - window.MIRAE_WORDS — материал объявил сам: [{w, t, ex, et}] или [{g: "группа", words: [...]}], можно функцией;
   - SETS — наборы слов тренажёров ({name, words: [{ko|en, ru, ex, exRu}]}), LESSONS с полем words;
   - WORDS — список теста ({ko|en, ru} или ["слово", "перевод"]);
   - EPS — видео-уроки и дорамы: пары «слово — перевод» из заданий-сопоставлений (match), группа — серия;
   - ALL — общий список игр. */
(function () {
  "use strict";
  var path = location.pathname, at = path.indexOf("/materials/");
  if (at < 0 || window.MIRAE_DISCOVER || window.top !== window.self) return;
  var ROOT = path.slice(0, at + 1), MID = (path.slice(at + 11).split("/")[1] || "").trim();
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch (e) {} return null }
  function glob(name) { try { return (0, eval)("typeof " + name + " !== 'undefined' ? " + name + " : undefined") } catch (e) { return undefined } }
  var HAN = /[가-힣]/, LAT = /[A-Za-z]/, CYR = /[А-Яа-яЁё]/;
  var txt = function (s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() };
  var norm = function (w) { return String(w).normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase() };
  var langOf = function (s) { return HAN.test(s) ? "ko" : LAT.test(s) ? "en" : "" };
  function item(x) {
    if (!x) return null;
    var w, t, ex, et;
    if (Array.isArray(x)) { w = x[0]; t = x[1] }
    else if (typeof x === "object") { w = x.ko || x.en || x.w || x.word || x.term; t = x.ru || x.t || x.tr || x.translation || x.def; ex = x.ex || x.e; et = x.exRu || x.exru || x.et }
    w = txt(w); t = txt(t); if (!w || w.length > 80 || CYR.test(w)) return null;
    var l = langOf(w); if (!l) return null;
    var o = { l: l, w: w, t: "" };
    if (t && CYR.test(t)) o.t = t.slice(0, 300);
    else if (t && t.length > w.length + 6 && /\s/.test(t) && langOf(t)) o.d = [{ l: langOf(t), s: t.slice(0, 300) }];   // определение на изучаемом языке
    else if (t) return null;                                   // «손을 — 잡다»: это не перевод
    ex = txt(ex); if (ex && langOf(ex) === l) { o.ex = ex.slice(0, 240); et = txt(et); if (et) o.et = et.slice(0, 240) }
    return o;
  }
  function groups() {
    var out = [], add = function (g, arr) { var ws = (arr || []).map(item).filter(Boolean); if (ws.length) out.push({ g: txt(g) || "Слова", w: ws }) };
    var M = window.MIRAE_WORDS; if (typeof M === "function") try { M = M() } catch (e) { M = null }
    if (Array.isArray(M)) {
      if (M.some(function (x) { return x && Array.isArray(x.words) })) M.forEach(function (x) { if (x) add(x.g || x.name, x.words) });
      else add(document.title, M);
      return out;
    }
    var S = glob("SETS");
    if (Array.isArray(S)) S.forEach(function (s) { if (s && Array.isArray(s.words)) add(s.name || s.title || s.id, s.words) });
    var Ls = glob("LESSONS");
    if (Array.isArray(Ls)) Ls.forEach(function (s) { if (s && Array.isArray(s.words)) add(s.name || s.title || s.id, s.words) });
    if (out.length) return out;
    var W = glob("WORDS"); if (Array.isArray(W)) add("Слова", W);
    if (out.length) return out;
    var E = glob("EPS");
    if (Array.isArray(E)) E.forEach(function (ep) {
      if (!ep || !Array.isArray(ep.tasks)) return; var a = [];
      ep.tasks.forEach(function (t) { if (t && t.t === "match" && Array.isArray(t.pairs)) a = a.concat(t.pairs) });
      add((ep.no != null ? ep.no + ". " : "") + (ep.tt || ep.title || "") + (ep.ru ? " · " + ep.ru : ""), a);
    });
    if (out.length) return out;
    var A = glob("ALL"); if (Array.isArray(A)) add("Слова", A);
    return out;
  }
  function have() {   // id слов, которые уже в словаре на этом устройстве или ждут добавления
    var u = ls("kr_user"), s = {}; if (!u) return s;
    try { var d = JSON.parse(ls("kr_vocab:" + u) || "{}"); Object.keys((d && d.w) || {}).forEach(function (k) { s[k] = 1 }) } catch (e) {}
    try { (JSON.parse(ls("kr_vinbox:" + u) || "[]") || []).forEach(function (x) { if (x && x.w) s[x.l + ":" + norm(x.w)] = 1 }) } catch (e) {}
    return s;
  }
  var host, root, G = [];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) };
  var CSS = ":host{all:initial}*{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,sans-serif}" +
    ".fab{position:fixed;right:14px;bottom:14px;z-index:99998;display:inline-flex;align-items:center;gap:6px;border:1px solid #D4AF7C;background:#0B1535;color:#F8F7F2;border-radius:999px;padding:9px 15px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(11,21,53,.35)}" +
    ".fab[hidden]{display:none}.fab b{color:#D4AF7C;font-size:17px;line-height:1}.fab:focus-visible,button:focus-visible{outline:2px solid #D4AF7C;outline-offset:2px}" +
    ".sheet{position:fixed;right:12px;bottom:12px;z-index:99999;width:min(440px,calc(100vw - 24px));max-height:min(78vh,640px);display:flex;flex-direction:column;background:#F8F7F2;color:#0B1535;border:1px solid #D4AF7C;border-radius:18px;box-shadow:0 18px 50px rgba(11,21,53,.4);overflow:hidden}" +
    ".hd{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px 10px;background:#0B1535;color:#F8F7F2}.hd h2{margin:0;font:600 20px 'Cormorant Garamond',Georgia,serif;color:#D4AF7C}" +
    ".x{border:0;background:transparent;color:#F8F7F2;font-size:22px;cursor:pointer;padding:2px 6px}" +
    ".bd{overflow:auto;padding:8px 16px}.ft{padding:10px 16px 14px;border-top:1px solid #e3dccd;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}" +
    "details{border-bottom:1px solid #ebe5d8;padding:6px 0}summary{cursor:pointer;font-weight:600;padding:4px 0;list-style:revert}" +
    "label{display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:15px;line-height:1.35;cursor:pointer}label.dim{opacity:.55;cursor:default}" +
    "input{margin-top:3px;accent-color:#1E2A56}.ko{font-family:'Noto Sans KR',system-ui,sans-serif}small{color:#5b6178}.ga{font-weight:600}" +
    ".pri{border:0;background:#1E2A56;color:#F8F7F2;border-radius:999px;padding:9px 16px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}.pri:disabled{opacity:.5;cursor:default}" +
    ".lnk{border:0;background:none;color:#1E2A56;text-decoration:underline;cursor:pointer;font:500 13px Inter,system-ui,sans-serif;padding:0}" +
    ".msg{margin:0;font-size:14px;line-height:1.4}.msg a{color:#1E2A56}.ok{color:#1f6b3a}";
  function close() { if (!root) return; var s = root.querySelector(".sheet"); if (s) s.remove(); var f = root.querySelector(".fab"); if (f) { f.hidden = false; f.focus() } }
  function open() {
    G = groups(); if (!G.length) return;
    var H = have(), total = 0, seen = {};
    G.forEach(function (g) { g.w = g.w.filter(function (x) { var k = x.l + ":" + norm(x.w); if (seen[k]) return false; seen[k] = 1; x.k = k; x.has = !!H[k]; return true }); total += g.w.length });
    var small = total <= 60, user = ls("kr_user");
    var h = '<div class="sheet" role="dialog" aria-modal="false" aria-label="Слова в словарь"><div class="hd"><h2>Слова в словарь</h2><button class="x" data-x="close" aria-label="Закрыть">×</button></div><div class="bd">';
    if (!user) h += '<p class="msg">Чтобы сохранять слова в свой словарь, <a href="' + esc(ROOT) + 'auth.html" target="_top">войди в MIRAÉ</a>.</p>';
    h += G.map(function (g, gi) {
      var fresh = g.w.filter(function (x) { return !x.has }).length;
      return '<details' + (G.length === 1 || small ? " open" : "") + '><summary>' + esc(g.g) + ' <small>· ' + g.w.length + (fresh < g.w.length ? ", новых " + fresh : "") + '</small></summary>' +
        (fresh > 1 ? '<label class="ga"><input type="checkbox" data-ga="' + gi + '"' + (small ? " checked" : "") + '> Все слова группы</label>' : "") +
        g.w.map(function (x, i) {
          return '<label' + (x.has ? ' class="dim"' : "") + '><input type="checkbox" data-g="' + gi + '" data-i="' + i + '"' + (x.has ? " disabled checked" : small ? " checked" : "") + '><span><b' + (x.l === "ko" ? ' class="ko" lang="ko"' : ' lang="en"') + '>' + esc(x.w) + '</b> ' +
            (x.t ? "— " + esc(x.t) : x.d ? '— <span' + (x.d[0].l === "ko" ? ' class="ko"' : "") + '>' + esc(x.d[0].s) + "</span>" : "") + (x.has ? " <small>· уже в словаре</small>" : "") + "</span></label>";
        }).join("") + "</details>";
    }).join("");
    h += '</div><div class="ft"><p class="msg" id="m" role="status"></p><button class="pri" data-x="add"' + (user ? "" : " disabled") + '>Добавить</button></div></div>';
    var old = root.querySelector(".sheet"); if (old) old.remove();
    root.querySelector(".box").insertAdjacentHTML("beforeend", h); root.querySelector(".fab").hidden = true; count();
    var c = root.querySelector('[data-x="add"]'); if (c && !c.disabled) c.focus(); else root.querySelector(".x").focus();
  }
  function picked() { return [].slice.call(root.querySelectorAll("input[data-g]:checked:not(:disabled)")).map(function (b) { return G[+b.dataset.g].w[+b.dataset.i] }) }
  function count() { var b = root.querySelector('[data-x="add"]'); if (!b || !ls("kr_user")) return; var n = picked().length; b.disabled = !n; b.textContent = n ? "Добавить · " + n : "Отметь слова" }
  function add() {
    var u = ls("kr_user"), ws = picked(); if (!u || !ws.length) return;
    var k = "kr_vinbox:" + u, a = []; try { a = JSON.parse(ls(k) || "[]") || [] } catch (e) {}
    ws.forEach(function (x) { var o = { l: x.l, w: x.w, t: x.t, src: "mat:" + MID }; if (x.ex) { o.ex = x.ex; if (x.et) o.et = x.et } if (x.d) o.d = x.d; a.push(o) });
    ls(k, JSON.stringify(a.slice(-500)));
    open();
    var m = root.querySelector("#m"); if (m) { m.className = "msg ok"; m.innerHTML = "Добавлено: " + ws.length + ". Слова появятся в разделе <a href=\"" + esc(ROOT) + "words.html\" target=\"_top\">«Слова»</a> (блок новых слов), как только откроешь MIRAÉ." }
  }
  function init() {
    var g; try { g = groups() } catch (e) { g = [] }
    if (!g.length) return;
    host = document.createElement("div"); host.id = "mirae-words"; document.body.appendChild(host);
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    root.innerHTML = "<style>" + CSS + '</style><div class="box"></div><button class="fab" data-x="open" aria-haspopup="dialog" title="Добавить слова этого материала в свой словарь MIRAÉ"><b>＋</b> В словарь</button>';
    root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-x]"); if (!b) return;
      if (b.dataset.x === "open") open(); else if (b.dataset.x === "close") close(); else if (b.dataset.x === "add") add();
    });
    root.addEventListener("change", function (e) {
      var t = e.target; if (t.dataset.ga !== undefined) [].forEach.call(root.querySelectorAll('input[data-g="' + t.dataset.ga + '"]:not(:disabled)'), function (x) { x.checked = t.checked });
      count();
    });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") close() });
  }
  if (document.readyState === "complete") setTimeout(init, 300); else window.addEventListener("load", function () { setTimeout(init, 300) });
})();
