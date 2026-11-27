// MIRAÉ: генерация заданий для блока «Практика» на странице «Слова» (js/wlab.js).
// Тексты на слух (лекция, подкаст, диалог, новости), тексты для чтения, задания в формате экзаменов (TOPIK I / II,
// IELTS, TOEFL, ЕГЭ, ОГЭ), лёгкое письмо с чек-листом и подсказками, предложения для диктанта и перевода,
// проверка письма и переводов. Всё — по уровню ученика и с его словами.
// Вход:  { p_name, p_pin, kind, lang: "ko" | "en", level: "2급" | "A2" | …, words?: {w, t}[], opts?: {...} }
//        kind: listen | read | exam | write | check | sent | trcheck
// Выход: JSON задания (формат — в SPEC ниже) или { error, message }.
// Секреты: OPENAI_API_KEY; по желанию OPENAI_BASE_URL (OpenAI-совместимый шлюз, как у tts) и GEN_MODEL (по умолчанию gpt-4o-mini).
// SUPABASE_URL и SUPABASE_ANON_KEY функция получает сама: вход проверяется функцией is_teacher (логин и PIN).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";

const LANG: Record<string, string> = { ko: "Korean", en: "English" };
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

/* Форматы экзаменов: что за задания и как их описать модели. */
const EXAMS: Record<string, { lang: string; name: string; sections: Record<string, string> }> = {
  topik1: { lang: "ko", name: "TOPIK I (levels 1–2)", sections: {
    listen: "TOPIK I 듣기: short everyday dialogues/announcements; 4-option multiple choice (choose the right answer, the place, the topic, the matching picture described in words, the next line). Give the audio script.",
    read: "TOPIK I 읽기: notices, messages, short texts; 4-option multiple choice (topic, fill the blank, matching content, order of sentences, main idea).",
  } },
  topik2: { lang: "ko", name: "TOPIK II (levels 3–6)", sections: {
    listen: "TOPIK II 듣기: dialogues, interviews, lectures; 4-option multiple choice (main idea, details, speaker's attitude, what comes next). Give the audio script.",
    read: "TOPIK II 읽기: fill the blank with grammar, headline meaning, matching content, sentence order, main idea of a passage; 4-option multiple choice.",
    write: "TOPIK II 쓰기: task type 51/52 (fill two blanks in a text with a sentence each) or 53 (describe a chart/survey in 200–300 characters, give the data in words) or 54 (argumentative essay 600–700 characters). Writing tasks, no options.",
  } },
  ielts: { lang: "en", name: "IELTS Academic", sections: {
    listen: "IELTS Listening: form/note completion (one word and/or a number), multiple choice, matching. Give the audio script.",
    read: "IELTS Reading: short academic passage; True/False/Not Given, multiple choice, sentence completion (NO MORE THAN TWO WORDS).",
    write: "IELTS Writing Task 1 (describe a chart, data given in words, 150 words) or Task 2 (opinion/discussion essay, 250 words). Writing tasks, no options.",
  } },
  toefl: { lang: "en", name: "TOEFL iBT", sections: {
    listen: "TOEFL Listening: campus conversation or short lecture; 4-option multiple choice (gist, detail, purpose, attitude). Give the audio script.",
    read: "TOEFL Reading: academic passage; 4-option multiple choice (vocabulary in context, factual, negative factual, inference, rhetorical purpose).",
    write: "TOEFL Writing: 'Writing for an Academic Discussion' (professor's question + two student posts, write 100+ words). Writing task, no options.",
  } },
  ege: { lang: "en", name: "ЕГЭ по английскому", sections: {
    listen: "ЕГЭ Аудирование: True/False/Not stated statements and 3-option multiple choice. Give the audio script.",
    read: "ЕГЭ Чтение: match headings to short texts, or fill gaps with sentence parts, or 4-option multiple choice on a passage.",
    gram: "ЕГЭ Грамматика и лексика: transform the word in capitals so it fits the sentence (grammar forms and word formation). Answer is one word; give it in 'a' as text, opts empty.",
    write: "ЕГЭ Письменная речь: task 38 (analyse survey results, 200–250 words, data given in words). Writing task, no options.",
  } },
  oge: { lang: "en", name: "ОГЭ по английскому", sections: {
    listen: "ОГЭ Аудирование: match speakers to statements or 3-option multiple choice on a dialogue. Give the audio script.",
    read: "ОГЭ Чтение: match headings to short texts or True/False/Not stated statements.",
    gram: "ОГЭ Грамматика и лексика: transform the word in capitals so it fits the text. Answer is one word; give it in 'a' as text, opts empty.",
    write: "ОГЭ Письмо: reply to a friend's email answering three questions, 90–120 words. Writing task, no options.",
  } },
};

