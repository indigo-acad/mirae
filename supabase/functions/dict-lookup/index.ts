// MIRAÉ: словарная статья для слова ученика — определения, переводы, примеры, синонимы, произношение.
// Корейский: 한국어기초사전 (Basic Korean Dictionary, Национальный институт корейского языка, krdict.korean.go.kr,
//            лицензия CC BY-SA 2.0 KR) — определение по-корейски, переводы и определения по-английски и по-русски,
//            уровень (초급/중급/고급), примеры, синонимы. Нужен бесплатный ключ Open API: секрет KRDICT_KEY.
//            Без ключа — Викисловарь (английские значения корейских слов).
// Английский: Free Dictionary API (dictionaryapi.dev, данные Викисловаря, CC BY-SA) — определения, примеры,
//            синонимы, транскрипция; если слова там нет — Викисловарь.
// Cambridge и NAVER открытого API не дают: подключатся сменными адаптерами здесь же, когда будут лицензии.
// Вход:  { p_name, p_pin, word, lang: "ko" | "en" }  или пакетом { p_name, p_pin, words: [...], langs: [...] } (до 80 слов)
// Выход: одно слово — { found, src, srcName, word, lang, pos, level, ipa, tr_ru: [], defs: [{l, s}], examples: [{s, t}],
//          cols: [{s, t}], syn: [] }; пакет — { entries: [...] } в том же порядке (found: false — слова нет).
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
type Entry = {
  found: boolean; src: string; srcName: string; word: string; lang: string; pos: string; level: string; ipa: string;
  tr_ru: string[]; defs: Def[]; examples: Ex[]; cols: Ex[]; syn: string[];
};
const empty = (word: string, lang: string): Entry => ({
  found: false, src: "", srcName: "", word, lang, pos: "", level: "", ipa: "", tr_ru: [], defs: [], examples: [], cols: [], syn: [],
});
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

// ---------- 한국어기초사전 ----------
const POS_KO: Record<string, string> = { "명사": "noun", "동사": "verb", "형용사": "adjective", "부사": "adverb", "대명사": "pronoun",
  "수사": "number", "관형사": "determiner", "감탄사": "interjection", "조사": "particle" };
async function krdict(key: string, word: string): Promise<Entry | null> {
  const q = new URLSearchParams({ key, q: word, part: "word", sort: "dict", num: "10", translated: "y", trans_lang: "0", advanced: "y", method: "exact" });
  const r = await get(`https://krdict.korean.go.kr/api/search?${q}`);
  if (!r.ok) throw new Error(`krdict ${r.status}`);
  const xml = await r.text();
  if (/<error>/.test(xml)) throw new Error("krdict: " + first(xml, "message"));
  const items = blocks(xml, "item").filter((it) => first(it.split("<sense>")[0], "word").replace(/[\d\s-]/g, "") === word.replace(/[\s-]/g, ""));
  if (!items.length) return null;
  const it = items[0], code = first(it, "target_code"), e = empty(word, "ko");
  e.found = true; e.src = "krdict"; e.srcName = "한국어기초사전 (국립국어원), CC BY-SA 2.0 KR";
  e.pos = POS_KO[first(it, "pos")] || first(it, "pos"); e.level = first(it, "word_grade").replace("없음", "");
  let senses = blocks(it, "sense");
  // подробная статья: примеры и синонимы
  let view = "";
  try {
    const v = new URLSearchParams({ key, method: "target_code", q: code, translated: "y", trans_lang: "0" });
    const rv = await get(`https://krdict.korean.go.kr/api/view?${v}`);
    if (rv.ok) view = await rv.text();
  } catch (_) { /* без примеров */ }
  if (view && blocks(view, "sense_info").length) {
    senses = blocks(view, "sense_info");
    const pr = first(view, "pronunciation"); if (pr && pr !== word) e.ipa = "[" + pr + "]";
  }
  for (const s of senses.slice(0, 4)) {
    const dfn = first(s, "definition"); if (dfn) e.defs.push({ l: "ko", s: dfn });
    for (const t of blocks(s, "translation")) {
      const lang = first(t, "trans_lang"), w = first(t, "trans_word"), d = first(t, "trans_dfn");
      if (lang === "러시아어") { if (w) e.tr_ru.push(...w.split(/[;,]\s*/)); if (d) e.defs.push({ l: "ru", s: d }); }
      if (lang === "영어" && d) e.defs.push({ l: "en", s: d });
    }
    for (const x of blocks(s, "example_info")) {
      const ex = first(x, "example"), tp = first(x, "type");
      if (!ex) continue;
      if (tp === "구") e.cols.push({ s: ex.replace(/\.$/, ""), t: "" }); else if (tp === "문장") e.examples.push({ s: ex, t: "" });
    }
    for (const x of blocks(s, "rel_info")) if (/유의어|비슷한말/.test(first(x, "type"))) e.syn.push(first(x, "word"));
  }
  e.tr_ru = uniq(e.tr_ru).slice(0, 5); e.syn = uniq(e.syn).slice(0, 6);
  e.cols = e.cols.slice(0, 5); e.examples = e.examples.slice(0, 4);
  return e;
}

