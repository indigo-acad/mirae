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
