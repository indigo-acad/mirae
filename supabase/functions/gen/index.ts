// MIRAÉ: генерация заданий для блока «Практика» на странице «Слова» (js/wlab.js).
// Тексты на слух (лекция, подкаст, диалог, новости), тексты для чтения, задания в формате экзаменов (TOPIK I / II,
// IELTS, TOEFL, ЕГЭ, ОГЭ), лёгкое письмо с чек-листом и подсказками, предложения для диктанта и перевода,
// проверка письма и переводов. Всё — по уровню ученика и с его словами.
// Вход:  { p_name, p_pin, kind, lang: "ko" | "en", level: "2급" | "A2" | …, words?: {w, t}[], opts?: {...} }
//        kind: listen | read | exam | write | check | sent | trcheck | talk | talk_turn | talk_end
//        base: "ru" | "en" | "ko" — язык переводов, пояснений и подсказок (корейский через английский и наоборот); по умолчанию ru
// Выход: JSON задания (формат — в SPEC ниже) или { error, message }.
// Секреты (один из): GEMINI_API_KEY — бесплатный ключ Google AI Studio (самая новая Flash из списка моделей ключа, лимиты бесплатного тарифа);
//   OPENAI_API_KEY — платный OpenAI (gpt-4o-mini) или ключ OpenAI-совместимого шлюза с OPENAI_BASE_URL. GEN_MODEL — своя модель.
// SUPABASE_URL и SUPABASE_ANON_KEY функция получает сама: вход проверяется функцией is_teacher (логин и PIN).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";

const LANG: Record<string, string> = { ko: "Korean", en: "English", ru: "Russian" };
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

