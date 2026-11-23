/* MIRAÉ · общий видеоплеер для уроков с видео (materials/…).
   Подключение в материале: <script src="../../../js/player.js"></script>
   Использование:   el.innerHTML = MIRAE_PLAYER.html({ ... })   — или —   MIRAE_PLAYER.mount(el, { ... })

   Параметры (любой набор, порядок показа: file → alt → yt):
     file:  "suchwita-ep5-l4.mp4"   — свой ролик сайта. Короткое имя ищется в папке media/video/ в корне сайта;
                                        путь с "/" или "http" берётся как есть. Работает в России без VPN.
     alt:   "https://vk.com/video_ext.php?..."  — запасной плеер (VK Видео / Rutube, адрес из кода для вставки).
     yt:    { id: "rejl6KNXbgo", start: 863, end: 1200 }  — YouTube (секунды).
     cover: true | { bottom: 7, height: 19 }  — кнопка «Скрыть субтитры» для своего ролика: полоса поверх вшитых
                                        субтитров, в процентах от высоты кадра (по умолчанию 7% снизу, высота 19%).
     time:  "14:23–20:00"            — подпись под плеером.
     hint:  "…"                       — своя подсказка под плеером (по умолчанию стандартная).
   Как добавить ролик: положить mp4 (H.264 + AAC, с -movflags +faststart) в media/video/ и указать file.
   Состояние (выбранный плеер, скрыты ли субтитры) общее для всех плееров на странице. */
(function () {
  "use strict";
  if (window.MIRAE_PLAYER) return;
  var me = document.currentScript && document.currentScript.src || "";
  var ROOT = me ? me.replace(/js\/player\.js(\?.*)?$/, "") : "";
  var st = { pick: null, cover: false };
  var reg = {}, seq = 0;

  var css = ".mp-box{margin-top:10px}" +
    ".mp-vid{position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000}" +
    ".mp-vid iframe,.mp-vid video{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}" +
    ".mp-cov{position:absolute;left:0;right:0;background:rgba(20,16,25,.93);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);pointer-events:none;display:none;align-items:center;justify-content:center;color:#a99;font:13px system-ui,sans-serif}" +
    ".mp-vid.mp-on .mp-cov{display:flex}" +
    ".mp-note{color:#6f7488;font-size:14px;margin-top:6px}" +
    ".mp-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}" +
    ".mp-btns button{font:inherit;font-size:14px;cursor:pointer;border-radius:12px;border:1.5px solid #e6e2da;background:#fff;color:#1f2333;padding:7px 10px}" +
    ".mp-none{background:#f1eee8;border-radius:12px;padding:16px;margin-top:10px;font-size:15px}";
  function addCss() { if (document.getElementById("mp-css")) return; var s = document.createElement("style"); s.id = "mp-css"; s.textContent = css; (document.head || document.documentElement).appendChild(s) }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") }
  function fileUrl(f) { return /^(https?:)?\/|^\.{1,2}\//.test(f) ? f : ROOT + "media/video/" + f }
  function ytUrl(y) {
    var p = []; if (y.start) p.push("start=" + y.start); if (y.end) p.push("end=" + y.end); p.push("rel=0");
    return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(y.id) + "?" + p.join("&");
  }
  var LABEL = { file: "▶ Плеер сайта", alt: "▶ VK / Rutube", yt: "▶ YouTube" };

  function render(id) {
    var o = reg[id], yt = o.yt && o.yt.id ? o.yt : null;
    var modes = ["file", "alt", "yt"].filter(function (m) { return m === "yt" ? !!yt : !!o[m] });
    if (!modes.length) return '<div class="mp-box mp-none" data-mp="' + id + '">🎬 Отрывок' + (o.time ? " <b>" + esc(o.time) + "</b>" : "") + " учитель добавит позже.</div>";
    var mode = modes.indexOf(st.pick) >= 0 ? st.pick : modes[0];
    var cov = o.cover ? (o.cover === true ? {} : o.cover) : null;
    var player;
    if (mode === "file") {
      player = '<video src="' + esc(fileUrl(o.file)) + '" controls playsinline preload="metadata" controlslist="nodownload"></video>' +
        (cov ? '<div class="mp-cov" style="bottom:' + (cov.bottom != null ? cov.bottom : 7) + "%;height:" + (cov.height || 19) + '%">субтитры скрыты</div>' : "");
    } else {
      player = '<iframe src="' + esc(mode === "alt" ? o.alt : ytUrl(yt)) + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen; screen-wake-lock" allowfullscreen></iframe>';
    }
    var btns = [];
    if (mode === "file" && cov) btns.push('<button type="button" onclick="MIRAE_PLAYER._cover()">' + (st.cover ? "👀 Показать субтитры" : "🙈 Скрыть субтитры") + "</button>");
    modes.forEach(function (m) { if (m !== mode) btns.push('<button type="button" onclick="MIRAE_PLAYER._pick(\'' + m + '\')">' + LABEL[m] + "</button>") });
    var hint = o.hint != null ? o.hint : mode === "file" ? (cov ? "Первый раз смотрите со скрытыми субтитрами, второй — с субтитрами." : "")
      : mode === "yt" ? (modes.length > 1 ? "Если видео не грузится — переключите плеер." : "Если YouTube не открывается, попросите учителя добавить ролик на сайт.") : "";
    return '<div class="mp-box" data-mp="' + id + '"><div class="mp-vid' + (mode === "file" && cov && st.cover ? " mp-on" : "") + '">' + player + "</div>" +
      '<div class="mp-note">' + (o.time ? "Отрывок " + esc(o.time) + ". " : "") + esc(hint) + "</div>" +
      (btns.length ? '<div class="mp-btns">' + btns.join("") + "</div>" : "") + "</div>";
  }
  function refresh() {
    [].slice.call(document.querySelectorAll("[data-mp]")).forEach(function (b) {
      var id = b.getAttribute("data-mp"); if (!reg[id]) return;
      var v = b.querySelector("video"); if (v && !v.paused) v.pause();
      b.outerHTML = render(id);
    });
  }
  window.MIRAE_PLAYER = {
    html: function (o) { addCss(); var id = "mp" + (++seq); reg[id] = o || {}; return render(id) },
    mount: function (el, o) { if (el) el.innerHTML = this.html(o) },
    _pick: function (m) { st.pick = m; refresh() },
    _cover: function () {
      st.cover = !st.cover;
      [].slice.call(document.querySelectorAll("[data-mp] .mp-vid")).forEach(function (v) { v.classList.toggle("mp-on", st.cover) });
      [].slice.call(document.querySelectorAll("[data-mp] .mp-btns button")).forEach(function (b) {
        if (/субтитры/.test(b.textContent)) b.textContent = st.cover ? "👀 Показать субтитры" : "🙈 Скрыть субтитры";
      });
    }
  };
})();
