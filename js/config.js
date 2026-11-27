// Supabase проекта школы. Ключ publishable открытый по замыслу: данные закрыты функциями с проверкой PIN.
// Секретный ключ (sb_secret_...) сюда класть нельзя.
window.CONFIG = {
  SUPABASE_URL: "https://nusfkwtmnbhnbnckhrfk.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_UmWyFo7ciEc-m9x1ZIfkNw_yeQQAgf8",
  SITE: "school",
  // Помощник (пока заглушка: кнопка и панель без ответов).
  // false — выключен, "teacher" — виден только преподавателю, true — виден всем вошедшим ученикам.
  ASSISTANT: "teacher",
  // Адрес серверной части помощника. Появится позже, пока пусто.
  ASSISTANT_URL: "",
  // Перевод по выделению в уроке. Сначала всегда ищем в словах уроков и в словаре ученика, потом здесь:
  // "mymemory" — бесплатный машинный перевод (выделенный текст уходит на api.mymemory.translated.net);
  // адрес своей функции (например, Supabase Edge Function) — если подключите другой переводчик; false — только свои слова.
  TRANSLATE: "mymemory",
  // Облачный голос для озвучки (функция supabase/functions/tts). Пусто: говорит лучший голос устройства.
  // Пока в Supabase не добавлены ключи голосов, функция отвечает «не настроено» и сайт говорит голосом устройства.
  // Записи голоса из уроков (блоки «скажи / запиши голосом») уходят преподавателю в Telegram вместе с распознанным текстом.
  // Тот же бот, что у материалов сайта (materials/…/index.html).
  TG_TOKEN: "9252730022:AAGhfn1DzR05foOHV6zFiTirJlRqSoUCgTU",
  TG_CHAT_ID: "347625701",
  TTS_URL: "https://nusfkwtmnbhnbnckhrfk.supabase.co/functions/v1/tts",
  // Генерация текстов и заданий для «Слова» → «Практика» (функция supabase/functions/gen, секрет OPENAI_API_KEY).
  // Пусто — берётся SUPABASE_URL + /functions/v1/gen.
  GEN_URL: ""
};