// ---------- Free Dictionary API (английский) ----------
async function freeDict(word: string): Promise<Entry | null> {
  const r = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`dictionaryapi ${r.status}`);
  const data = await r.json();
  if (!Array.isArray(data) || !data.length) return null;
  const e = empty(word, "en"); e.found = true; e.src = "wiktionary"; e.srcName = "Free Dictionary API · Wiktionary, CC BY-SA";
  const syn: string[] = [];
  for (const en of data) {
    if (!e.ipa) e.ipa = en.phonetic || (en.phonetics || []).map((p: { text?: string }) => p.text).find(Boolean) || "";
    for (const m of en.meanings || []) {
      if (!e.pos) e.pos = m.partOfSpeech || "";
      syn.push(...(m.synonyms || []));
      for (const d of (m.definitions || []).slice(0, 3)) {
        if (d.definition && e.defs.length < 5) e.defs.push({ l: "en", s: d.definition });
        if (d.example && e.examples.length < 4) e.examples.push({ s: d.example, t: "" });
        syn.push(...(d.synonyms || []));
      }
    }
  }
  e.syn = uniq(syn).filter((s) => s.toLowerCase() !== word.toLowerCase()).slice(0, 6);
  return e.defs.length ? e : null;
}

// ---------- Викисловарь (запасной для обоих языков) ----------
async function wiktionary(word: string, lang: string): Promise<Entry | null> {
  const r = await get(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`wiktionary ${r.status}`);
  const data = await r.json(), list = data[lang] || [];
  if (!list.length) return null;
  const e = empty(word, lang); e.found = true; e.src = "wiktionary"; e.srcName = "Wiktionary, CC BY-SA";
  for (const p of list) {
    if (!e.pos) e.pos = String(p.partOfSpeech || "").toLowerCase();
    for (const d of (p.definitions || []).slice(0, 3)) {
      const s = strip(d.definition); if (s && e.defs.length < 5) e.defs.push({ l: "en", s });
      for (const x of (d.parsedExamples || []).slice(0, 1)) {
        const ex = strip(x.example); if (ex && e.examples.length < 3) e.examples.push({ s: ex, t: lang === "en" ? "" : strip(x.translation || "") });
      }
    }
  }
  return e.defs.length ? e : null;
}

/* одно слово: корейский — 한국어기초사전, потом Викисловарь; английский — Free Dictionary API, потом Викисловарь */
async function lookup(word: string, lang: string): Promise<Entry & { message?: string }> {
  const errs: string[] = [];
  const tryIt = async (f: () => Promise<Entry | null>) => { try { return await f(); } catch (e) { errs.push(String((e as Error).message || e)); return null; } };
  let e: Entry | null = null;
  if (lang === "ko") {
    const key = Deno.env.get("KRDICT_KEY") || "";
    if (key) e = await tryIt(() => krdict(key, word));
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

    if (!batch) return json(await lookup(words[0], langs[0]));
    // пакет: по 6 слов одновременно, чтобы не перегружать словари
    const entries: Entry[] = new Array(words.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, words.length) }, async () => {
      while (next < words.length) { const i = next++; entries[i] = await lookup(words[i], langs[i]); }
    }));
    return json({ entries });
  } catch (e) {
    return json({ error: "server_error", message: "Ошибка словаря: " + String((e as Error).message || e).slice(0, 160) }, 500);
  }
});
