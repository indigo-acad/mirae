/* MIRAÉ · работа без интернета. Страницы, стили, скрипты, данные уроков, картинки и шрифты кэшируются на устройстве:
   страницы — «сначала сеть» (свежая версия, без сети — сохранённая), остальное — из кэша с фоновым обновлением.
   Запросы к серверу (Supabase, озвучка, перевод) не кэшируются: прогресс без сети пишется на устройство (localStorage)
   и уходит в облако, когда связь вернётся (js/common.js, js/vocab.js). Поменять VER — сбросить старый кэш. */
const VER = "mirae-v9";
const CORE = ["./", "index.html", "auth.html", "cabinet.html", "course.html", "words.html", "lesson.html", "practice.html", "test.html", "css/style.css", "js/config.js", "js/common.js", "js/srs.js", "js/wlab.js", "js/vocab.js", "js/lesson.js", "js/wtest.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const CACHE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "unpkg.com"];
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url), same = u.origin === location.origin;
  if (!same && !CACHE_HOSTS.includes(u.hostname)) return;            // сервер, озвучка, перевод — только сеть
  const page = r.mode === "navigate" || (r.headers.get("accept") || "").includes("text/html");
  if (page) {
    e.respondWith(fetch(r).then(res => { if (res.ok) { const c = res.clone(); caches.open(VER).then(x => x.put(r, c)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match("cabinet.html") || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: false }).then(m => {
    const net = fetch(r).then(res => { if (res.ok || res.type === "opaque") { const c = res.clone(); caches.open(VER).then(x => x.put(r, c)); } return res; })
      .catch(() => m || caches.match(r, { ignoreSearch: true }));
    return m || net;
  }));
});
// страница прислала свои файлы (при первом открытии они загрузились мимо кэша) — сохраняем их
self.addEventListener("message", e => {
  const list = (e.data && e.data.cache) || [];
  e.waitUntil(caches.open(VER).then(c => Promise.all(list.filter(u => { try { const x = new URL(u); return x.origin === location.origin || CACHE_HOSTS.includes(x.hostname); } catch (er) { return false; } })
    .map(u => c.match(u).then(m => m || fetch(u, { mode: new URL(u).origin === location.origin ? "same-origin" : "no-cors" }).then(res => (res.ok || res.type === "opaque") && c.put(u, res)).catch(() => null))))));
});