const LISTEN_FMT: Record<string, string> = {
  lecture: "a short lecture by one speaker (N) on an interesting topic",
  podcast: "a podcast episode with two hosts (A and B) talking casually",
  dialog: "an everyday dialogue between two people (A and B)",
  news: "a short news bulletin read by one speaker (N)",
};
const READ_FMT: Record<string, string> = {
  story: "a short story", article: "a popular-science or magazine article", letter: "a personal letter or email",
  dialog: "a written chat or dialogue", notice: "a notice / advertisement / announcement", blog: "a blog post", news: "a news article",
};
const LEN: Record<string, string> = { s: "short (about 80–120 words, or 150–250 Korean characters)", m: "medium (about 180–250 words, or 350–500 Korean characters)", l: "long (about 350–450 words, or 700–900 Korean characters)" };

function wordList(words: { w: string; t?: string }[]) {
  return words.slice(0, 30).map((x) => `${clip(x.w, 60)}${x.t ? ` (${clip(x.t, 60)})` : ""}`).join(", ");
}

/* Промпт под каждый вид задания. Модель отвечает одним JSON-объектом. */
function prompt(kind: string, lang: string, level: string, words: { w: string; t?: string }[], o: Record<string, unknown>) {
  const L = LANG[lang] || "English";
  const base = `You write learning materials for a Russian-speaking student of ${L} at level ${level || "beginner"}. ` +
    `Keep vocabulary and grammar strictly at this level. Russian is the student's native language: translations, explanations and hints are in Russian. ` +
    `Answer with ONE JSON object only.`;
  const w = words.length ? ` Use as many of these target words as is natural (in any grammatical form): ${wordList(words)}.` : "";
  if (kind === "listen") {
    const f = LISTEN_FMT[String(o.format)] || LISTEN_FMT.dialog;
    return `${base} Write ${f} in ${L}, ${LEN[String(o.len)] || LEN.s}.${w} Then 4 comprehension questions in Russian with 3–4 options each.
JSON: {"title": "ru title", "lines": [{"sp": "A"|"B"|"N", "s": "${L} line", "t": "Russian translation"}], "questions": [{"q": "...", "opts": ["..."], "a": 0, "why": "short explanation in Russian"}], "used": ["target words actually used"]}`;
  }
  if (kind === "read") {
    const f = READ_FMT[String(o.format)] || READ_FMT.story;
    return `${base} Write ${f} in ${L}, ${LEN[String(o.len)] || LEN.s}.${w} Split into paragraphs. Then 4 comprehension questions in Russian with 3–4 options, and a glossary of 6–10 useful words/phrases from the text.
JSON: {"title": "${L} title", "paras": [{"s": "${L} paragraph", "t": "Russian translation"}], "glossary": [{"w": "${L}", "t": "Russian"}], "questions": [{"q": "...", "opts": ["..."], "a": 0, "why": "..."}], "used": ["..."]}`;
  }
  if (kind === "exam") {
    const ex = EXAMS[String(o.exam)] || EXAMS.ielts, sec = ex.sections[String(o.section)] || Object.values(ex.sections)[0];
    const n = Math.max(1, Math.min(8, Number(o.n) || 4));
    return `${base} Create ${n} practice tasks in the format of ${ex.name}. Section: ${sec}${w} Keep the real exam's instructions style (instructions may be in the exam's language), but put explanations ("why") in Russian. Difficulty matches level ${level}.
For listening tasks put the audio script in "audio" as lines [{"sp":"A"|"B"|"N","s":"..."}]. For reading tasks put the passage in "passage". For writing tasks set "type":"write" with "prompt", "min" (min words or characters) and "checklist" (3–5 criteria in Russian).
JSON: {"title": "...", "instructions": "...", "tasks": [{"type": "mc"|"text"|"write", "passage": "...", "audio": [...], "q": "...", "opts": ["..."], "a": 0 or "answer text", "why": "...", "prompt": "...", "min": 0, "checklist": ["..."]}]}`;
  }
  if (kind === "write") {
    const lv = String(o.size || "s");
    return `${base} Create an EASY writing task (${lv === "m" ? "5–8 sentences" : "3–5 sentences"}) in ${L} for this level, on an everyday topic.${w} Pick 3–5 target words the student must use.
Give a checklist the student can verify, hints, useful phrases with translation and a first sentence to start with.
JSON: {"task": "task in Russian", "topic": "...", "must": ["target words to use"], "min": number of words (English) or characters (Korean), "grammar": "one grammar point to use, in ${L} with Russian name", "checklist": ["criteria in Russian"], "hints": ["hints in Russian, from general to specific"], "phrases": [{"s": "${L}", "t": "Russian"}], "start": "${L} first sentence"}`;
  }
  if (kind === "check") {
    return `${base} Check the student's writing in ${L}. Task: ${clip(o.task, 600)}. Checklist: ${clip(JSON.stringify(o.checklist || []), 800)}. Must use words: ${clip(JSON.stringify(o.must || []), 300)}.
Student's text: """${clip(o.text, 3000)}"""
Be kind and specific. Mark each checklist item. List real mistakes only (spelling, grammar, word choice, ${lang === "ko" ? "spacing 띄어쓰기, endings and politeness" : "articles, tenses, prepositions"}). Give a corrected version that keeps the student's ideas.
JSON: {"score": 0-10, "checks": [{"text": "criterion", "ok": true|false, "note": "ru"}], "errors": [{"bad": "fragment", "good": "fix", "why": "ru"}], "corrected": "${L} text", "comment": "2–3 sentences in Russian: what is good and what to work on"}`;
  }
  if (kind === "sent") {
    const n = Math.max(3, Math.min(12, Number(o.n) || 6));
    return `${base} Write ${n} natural ${L} sentences at this level, one target word per sentence${words.length ? "" : " (everyday vocabulary)"}.${w} Short enough for dictation (${lang === "ko" ? "up to 25 characters" : "up to 12 words"}).
JSON: {"items": [{"s": "${L} sentence", "t": "Russian translation", "w": "target word used"}]}`;
  }
  if (kind === "trcheck") {
    return `${base} The student translated sentences. Judge meaning first, then grammar. "ok" = correct meaning and acceptable grammar, "part" = meaning mostly right with mistakes, "no" = wrong meaning.
Items: ${clip(JSON.stringify(o.items || []), 4000)} (src = original, ans = student's translation, ref = a reference translation, dir = "to_ru" or "from_ru").
JSON: {"res": [{"v": "ok"|"part"|"no", "fix": "corrected translation", "why": "short note in Russian"}]}`;
  }
  return "";
}

