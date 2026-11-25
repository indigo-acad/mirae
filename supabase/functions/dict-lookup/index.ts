// MIRAÉ: словарная статья для слова ученика — определения, переводы, примеры, синонимы, произношение.
// Корейский: 한국어기초사전 (Basic Korean Dictionary, Национальный институт корейского языка, krdict.korean.go.kr,
//            лицензия CC BY-SA 2.0 KR) — определение по-корейски, переводы и определения по-английски и по-русски,
//            уровень (초급/중급/고급), примеры, синонимы. Нужен бесплатный ключ Open API: секрет KRDICT_KEY.
//            Без ключа — Викисловарь (английские значения корейских слов).
// Английский: Free Dictionary API (dictionaryapi.dev, данные Викисловаря, CC BY-SA) — определения, примеры,
//            синонимы, транскрипция, запись произношения (британская и американская, если есть); если слова там нет — Викисловарь.
// Записи произношения: audio = { uk?, us?, ko? } — ссылки на звук из словаря (корейский — если 한국어기초사전 его даёт).
// Cambridge и NAVER открытого API не дают: подключатся сменными адаптерами здесь же, когда будут лицензии.
// Вход:  { p_name, p_pin, word, lang: "ko" | "en" }  или пакетом { p_name, p_pin, words: [...], langs: [...] } (до 80 слов)
// Выход: одно слово — { found, src, srcName, word, lang, pos, level, ipa, tr_ru: [], defs: [{l, s}], examples: [{s, t}],
//          cols: [{s, t}], syn: [], senses: [...] }; пакет — { entries: [...] } в том же порядке (found: false — слова нет).
// senses — значения слова по отдельности: [{ h, pos, tr_ru, defs, examples, cols, syn }] (h — номер омонима: 쓰다 «писать»
//          и 쓰다 «использовать» — разные слова). Сайт берёт определения и примеры только из значения, которое ученик учит
//          (js/dict.js): у 까먹다 «забывать» не должно быть примера про очистку каштанов. Плоские поля — все значения
//          вместе, для старых версий сайта.
// Пакетом функцию вызывает translate-words: база школы → словарь → DeepL.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Ex = { s: string; t: string };
type Def = { l: string; s: string };
type Sense = { h: number; pos: string; tr_ru: string[]; defs: Def[]; examples: Ex[]; cols: Ex[]; syn: string[] };
type Entry = {
  found: boolean; src: string; srcName: string; word: string; lang: string; pos: string; level: string; ipa: string;
  tr_ru: string[]; defs: Def[]; examples: Ex[]; cols: Ex[]; syn: string[]; audio: Record<string, string>; senses: Sense[];
};
const empty = (word: string, lang: string): Entry => ({
  found: false, src: "", srcName: "", word, lang, pos: "", level: "", ipa: "", tr_ru: [], defs: [], examples: [], cols: [], syn: [], audio: {}, senses: [],
});
const sense = (h = 0, pos = ""): Sense => ({ h, pos, tr_ru: [], defs: [], examples: [], cols: [], syn: [] });
/* плоские поля статьи — из значений по порядку (для старых версий сайта) */
function flatten(e: Entry) {
  for (const s of e.senses) {
    e.tr_ru.push(...s.tr_ru); e.defs.push(...s.defs); e.cols.push(...s.cols); e.syn.push(...s.syn);
    e.examples.push(...s.examples.slice(0, 2));
  }
  e.tr_ru = uniq(e.tr_ru).slice(0, 5); e.syn = uniq(e.syn).filter((x) => x.toLowerCase() !== e.word.toLowerCase()).slice(0, 6);
  e.defs = e.defs.slice(0, 8); e.cols = e.cols.slice(0, 5); e.examples = e.examples.slice(0, 4);
}
const https = (u: string) => u.replace(/^http:\/\//, "https://").replace(/^\/\//, "https://");
const uniq = (a: string[]) => {
  const s = new Set<string>(), r: string[] = [];
  for (let x of a) { x = (x || "").replace(/\s+/g, " ").trim(); const k = x.toLowerCase(); if (x && !s.has(k)) { s.add(k); r.push(x); } }
  return r;
};
const strip = (s: string) =>
  String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
/* простой разбор XML: все блоки <name>…</name> */
const blocks = (xml: string, name: string) => {
  const out: string[] = [], re = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g");
  let m; while ((m = re.exec(xml))) out.push(m[1]);
  return out;
};
const first = (xml: string, name: string) => strip(blocks(xml, name)[0] || "");
const get = (url: string, ms = 8000) => fetch(url, { headers: { "User-Agent": "MIRAE-school/1.0 (vocabulary trainer)" }, signal: AbortSignal.timeout(ms) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/* Ограничитель: не больше n запросов к одному словарю одновременно. 한국어기초사전 обрывает соединения,
   если открыть сразу много (так было со списком из 40 слов: все ответы — обрыв или тайм-аут, и всё ушло в DeepL). */
function limiter(n: number) {
  let busy = 0; const q: (() => void)[] = [];
  return async <T>(f: () => Promise<T>): Promise<T> => {
    if (busy >= n) await new Promise<void>((r) => q.push(r));
    busy++;
    try { return await f(); } finally { busy--; const nx = q.shift(); if (nx) nx(); }
  };
}
const KR_LIM = limiter(2), WIKI_LIM = limiter(2), FREE_LIM = limiter(3);
/* 한국어기초사전 не отвечает: после 3 сетевых сбоев подряд в этом запросе больше его не ждём */
let krFails = 0;
const netErr = (e: unknown) => /timed out|connection|SendRequest|network|reset/i.test(String((e as Error)?.message || e));
async function krGet(url: string): Promise<Response> {
  if (krFails >= 3) throw new Error("krdict unavailable");
  for (let a = 0; ; a++) {
    try { const r = await KR_LIM(() => get(url, 7000)); krFails = 0; return r; }
    catch (e) {
      if (!netErr(e)) throw e;
      krFails++;
      if (a >= 1 || krFails >= 3) throw e;
      await sleep(400);
    }
  }
}

// ---------- 한국어기초사전 ----------
const POS_KO: Record<string, string> = { "명사": "noun", "동사": "verb", "형용사": "adjective", "부사": "adverb", "대명사": "pronoun",
  "수사": "number", "관형사": "determiner", "감탄사": "interjection", "조사": "particle" };
/* значения из блоков <sense> (поиск) или <sense_info> (подробная статья) */
function krSenses(blocksXml: string[], h: number, pos: string): Sense[] {
  const out: Sense[] = [];
  for (const s of blocksXml.slice(0, 6)) {
    const x = sense(h, pos);
    const dfn = first(s, "definition"); if (dfn) x.defs.push({ l: "ko", s: dfn });
    for (const t of blocks(s, "translation")) {
      const lang = first(t, "trans_lang"), w = first(t, "trans_word"), d = first(t, "trans_dfn");
      if (lang === "러시아어") { if (w) x.tr_ru.push(...w.split(/[;,]\s*/)); if (d) x.defs.push({ l: "ru", s: d }); }
      if (lang === "영어" && d) x.defs.push({ l: "en", s: d });
    }
    for (const ei of blocks(s, "example_info")) {
      const ex = first(ei, "example"), tp = first(ei, "type");
      if (!ex) continue;
      // примеры — все предложения значения (до 8): сайт выберет подходящие по уровню ученика
      if (tp === "구") { if (x.cols.length < 5) x.cols.push({ s: ex.replace(/\.$/, ""), t: "" }); }
      else if (tp === "문장" && x.examples.length < 8) x.examples.push({ s: ex, t: "" });
    }
    for (const r of blocks(s, "rel_info")) if (/유의어|비슷한말/.test(first(r, "type"))) x.syn.push(first(r, "word"));
    x.tr_ru = uniq(x.tr_ru).slice(0, 5); x.syn = uniq(x.syn).slice(0, 6);
    if (x.defs.length) out.push(x);
  }
  return out;
}
/* Корейское слово: до трёх омонимов (쓰다 «писать», «использовать», «горький»). deep — подробная статья (примеры) для каждого
   омонима; в пакете — только для первого, остальным хватает значений из поиска, чтобы уложиться во время. */
async function krdict(key: string, word: string, deep = true): Promise<Entry | null> {
  const q = new URLSearchParams({ key, q: word, part: "word", sort: "dict", num: "10", translated: "y", trans_lang: "0", advanced: "y", method: "exact" });
  const r = await krGet(`https://krdict.korean.go.kr/api/search?${q}`);
  if (!r.ok) throw new Error(`krdict ${r.status}`);
  const xml = await r.text();
  if (/<error>/.test(xml)) throw new Error("krdict: " + first(xml, "message"));
  const items = blocks(xml, "item").filter((it) => first(it.split("<sense>")[0], "word").replace(/[\d\s-]/g, "") === word.replace(/[\s-]/g, "")).slice(0, 3);
  if (!items.length) return null;
  const e = empty(word, "ko");
  e.found = true; e.src = "krdict"; e.srcName = "한국어기초사전 (국립국어원), CC BY-SA 2.0 KR";
  e.pos = POS_KO[first(items[0], "pos")] || first(items[0], "pos"); e.level = first(items[0], "word_grade").replace("없음", "");
  for (let h = 0; h < items.length; h++) {
    const it = items[h], code = first(it, "target_code"), pos = POS_KO[first(it, "pos")] || first(it, "pos");
    let ss = blocks(it, "sense");
    if (deep || h === 0) {
      let view = "";
      try {
        const v = new URLSearchParams({ key, method: "target_code", q: code, translated: "y", trans_lang: "0" });
        const rv = await krGet(`https://krdict.korean.go.kr/api/view?${v}`);
        if (rv.ok) view = await rv.text();
      } catch (_) { /* без примеров */ }
      if (view && blocks(view, "sense_info").length) {
        ss = blocks(view, "sense_info");
        if (h === 0) {
          const pr = first(view, "pronunciation"); if (pr && pr !== word) e.ipa = "[" + pr + "]";
          // запись произношения, если словарь её даёт: ищем ссылку на звук в сведениях о произношении
          const snd = (blocks(view, "pronunciation_info").join(" ").match(/(?:https?:)?\/\/[^<>\s"]+?\.(?:wav|mp3|ogg|m4a)/i) || [])[0];
          if (snd) e.audio.ko = https(strip(snd));
        }
      }
    }
    e.senses.push(...krSenses(ss, h, pos));
  }
  if (!e.senses.length) return null;
  flatten(e);
  return e;
}

// ---------- Free Dictionary API (английский) ----------
async function freeDict(word: string): Promise<Entry | null> {
  const r = await FREE_LIM(() => get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`dictionaryapi ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || !data.length) return null;
  const e = empty(word, "en"); e.found = true; e.src = "wiktionary"; e.srcName = "Free Dictionary API · Wiktionary, CC BY-SA";
  const syn: string[] = [];
  for (const en of data) {
    if (!e.ipa) e.ipa = en.phonetic || (en.phonetics || []).map((p: { text?: string }) => p.text).find(Boolean) || "";
    for (const p of en.phonetics || []) {
      const a = String(p.audio || ""); if (!a) continue;
      const k = /-(uk|gb)\.\w+$/i.test(a) ? "uk" : /-us\.\w+$/i.test(a) ? "us" : /-au\.\w+$/i.test(a) ? "au" : "any";
      if (!e.audio[k]) e.audio[k] = https(a);
    }
    for (const m of en.meanings || []) {
      if (!e.pos) e.pos = m.partOfSpeech || "";
      syn.push(...(m.synonyms || []));
      (m.definitions || []).slice(0, 3).forEach((d: { definition?: string; example?: string; synonyms?: string[] }, j: number) => {
        if (!d.definition || e.senses.length >= 8) return;
        // каждое определение — отдельное значение; синонимы части речи — к первому
        const x = sense(0, m.partOfSpeech || "");
        x.defs.push({ l: "en", s: d.definition });
        if (d.example) x.examples.push({ s: d.example, t: "" });
        x.syn = uniq([...(d.synonyms || []), ...(j === 0 ? m.synonyms || [] : [])]).filter((s) => s.toLowerCase() !== word.toLowerCase()).slice(0, 6);
        e.senses.push(x);
      });
    }
  }
  if (!e.senses.length) return null;
  flatten(e);
  e.syn = uniq([...e.syn, ...syn]).filter((s) => s.toLowerCase() !== word.toLowerCase()).slice(0, 6);
  return e;
}

// ---------- Викисловарь (запасной для обоих языков) ----------
async function wiktionary(word: string, lang: string): Promise<Entry | null> {
  const r = await WIKI_LIM(() => get(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`wiktionary ${r.status}`);
  const data = await r.json(), list = data[lang] || [];
  if (!list.length) return null;
  const e = empty(word, lang); e.found = true; e.src = "wiktionary"; e.srcName = "Wiktionary, CC BY-SA";
  for (const p of list) {
    const pos = String(p.partOfSpeech || "").toLowerCase();
    if (!e.pos) e.pos = pos;
    for (const d of (p.definitions || []).slice(0, 3)) {
      const s = strip(d.definition); if (!s || e.senses.length >= 8) continue;
      const x = sense(0, pos); x.defs.push({ l: "en", s });
      for (const y of (d.parsedExamples || []).slice(0, 3)) {
        const ex = strip(y.example); if (ex) x.examples.push({ s: ex, t: lang === "en" ? "" : strip(y.translation || "") });
      }
      e.senses.push(x);
    }
  }
  if (!e.senses.length) return null;
  flatten(e);
  return e;
}

/* одно слово: корейский — 한국어기초사전, потом Викисловарь; английский — Free Dictionary API, потом Викисловарь */
async function lookup(word: string, lang: string, deep = true): Promise<Entry & { message?: string }> {
  const errs: string[] = [];
  const tryIt = async (f: () => Promise<Entry | null>) => { try { return await f(); } catch (e) { errs.push(String((e as Error).message || e)); return null; } };
  let e: Entry | null = null;
  if (lang === "ko") {
    const key = Deno.env.get("KRDICT_KEY") || "";
    if (key) e = await tryIt(() => krdict(key, word, deep));
    if (!e) e = await tryIt(() => wiktionary(word, "ko"));
  } else {
    e = await tryIt(() => freeDict(word.replace(/^to\s+/i, "")));
    if (!e) e = await tryIt(() => wiktionary(word, "en"));
  }
  if (errs.length) console.error("dict", word, errs.join("; "));
  return e || { ...empty(word, lang), message: errs.length ? "Словарь сейчас не отвечает." : "Слова нет в словаре." };
}
const clean = (w: unknown) => String(w || "").normalize("NFC").trim().replace(/\s+/g, " ");
const langOf = (w: string, l: unknown) => (l === "ko" || l === "en" ? l : /[\uAC00-\uD7AF]/.test(w) ? "ko" : "en");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.p_name || "").trim().toLowerCase(), pin = String(body.p_pin || "");
    const batch = Array.isArray(body.words);
    const words: string[] = batch ? body.words.map(clean) : [clean(body.word)];
    const langs = words.map((w, i) => langOf(w, batch ? (body.langs || [])[i] : body.lang));
    if (!name || !pin || !words.length || words.length > 80 || words.some((w) => !w || w.length > 80))
      return json({ error: "bad_input", message: "Нет слова или входа." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!, anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = await fetch(`${supabaseUrl}/rest/v1/rpc/is_teacher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_name: name, p_pin: pin }),
      signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) return json({ error: "unauthorized", message: "Не удалось проверить вход. Войдите на сайт заново." }, 401);

    if (!batch) { krFails = 0; return json(await lookup(words[0], langs[0])); }
    // пакет: по 6 слов одновременно (к каждому словарю — не больше 2–3 запросов разом, см. limiter).
    // Отвечаем не позже чем через 18 с тем, что успели: translate-words ждёт 25 с, и если не дождётся, теряет весь пакет.
    // Не найденные за это время слова — found: false, их переведёт DeepL, а статью можно добрать кнопкой «Заполнить из словаря».
    krFails = 0;
    const entries: (Entry & { message?: string })[] = new Array(words.length);
    const until = Date.now() + 18000;
    const late = (i: number) => ({ ...empty(words[i], langs[i]), message: "Словарь не успел ответить." });
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, words.length) }, async () => {
      while (next < words.length) {
        const i = next++, left = until - Date.now();
        if (left <= 0) { entries[i] = late(i); continue; }
        entries[i] = await Promise.race([lookup(words[i], langs[i], false), sleep(left).then(() => late(i))]);
      }
    }));
    return json({ entries });
  } catch (e) {
    return json({ error: "server_error", message: "Ошибка словаря: " + String((e as Error).message || e).slice(0, 160) }, 500);
  }
});
