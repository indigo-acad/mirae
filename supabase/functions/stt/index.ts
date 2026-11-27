// MIRAÉ: распознавание речи на сервере (Gemini, бесплатно; или OpenAI). Нужна там, где распознавание браузера недоступно:
// из России (Chrome и Edge распознают через серверы Google и Microsoft), в Firefox, после сетевой ошибки браузера.
// Вход:  { p_name, p_pin, lang: "ko" | "en", audio: base64 (до ~6 МБ), mime: "audio/wav" (сайт переводит запись в WAV 16 кГц моно) …, prompt?: подсказка }
// Выход: { text } или { error, message }.
// Секреты (один из): GEMINI_API_KEY — бесплатно (модель STT_MODEL или самая новая Flash ключа, расшифровка «как сказано», без исправлений);
//   OPENAI_API_KEY — платно (gpt-4o-mini-transcribe, запасной whisper-1), по желанию OPENAI_BASE_URL. Вход проверяется is_teacher (логин и PIN).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";

function base() {
  let url = (env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(/\/+$/, "");
  if (!/\/v\d[^/]*$/.test(url)) url += "/v1";
  return url;
}
const EXT: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a" };

const LN: Record<string, string> = { ko: "Korean", en: "English", ru: "Russian" };
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
/* Gemini: аудио прямо в запросе. Просим расшифровать дословно, с ошибками ученика: по тексту сайт проверяет произношение. */
async function gemini(b64: string, mime: string, lang: string, prompt: string) {
  let model = env("STT_MODEL") || await geminiModel();
  const ask = `Transcribe this ${LN[lang] || "Korean"} speech by a language learner exactly as spoken, word for word, keeping the learner's mistakes and mispronounced words as heard. ` +
    `Do not translate, correct or add anything. Output only the transcript in ${LN[lang] || "Korean"} script. If there is no speech, output nothing.` +
    (prompt ? ` The learner was trying to say something like: "${prompt.slice(0, 200)}" — use this only to choose between similar-sounding words, never to fix mistakes.` : "");
  const call = (m: string, think: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
    body: JSON.stringify({ contents: [{ parts: [{ text: ask }, { inline_data: { mime_type: mime.split(";")[0] || "audio/wav", data: b64 } }] }],
      generationConfig: think ? { temperature: 0, thinkingConfig: { thinkingBudget: 0 } } : { temperature: 0 } }),
    signal: AbortSignal.timeout(30000),
  });
  let r = await call(model, true);
  if (r.status === 404 && !env("STT_MODEL")) { model = await geminiModel(true); r = await call(model, true); }   // модель закрыли: берём новую
  if (r.status === 400) r = await call(model, false);   // модель не знает настройку «размышлений»
  if (!r.ok) throw new Error(`gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return String((j?.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || "").join("")).trim().replace(/^["«]|["»]$/g, "");
}
async function transcribe(bytes: Uint8Array, mime: string, lang: string, prompt: string, model: string) {
  const type = mime.split(";")[0] || "audio/webm";
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type }), "speech." + (EXT[type] || "webm"));
  fd.append("model", model);
  fd.append("language", lang);
  if (prompt) fd.append("prompt", prompt.slice(0, 200));
  return fetch(`${base()}/audio/transcriptions`, {
    method: "POST", headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}` }, body: fd, signal: AbortSignal.timeout(30000),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!env("OPENAI_API_KEY") && !env("GEMINI_API_KEY"))
    return json({ error: "not_configured", message: "Распознавание речи на сервере не настроено: нужен секрет GEMINI_API_KEY." }, 503);
  try {
    const body = await req.json();
    const name = String(body.p_name || "").trim().toLowerCase(), pin = String(body.p_pin || "");
    if (!name || !pin) return json({ error: "unauthorized", message: "Войдите на сайт." }, 401);
    const audio = String(body.audio || "");
    if (!audio || audio.length > 8_000_000) return json({ error: "bad_input", message: "Запись пустая или слишком длинная." }, 400);
    const supa = env("SUPABASE_URL"), anon = env("SUPABASE_ANON_KEY");
    const auth = await fetch(`${supa}/rest/v1/rpc/is_teacher`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ p_name: name, p_pin: pin }), signal: AbortSignal.timeout(10000),
    });
    if (!auth.ok) return json({ error: "unauthorized", message: "Не удалось проверить вход. Войдите на сайт заново." }, 401);
    const lang = body.lang === "en" ? "en" : body.lang === "ru" ? "ru" : "ko";
    const mime = String(body.mime || "audio/wav"), prompt = String(body.prompt || "");
    if (env("GEMINI_API_KEY")) return json({ text: await gemini(audio, mime, lang, prompt) });
    const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    const model = env("OPENAI_STT_MODEL") || "gpt-4o-mini-transcribe";
    let r = await transcribe(bytes, mime, lang, prompt, model);
    if (!r.ok && model !== "whisper-1" && (r.status === 400 || r.status === 404)) r = await transcribe(bytes, mime, lang, prompt, "whisper-1");
    if (!r.ok) { console.error("stt", r.status, (await r.text()).slice(0, 300)); return json({ error: "failed", message: "Не получилось распознать. Попробуй ещё раз." }, 502); }
    const j = await r.json();
    return json({ text: String(j.text || "").trim() });
  } catch (e) {
    console.error(e);
    return json({ error: "failed", message: "Не получилось распознать. Попробуй ещё раз." }, 502);
  }
});
