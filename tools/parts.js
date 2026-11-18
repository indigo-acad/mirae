// Собирает списки заданий тренажёров (window.MIRAE_PARTS в материале) в data/parts.js.
// По этому списку преподаватель в «Задать домашку» выбирает не весь тренажёр, а отдельные задания.
// Запуск из корня сайта после правки заданий в тренажёре:  node tools/parts.js
// Код материала выполняется в песочнице node: страница и браузерные функции заменены пустышками,
// сеть, Telegram и озвучка не вызываются.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");

// пустышка, которая выдерживает любые обращения: $("x").innerHTML=…, document.querySelectorAll(…).forEach(…) и т.п.
function stub() {
  const f = function () { return p };
  const p = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => "";
      if (k === Symbol.iterator) return function* () {};
      if (k === "length") return 0;
      if (k === "then") return undefined;
      return p;
    },
    set() { return true }, apply() { return p }, construct() { return p }, has() { return true }
  });
  return p;
}

function partsOf(file) {
  const html = fs.readFileSync(file, "utf8");
  if (html.indexOf("MIRAE_PARTS") < 0) return null;
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.indexOf("MIRAE_PARTS") >= 0);
  const S = stub(), store = {};
  const win = {
    document: S, speechSynthesis: S, navigator: S, location: { search: "", pathname: "" }, console,
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0,
    fetch: () => new Promise(() => {}), alert() {}, confirm: () => false, URLSearchParams, URL, Blob: function () {}, Audio: function () { return S },
    SpeechSynthesisUtterance: function () { return S }, MediaRecorder: S, FormData: function () { return S }, Date, Math, JSON
  };
  win.window = win; win.self = win; win.addEventListener = () => {};
  const ctx = vm.createContext(win);
  for (const code of scripts) vm.runInContext(code, ctx, { filename: file, timeout: 5000 });
  return JSON.parse(JSON.stringify(win.MIRAE_PARTS || null));
}

const out = {};
for (const sec of fs.readdirSync(path.join(ROOT, "materials"))) {
  const dir = path.join(ROOT, "materials", sec);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const id of fs.readdirSync(dir).sort()) {
    const f = path.join(dir, id, "index.html");
    if (!fs.existsSync(f)) continue;
    try {
      const p = partsOf(f);
      if (!p) continue;
      out[id] = p.filter(g => g && g.t && g.t.length).map(g => ({ g: g.g, t: g.t.map(x => ({ k: x.k, n: x.n })) }));
      console.log(id + ": " + out[id].reduce((a, g) => a + g.t.length, 0) + " заданий в " + out[id].length + " группах");
    } catch (e) { console.log(id + ": ошибка — " + e.message) }
  }
}
const js = "/* Задания тренажёров для домашки: собирает tools/parts.js из window.MIRAE_PARTS материалов, руками не править.\n" +
  "   Ключ задания (k) тренажёр понимает в адресе ?only=…, название (n) видит преподаватель в «Задать домашку». */\n" +
  "window.PARTS=" + JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"') + ";\n";
fs.writeFileSync(path.join(ROOT, "data", "parts.js"), js);
console.log("data/parts.js: " + Object.keys(out).length + " материалов");
