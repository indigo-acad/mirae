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
  ASSISTANT_URL: ""
};
