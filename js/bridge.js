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
(function () {
  "use strict";
  var path = location.pathname, at = path.indexOf("/materials/");
  if (at < 0 || !window.fetch) return;
  var ROOT = path.slice(0, at + 1);                                  // корень сайта
  var MID = (path.slice(at + 11).split("/")[1] || "").trim();        // materials/<раздел>/<id>/ → id
  if (!MID) return;
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