/* Как оценивать письмо: официальные критерии экзаменов (упрощённо) и шкала для лёгкого письма. */
const RUBRIC: Record<string, string> = {
  easy: `Score 0–10 by four criteria (each 0–2.5): "Задание" (task done, ideas clear), "Слова" (required words used correctly), "Грамматика" (grammar and endings), "Орфография" (spelling${"" /* ko: spacing */}).`,
  topik2: `TOPIK II 쓰기 scoring: 내용 및 과제 수행 (content & task), 글의 전개 구조 (organisation), 언어 사용 (language use: grammar/vocabulary range and accuracy, appropriate written style -다/-ㄴ다). Max points: task 51–52: 10 each, 53: 30, 54: 50. Give criterion scores that sum to the total.`,
  ielts: `IELTS Writing band descriptors: Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy, each band 0–9; overall = average rounded to 0.5.`,
  toefl: `TOEFL Academic Discussion rubric 0–5 (relevance and contribution to the discussion, elaboration, language range and accuracy). Criteria: Relevance, Elaboration, Language — then overall 0–5.`,
  ege: `ЕГЭ task 38 criteria: К1 Решение коммуникативной задачи (0–3), К2 Организация текста (0–3), К3 Лексика (0–3), К4 Грамматика (0–3), К5 Орфография и пунктуация (0–2); total 0–14. If fewer than 180 words, К1–К5 = 0.`,
  oge: `ОГЭ email criteria: К1 Решение коммуникативной задачи (0–6: answered 3 questions, greeting, closing, signature, thanks, hope for contacts), К2 Организация текста (0–2), К3 Языковое оформление (0–2); total 0–10.`,
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
function prompt(kind: string, lang: string, level: string, words: { w: string; t?: string }[], o: Record<string, unknown>, base: string) {
  const L = LANG[lang] || "English", B = LANG[base] || "Russian";
  const intro = `You write learning materials for a student of ${L} at level ${level || "beginner"} whose support language is ${B}. ` +
    `Keep vocabulary and grammar strictly at this level. All translations, explanations, questions, hints and feedback are in ${B} (only the target-language text is in ${L}). ` +
    `Answer with ONE JSON object only.`;
  const w = words.length ? ` Use as many of these target words as is natural (in any grammatical form): ${wordList(words)}.` : "";
  if (kind === "listen") {
    const f = LISTEN_FMT[String(o.format)] || LISTEN_FMT.dialog;
    return `${intro} Write ${f} in ${L}, ${LEN[String(o.len)] || LEN.s}.${w} Then 4 comprehension questions in ${B} with 3–4 options each.
JSON: {"title": "title in ${B}", "lines": [{"sp": "A"|"B"|"N", "s": "${L} line", "t": "${B} translation"}], "questions": [{"q": "...", "opts": ["..."], "a": 0, "why": "short explanation in ${B}"}], "used": ["target words actually used"]}`;
  }
  if (kind === "read") {
    const f = READ_FMT[String(o.format)] || READ_FMT.story;
    return `${intro} Write ${f} in ${L}, ${LEN[String(o.len)] || LEN.s}.${w} Split into paragraphs. Then 4 comprehension questions in ${B} with 3–4 options, and a glossary of 6–10 useful words/phrases from the text.
JSON: {"title": "${L} title", "paras": [{"s": "${L} paragraph", "t": "${B} translation"}], "glossary": [{"w": "${L}", "t": "${B}"}], "questions": [{"q": "...", "opts": ["..."], "a": 0, "why": "..."}], "used": ["..."]}`;
  }
  if (kind === "exam") {
    const ex = EXAMS[String(o.exam)] || EXAMS.ielts, sec = ex.sections[String(o.section)] || Object.values(ex.sections)[0];
    const n = Math.max(1, Math.min(8, Number(o.n) || 4));
    return `${intro} Create ${n} practice tasks in the format of ${ex.name}. Section: ${sec}${w} Keep the real exam's instructions style (instructions may be in the exam's language), but put explanations ("why") in ${B}. Difficulty matches level ${level}.
For listening tasks put the audio script in "audio" as lines [{"sp":"A"|"B"|"N","s":"..."}]. For reading tasks put the passage in "passage". For writing tasks set "type":"write" with "prompt", "min" (min words or characters) and "checklist" (3–5 criteria in ${B}).
JSON: {"title": "...", "instructions": "...", "tasks": [{"type": "mc"|"text"|"write", "passage": "...", "audio": [...], "q": "...", "opts": ["..."], "a": 0 or "answer text", "why": "...", "prompt": "...", "min": 0, "checklist": ["..."]}]}`;
  }
  if (kind === "write") {
    const lv = String(o.size || "s");
    return `${intro} Create an EASY writing task (${lv === "m" ? "5–8 sentences" : "3–5 sentences"}) in ${L} for this level, on an everyday topic.${w} Pick 3–5 target words the student must use.
Give a checklist the student can verify, hints, useful phrases with translation and a first sentence to start with.
JSON: {"task": "task in ${B}", "topic": "...", "must": ["target words to use"], "min": number of words (English) or characters (Korean), "grammar": "one grammar point to use, in ${L} with ${B} name", "checklist": ["criteria in ${B}"], "hints": ["hints in ${B}, from general to specific"], "phrases": [{"s": "${L}", "t": "${B}"}], "start": "${L} first sentence"}`;
  }
  if (kind === "check") {
    return `${intro} Check the student's writing in ${L}. Task: ${clip(o.task, 600)}. Checklist: ${clip(JSON.stringify(o.checklist || []), 800)}. Must use words: ${clip(JSON.stringify(o.must || []), 300)}.
Student's text: """${clip(o.text, 3000)}"""
Scoring: ${RUBRIC[String(o.exam || "easy")] || RUBRIC.easy} Be fair for level ${level}: an easy task is judged against this level, an exam task against the real exam standard.
Be kind and specific. Mark each checklist item. List real mistakes only (spelling, grammar, word choice, ${lang === "ko" ? "spacing 띄어쓰기, endings and politeness" : "articles, tenses, prepositions"}). Give a corrected version that keeps the student's ideas.
JSON: {"score": total, "max": max total (10 for easy, 9 for IELTS, 5 for TOEFL, 14 for ЕГЭ, 10 for ОГЭ, task max for TOPIK), "scale": "points"|"band", "criteria": [{"name": "criterion", "score": number, "max": number, "note": "1 sentence in ${B}"}], "level_hint": "what level this text shows, e.g. 2급 / B1", "checks": [{"text": "criterion", "ok": true|false, "note": "in ${B}"}], "errors": [{"bad": "fragment", "good": "fix", "why": "in ${B}"}], "corrected": "${L} text", "comment": "2–3 sentences in ${B}: what is good and what to work on"}`;
  }
  if (kind === "sent") {
    const n = Math.max(3, Math.min(12, Number(o.n) || 6));
    return `${intro} Write ${n} natural ${L} sentences at this level, one target word per sentence${words.length ? "" : " (everyday vocabulary)"}.${w} Short enough for dictation (${lang === "ko" ? "up to 25 characters" : "up to 12 words"}).
JSON: {"items": [{"s": "${L} sentence", "t": "${B} translation", "w": "target word used"}]}`;
  }
  if (kind === "talk") {
    const topic = clip(o.topic, 200);
    return `${intro} Start a short spoken-style conversation practice in ${L}.${topic ? " Topic: " + topic + "." : " Pick an everyday situation that suits the level (cafe, plans for the weekend, hobbies, travel, school…)."}${w}
You play a friendly partner with a name and a role. Give the scene, 3 goals the student should reach in the conversation (in ${B}), 4–6 useful phrases, and your first line (short, ends with a question).
JSON: {"title": "in ${B}", "scene": "in ${B}", "partner": "name and role", "goals": ["..."], "phrases": [{"s": "${L}", "t": "${B}"}], "first": {"s": "${L}", "t": "${B}"}}`;
  }
  if (kind === "talk_turn") {
    return `${intro} Continue a conversation practice in ${L}. Scene: ${clip(o.scene, 400)}. You are: ${clip(o.partner, 120)}. Goals for the student: ${clip(JSON.stringify(o.goals || []), 500)}.
History (P = you, S = student): ${clip(JSON.stringify(o.history || []), 5000)}
Reply as the partner: 1–2 short sentences at level ${level}, natural, keep the conversation going with a question unless the goals are reached. If the student's last line has a real mistake, give one gentle correction (otherwise null). Also say which goals are reached so far (indexes).
JSON: {"s": "${L} reply", "t": "${B} translation", "fix": {"bad": "...", "good": "...", "why": "in ${B}"} | null, "reached": [0], "done": true|false}`;
  }
  if (kind === "talk_end") {
    return `${intro} The student finished a conversation practice in ${L}. Scene: ${clip(o.scene, 400)}. Goals: ${clip(JSON.stringify(o.goals || []), 500)}.
History (P = partner, S = student): ${clip(JSON.stringify(o.history || []), 6000)}
Evaluate the student's lines only. Criteria (each 0–5): "Задача" (goals reached, answers to the point), "Беглость" (complete sentences, keeps the talk going), "Лексика", "Грамматика". Then 3–6 corrected lines and 3–5 phrases worth learning.
JSON: {"score": 0-20, "max": 20, "criteria": [{"name": "...", "score": 0-5, "max": 5, "note": "in ${B}"}], "fixes": [{"bad": "...", "good": "...", "why": "in ${B}"}], "learn": [{"s": "${L}", "t": "${B}"}], "comment": "2–3 sentences in ${B}"}`;
  }
  if (kind === "trcheck") {
    return `${intro} The student translated sentences. Judge meaning first, then grammar. "ok" = correct meaning and acceptable grammar, "part" = meaning mostly right with mistakes, "no" = wrong meaning.
Items: ${clip(JSON.stringify(o.items || []), 4000)} (src = original, ans = student's translation, ref = a reference translation, dir = "to_ru" or "from_ru").
JSON: {"res": [{"v": "ok"|"part"|"no", "fix": "corrected translation", "why": "short note in ${B}"}]}`;
  }
  return "";
}

/* Модель: OpenAI или любой OpenAI-совместимый адрес (OPENAI_BASE_URL). Бесплатно — Gemini (секрет GEMINI_API_KEY):
   адрес подставляется сам, модель — см. geminiModel. */
/* Модель Gemini: своя (секрет GEN_MODEL / STT_MODEL) или самая новая стабильная Flash из списка моделей ключа.
   Google меняет модели (старые закрывает для новых ключей), поэтому название не зашито: список берётся один раз
   на запуск функции, при ответе 404 — заново. */
let PICKED = "";
async function geminiModel(force = false) {
  if (PICKED && !force) return PICKED;
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": env("GEMINI_API_KEY") }, signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    const names: string[] = (j.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m: any) => String(m.name).replace(/^models\//, ""));
    const ver = (n: string) => (n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0";
    const flash = names.filter((n) => /^gemini-\d+(\.\d+)?-flash$/.test(n));
    const loose = names.filter((n) => /flash/.test(n) && !/lite|image|tts|live|audio|thinking|exp|preview|embed/.test(n));
    const pool = flash.length ? flash : loose;
    pool.sort((a, b) => parseFloat(ver(b)) - parseFloat(ver(a)));
    PICKED = pool[0] || (names.includes("gemini-flash-latest") ? "gemini-flash-latest" : "");
  } catch (e) { console.error("models", e); }
  return PICKED || "gemini-flash-latest";
}
async function provider(force = false) {
  if (env("GEMINI_API_KEY") && !env("OPENAI_API_KEY"))
    return { url: "https://generativelanguage.googleapis.com/v1beta/openai", key: env("GEMINI_API_KEY"), model: env("GEN_MODEL") || await geminiModel(force), gemini: true };
  let url = (env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!/\/v\d[^/]*(\/openai)?$/.test(url) && !/\/openai$/.test(url)) url += "/v1";   // https://host → https://host/v1
  return { url, key: env("OPENAI_API_KEY"), model: env("GEN_MODEL") || "gpt-4o-mini", gemini: false };
}
function parseJson(txt: string) {
  try { return JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error("not json"); }
}
/* Gemini напрямую (не через совместимый с OpenAI адрес): так можно выключить «размышления» модели — с ними
   задание готовится больше минуты — и попросить ответ сразу в JSON. Какой способ выключения примет модель, узнаём
   по ошибке 400 и запоминаем: thinkingLevel (новые модели) → thinkingBudget 0 → без настройки. */
const THINK = [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, { thinkingBudget: 0 }, null];
let thinkAt = 0;
async function geminiCall(system: string, user: string, temp: number, force = false): Promise<any> {
  const model = env("GEN_MODEL") || await geminiModel(force);
  for (let i = thinkAt; i < THINK.length; i++) {
    const tc = THINK[i];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: temp, responseMimeType: "application/json", ...(tc ? { thinkingConfig: tc } : {}) },
      }),
      signal: AbortSignal.timeout(75000),
    });
    if (r.status === 400 && tc) { console.log("thinking config refused", JSON.stringify(tc)); continue; }
    if (r.status === 404 && !force && !env("GEN_MODEL")) return geminiCall(system, user, temp, true);   // модель закрыли: берём новую
    if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
    thinkAt = i;
    const j = await r.json();
    return parseJson((j?.candidates?.[0]?.content?.parts || []).filter((x: any) => !x.thought).map((x: any) => x.text || "").join("") || "{}");
  }
  throw new Error("gemini: no config accepted");
}
async function llm(system: string, user: string, temp: number) {
  if (env("GEMINI_API_KEY") && !env("OPENAI_API_KEY")) return geminiCall(system, user, temp);
  let P = await provider();
  const call = (fmt: boolean) => fetch(`${P.url}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${P.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: P.model, temperature: temp, ...(fmt ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  let r = await call(true);
  if (r.status === 400) r = await call(false);   // шлюз не знает response_format: просим JSON словами
  if (!r.ok) throw new Error(`llm ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return parseJson(j?.choices?.[0]?.message?.content || "{}");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!env("OPENAI_API_KEY") && !env("GEMINI_API_KEY"))
    return json({ error: "not_configured", message: "Генерация заданий пока не настроена: преподавателю нужно добавить ключ модели (GEMINI_API_KEY или OPENAI_API_KEY) в Supabase." }, 503);
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
    const base = ["ru", "en", "ko"].includes(String(body.base)) && body.base !== lang ? String(body.base) : "ru";
    const p = prompt(kind, lang, level, words, o, base);
    if (!p) return json({ error: "bad_input", message: "Неизвестный вид задания." }, 400);
    const checking = kind === "check" || kind === "trcheck" || kind === "talk_end";
    const sys = "You are a careful language teacher and exam-materials writer. Output valid JSON only, no markdown.";
    const out = await llm(sys, p, checking ? 0.2 : 0.8);
    return json({ ok: true, kind, data: out });
  } catch (e) {
    console.error(e);
    return json({ error: "failed", message: "Не получилось создать задание. Попробуй ещё раз." }, 502);
  }
});
