// MIRAÉ: облачная озвучка корейского и английского нейронными голосами.
// Сайт шлёт POST { text, lang: "ko" | "en", accent: "gb" | "us", p_name, p_pin } и получает mp3.
// Озвучивает только вошедший ученик или преподаватель: логин и PIN проверяются в базе школы.
// Готовая фраза кладётся в хранилище Supabase (корзина "tts"), повторная озвучка бесплатна.
//
// Провайдер выбирается секретом TTS_PROVIDER, ключи тоже в секретах (Edge Functions → Secrets):
//   azure  — AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (например westeurope)
//   google — GOOGLE_TTS_API_KEY
//   openai — OPENAI_API_KEY; OPENAI_BASE_URL — для OpenAI-совместимого шлюза (например OmniRoute), TTS_MODEL
// Голоса по желанию: TTS_VOICE_KO, TTS_VOICE_EN_GB, TTS_VOICE_EN_US.
// Развёртывание без проверки JWT (ключ сайта publishable, не JWT): вход проверяет сама функция.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-mirae-voice, x-mirae-cache",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => (Deno.env.get(k) || "").trim();
const MAX_TEXT = 600;

type Voice = { locale: string; name: string };
const DEFAULT_VOICES: Record<string, Record<string, string>> = {
  azure: { "ko-KR": "ko-KR-SunHiNeural", "en-GB": "en-GB-SoniaNeural", "en-US": "en-US-JennyNeural" },
  google: { "ko-KR": "ko-KR-Neural2-A", "en-GB": "en-GB-Neural2-A", "en-US": "en-US-Neural2-F" },
  openai: { "ko-KR": "coral", "en-GB": "coral", "en-US": "coral" },
};
// Для моделей, которые понимают указания (gpt-4o-mini-tts и похожие): акцент и спокойный темп для урока.
const STYLE: Record<string, string> = {
  "ko-KR": "Speak natural standard Seoul Korean, clearly and calmly, at a teaching pace.",
  "en-GB": "Speak with a natural British English (Received Pronunciation) accent, clearly and calmly, at a teaching pace.",
  "en-US": "Speak with a natural General American accent, clearly and calmly, at a teaching pace.",
};

function pickVoice(provider: string, lang: string, accent: string): Voice {
  const locale = lang === "ko" ? "ko-KR" : accent === "us" ? "en-US" : "en-GB";
  const own = env(locale === "ko-KR" ? "TTS_VOICE_KO" : locale === "en-US" ? "TTS_VOICE_EN_US" : "TTS_VOICE_EN_GB");
  return { locale, name: own || DEFAULT_VOICES[provider][locale] };
}
const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

async function synthesize(provider: string, text: string, v: Voice): Promise<ArrayBuffer> {
  if (provider === "azure") {
    const region = env("AZURE_SPEECH_REGION");
    const url = env("AZURE_TTS_ENDPOINT") || `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": env("AZURE_SPEECH_KEY"),
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "mirae-tts",
      },
      body: `<speak version='1.0' xml:lang='${v.locale}'><voice name='${xml(v.name)}'>${xml(text)}</voice></speak>`,
    });
    if (!r.ok) throw new Error(`azure ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.arrayBuffer();
  }
  if (provider === "google") {
    const url = (env("GOOGLE_TTS_ENDPOINT") || "https://texttospeech.googleapis.com/v1/text:synthesize") + "?key=" + encodeURIComponent(env("GOOGLE_TTS_API_KEY"));
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { text }, voice: { languageCode: v.locale, name: v.name }, audioConfig: { audioEncoding: "MP3" } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.audioContent) throw new Error(`google ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return Uint8Array.from(atob(j.audioContent), (c) => c.charCodeAt(0)).buffer;
  }
  // openai и любые OpenAI-совместимые шлюзы
  const base = (env("OPENAI_BASE_URL") || "https://api.openai.com").replace(/\/+$/, "").replace(/\/v1$/, "");
  const model = env("TTS_MODEL") || "gpt-4o-mini-tts";
  const r = await fetch(`${base}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice: v.name, input: text, response_format: "mp3", instructions: STYLE[v.locale] }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.arrayBuffer();
}

function configured(provider: string): boolean {
  if (provider === "azure") return !!(env("AZURE_SPEECH_KEY") && (env("AZURE_SPEECH_REGION") || env("AZURE_TTS_ENDPOINT")));
  if (provider === "google") return !!env("GOOGLE_TTS_API_KEY");
  if (provider === "openai") return !!env("OPENAI_API_KEY");
  return false;
}

async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- хранилище: готовые фразы ----------
const BUCKET = "tts";
function storage() {
  const url = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? { url, h: { Authorization: `Bearer ${key}`, apikey: key } } : null;
}
async function cached(path: string): Promise<ArrayBuffer | null> {
  const s = storage(); if (!s) return null;
  try {
    const r = await fetch(`${s.url}/storage/v1/object/${BUCKET}/${path}`, { headers: s.h });
    return r.ok ? await r.arrayBuffer() : null;
  } catch { return null; }
}
async function keep(path: string, audio: ArrayBuffer) {
  const s = storage(); if (!s) return;
  const put = () => fetch(`${s.url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST", headers: { ...s.h, "Content-Type": "audio/mpeg", "x-upsert": "true" }, body: audio,
  });
  try {
    let r = await put();
    if (!r.ok) {   // корзины ещё нет: создаём закрытую и пробуем снова
      await fetch(`${s.url}/storage/v1/bucket`, { method: "POST", headers: { ...s.h, "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) });
      r = await put();
    }
    if (!r.ok) console.error("tts cache upload", r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error("tts cache", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || "").normalize("NFC").replace(/\s+/g, " ").trim();
    const lang = String(body.lang || "").slice(0, 2).toLowerCase();
    const accent = body.accent === "us" ? "us" : "gb";
    const name = String(body.p_name || "").trim().toLowerCase(), pin = String(body.p_pin || "");
    if (!text || text.length > MAX_TEXT || (lang !== "ko" && lang !== "en")) return json({ error: "bad_input" }, 400);
    if (!name || !pin) return json({ error: "unauthorized" }, 401);

    const provider = env("TTS_PROVIDER").toLowerCase();
    if (!DEFAULT_VOICES[provider] || !configured(provider)) return json({ error: "not_configured" }, 503);

    // вход: is_teacher отвечает для любого действующего аккаунта школы, ошибка — неверный логин или PIN
    const supa = env("SUPABASE_URL"), anon = env("SUPABASE_ANON_KEY");
    const auth = await fetch(`${supa}/rest/v1/rpc/is_teacher`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: anon, Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ p_name: name, p_pin: pin }),
    });
    if (!auth.ok) return json({ error: "unauthorized" }, 401);

    const v = pickVoice(provider, lang, accent);
    const path = `${v.locale}/${await sha256([provider, env("TTS_MODEL"), v.name, text].join("|"))}.mp3`;
    let audio = await cached(path), hit = !!audio;
    if (!audio) { audio = await synthesize(provider, text, v); await keep(path, audio); }
    return new Response(audio, { headers: { ...cors, "Content-Type": "audio/mpeg", "X-Mirae-Voice": v.name, "X-Mirae-Cache": hit ? "hit" : "miss" } });
  } catch (e) {
    console.error("tts error", e);
    return json({ error: "provider_error" }, 502);
  }
});
