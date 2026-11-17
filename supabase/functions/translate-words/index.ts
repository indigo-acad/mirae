// MIRAÉ: перевод списка слов ученика или преподавателя на русский.
// 1) Слово ищется в базе слов школы (таблица vocabulary, supabase/vocab2.sql): там переводы, проверенные людьми.
// 2) Остальное переводит DeepL — с явным языком источника (корейский или английский) и подсказкой,
//    что это отдельное слово из словаря: без этого DeepL часто ошибается с языком и смыслом коротких слов.
// Вход:  { p_name, p_pin, words: string[] (1–80), langs?: ("ko" | "en" | "")[] }  — langs можно не передавать,
//        тогда язык определяется по буквам (хангыль — корейский, латиница — английский).
// Выход: { translations: string[], sources: ("base" | "deepl" | "")[] } — по одному на слово, в том же порядке.
// Секреты: DEEPL_AUTH_KEY. SUPABASE_URL, SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY функция получает сама.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const HAN = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const CYR = /[А-Яа-яЁё]/;
const norm = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
const langOf = (s: string) => (HAN.test(s) ? "ko" : /[A-Za-z]/.test(s) ? "en" : "");
const CONTEXT = "A single dictionary word or short phrase from a language learner's vocabulary list. Translate it as a dictionary entry.";

/* Переводы из базы школы: norm → «перевод; перевод» (только русские, проверенные слова первыми). */
async function fromBase(url: string, key: string, words: string[], langs: string[]) {
  const out = new Map<string, string>();
  const norms = [...new Set(words.map(norm))];
  const list = norms.map((n) => '"' + n.replace(/["\\]/g, "\\$&") + '"').join(",");
  const params = new URLSearchParams({ select: "lang,norm,tr_ru,checked", norm: `in.(${list})` });
  const r = await fetch(`${url}/rest/v1/vocabulary?${params.toString().replace(/\+/g, "%20")}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`base ${r.status}`);
  const rows: { lang: string; norm: string; tr_ru: unknown; checked: boolean }[] = await r.json();
  rows.sort((a, b) => Number(b.checked) - Number(a.checked));
  const wanted = new Set(words.map((w, i) => langs[i] + ":" + norm(w)));
  const acc = new Map<string, string[]>();
  for (const row of rows) {
    const k = row.lang + ":" + row.norm;
    if (!wanted.has(k)) continue;
    const tr = (Array.isArray(row.tr_ru) ? row.tr_ru : []).map((x) => String(x || "").trim()).filter((x) => CYR.test(x));
    const a = acc.get(k) || [];
    for (const t of tr) if (!a.some((x) => x.toLowerCase() === t.toLowerCase())) a.push(t);
    acc.set(k, a);
  }
  for (const [k, a] of acc) if (a.length) out.set(k, a.slice(0, 3).join("; "));
  return out;
}

/* DeepL: одна группа слов одного языка. Если подсказка (context) не принята, повторяем без неё. */
async function deepl(key: string, words: string[], lang: string): Promise<string[]> {
  const endpoint = key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const call = (ctx: boolean) =>
    fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: words,
        target_lang: "RU",
        ...(lang ? { source_lang: lang.toUpperCase() } : {}),
        ...(ctx ? { context: CONTEXT } : {}),
      }),
      signal: AbortSignal.timeout(20000),
    });
  let r = await call(true);
  if (r.status === 400) r = await call(false);
  const result = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("DeepL error", r.status, result?.message || result);
    throw new Error("deepl");
  }
  return (result.translations || []).map((x: { text?: string }, i: number) => tidy(words[i], x.text || ""));
}

/* Перевод отдельного слова: без точки в конце и без заглавной буквы, если её не было в слове;
   если DeepL вернул слово как есть, перевода нет. */
function tidy(src: string, t: string) {
  t = t.trim();
  if (!t || norm(t) === norm(src) || !CYR.test(t)) return "";
  if (!/[.!?]$/.test(src.trim())) t = t.replace(/\.$/, "");
  const first = src.trim()[0] || "";
  if (first && first === first.toLowerCase() && /^[А-ЯЁ][а-яё]/.test(t)) t = t[0].toLowerCase() + t.slice(1);
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const name = String(body.p_name || "").trim().toLowerCase();
    const pin = String(body.p_pin || "");
    const words = body.words;
    if (!name || !pin || !Array.isArray(words) || words.length < 1 || words.length > 80)
      return json({ error: "bad_input", message: "Нужно передать от 1 до 80 слов и войти в аккаунт." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const deeplKey = Deno.env.get("DEEPL_AUTH_KEY") || "";

    // is_teacher authenticates any valid school account; false means a valid student, not an auth failure.
    const auth = await fetch(`${supabaseUrl}/rest/v1/rpc/is_teacher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_name: name, p_pin: pin }),
      signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) return json({ error: "unauthorized", message: "Не удалось проверить вход. Войдите на сайт заново." }, 401);

    // позиции сохраняются: перевод i относится к слову i
    const clean: string[] = words.map((w: unknown) => String(w || "").normalize("NFC").trim().replace(/\s+/g, " "));
    if (clean.some((w) => !w || w.length > 100))
      return json({ error: "bad_input", message: "Пустое или слишком длинное слово в списке." }, 400);
    const given = Array.isArray(body.langs) ? body.langs : [];
    const langs = clean.map((w, i) => (given[i] === "ko" || given[i] === "en" ? given[i] : langOf(w)));

    const translations: string[] = clean.map(() => "");
    const sources: string[] = clean.map(() => "");

    if (serviceKey) {
      try {
        const base = await fromBase(supabaseUrl, serviceKey, clean, langs);
        clean.forEach((w, i) => {
          const t = base.get(langs[i] + ":" + norm(w));
          if (t) { translations[i] = t; sources[i] = "base"; }
        });
      } catch (e) {
        console.error("base lookup failed", e);
      }
    }

    const rest = clean.map((_, i) => i).filter((i) => !translations[i]);
    if (rest.length) {
      if (!deeplKey) {
        if (rest.length === clean.length) return json({ error: "missing_deepl_secret", message: "Автоперевод не настроен." }, 503);
      } else {
        const groups = new Map<string, number[]>();
        for (const i of rest) groups.set(langs[i], [...(groups.get(langs[i]) || []), i]);
        try {
          for (const [lang, idx] of groups) {
            const tr = await deepl(deeplKey, idx.map((i) => clean[i]), lang);
            idx.forEach((i, j) => {
              if (tr[j]) { translations[i] = tr[j]; sources[i] = "deepl"; }
            });
          }
        } catch (e) {
          console.error("deepl failed", e);
          if (!translations.some(Boolean))
            return json({ error: "deepl_error", message: "DeepL временно не смог перевести список." }, 502);
        }
      }
    }
    return json({ translations, sources });
  } catch (e) {
    console.error("translate-words error", e);
    const timeout = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
    return json(
      { error: timeout ? "timeout" : "server_error", message: timeout ? "Сервер перевода не ответил вовремя." : "Ошибка сервера перевода." },
      timeout ? 504 : 500,
    );
  }
});
