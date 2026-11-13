// MIRAÉ: translate a student's word list with DeepL.
// Required Supabase secrets: DEEPL_AUTH_KEY. Deploy with --no-verify-jwt only
// if your project setup requires it; the handler independently verifies the school PIN.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

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
    const deeplKey = Deno.env.get("DEEPL_AUTH_KEY");
    if (!deeplKey) return json({ error: "missing_deepl_secret" }, 503);

    // is_teacher authenticates any valid school account; false means a valid student, not an auth failure.
    const auth = await fetch(`${supabaseUrl}/rest/v1/rpc/is_teacher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_name: name, p_pin: pin }),
    });
    if (!auth.ok) return json({ error: "unauthorized", message: "Не удалось проверить вход. Войдите на сайт заново." }, 401);

    const clean = words.map((w: unknown) => String(w || "").trim()).filter(Boolean);
    if (!clean.length || clean.length > 80 || clean.some((w: string) => w.length > 100))
      return json({ error: "bad_input", message: "Слишком длинный список или отдельное слово." }, 400);

    const endpoint = deeplKey.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
    const translated = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${deeplKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, target_lang: "RU" }),
    });
    const result = await translated.json();
    if (!translated.ok) {
      console.error("DeepL error", translated.status, result?.message || result);
      return json({ error: "deepl_error", message: "DeepL временно не смог перевести список." }, 502);
    }
    return json({ translations: (result.translations || []).map((x: { text?: string }) => x.text || "") });
  } catch (e) {
    console.error("translate-words error", e);
    return json({ error: "server_error", message: "Ошибка сервера перевода." }, 500);
  }
});