async function llm(system: string, user: string, temp: number) {
  const base = (env("OPENAI_BASE_URL") || "https://api.openai.com").replace(/\/+$/, "").replace(/\/v1$/, "");
  const r = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("GEN_MODEL") || "gpt-4o-mini", temperature: temp, response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!r.ok) throw new Error(`llm ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(txt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!env("OPENAI_API_KEY"))
    return json({ error: "not_configured", message: "Генерация заданий пока не настроена: в Supabase нужен секрет OPENAI_API_KEY для функции gen." }, 503);
  try {
    const body = await req.json();
    const name = String(body.p_name || "").trim().toLowerCase(), pin = String(body.p_pin || "");
    const kind = String(body.kind || ""), lang = body.lang === "ko" ? "ko" : "en";
    const level = clip(body.level, 12), o = (body.opts && typeof body.opts === "object") ? body.opts : {};
    const words = (Array.isArray(body.words) ? body.words : []).filter((x: any) => x && x.w).slice(0, 30);
    if (!name || !pin) return json({ error: "unauthorized", message: "Войдите на сайт, чтобы создавать задания." }, 401);
    const supa = env("SUPABASE_URL"), anon = env("SUPABASE_ANON_KEY");
    const auth = await fetch(`${supa}/rest/v1/rpc/is_teacher`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ p_name: name, p_pin: pin }), signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) return json({ error: "unauthorized", message: "Не удалось проверить вход. Войдите на сайт заново." }, 401);
    const p = prompt(kind, lang, level, words, o);
    if (!p) return json({ error: "bad_input", message: "Неизвестный вид задания." }, 400);
    const checking = kind === "check" || kind === "trcheck";
    const sys = "You are a careful language teacher and exam-materials writer. Output valid JSON only, no markdown.";
    const out = await llm(sys, p, checking ? 0.2 : 0.8);
    return json({ ok: true, kind, data: out });
  } catch (e) {
    console.error(e);
    return json({ error: "failed", message: "Не получилось создать задание. Попробуй ещё раз." }, 502);
  }
});
