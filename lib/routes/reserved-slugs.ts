/**
 * RESERVED_TOP_LEVEL_SLUGS — единый источник правды: односегментные пути,
 * которые являются РАЗДЕЛАМИ ПРИЛОЖЕНИЯ, а не публичными страницами клубов
 * (/[orgSlug]).
 *
 * Потребители:
 *   - lib/supabase/middleware.ts — путь НЕ из списка и вида /[slug] =
 *     публичная страница клуба (без auth-редиректа);
 *   - components/assistant/FloatingAssistant.tsx — на таких страницах
 *     плавающий AI-помощник не рендерится.
 *
 * Ревью-находка: два рассинхронизированных хардкода упускали ~12 реальных
 * разделов (/templates, /notes, /challenges, /competitions…) — виджет
 * пропадал на них, а middleware не требовал авторизацию. Новый top-level
 * раздел добавляйте СЮДА (тест в floating-assistant.test.ts перебирает
 * все href сайдбара и упадёт, если раздел не учтён).
 */
/**
 * PUBLIC_APP_SLUGS — разделы приложения, которые ОДНОВРЕМЕННО:
 *   • зарезервированы (это не страница клуба);
 *   • открыты без авторизации.
 *
 * Два свойства независимы, и их смешение стало регрессией: добавление
 * 'about'/'contacts' в список зарезервированных увело маркетинговые
 * страницы за форму входа, хотя на них ведут ссылки с лендинга и из
 * политики конфиденциальности — то есть их читают именно анонимные
 * посетители. '/directory' — точка входа в публичный поиск тренеров,
 * редиректит в /network (публичный префикс).
 */
export const PUBLIC_APP_SLUGS = new Set<string>([
  'about', 'contacts', 'directory',
  // 'pricing' — витрина тарифов. Ссылки «Тарифы» стоят на /about, /contacts,
  // на форме регистрации и в лендингах /p и /tools, то есть её открывают
  // именно анонимные посетители; за формой входа она бессмысленна.
  'pricing',
])

export const RESERVED_TOP_LEVEL_SLUGS = new Set<string>([
  // ядро приложения
  'dashboard', 'calendar', 'diary', 'analytics', 'athletes', 'messages',
  'settings', 'pricing', 'admin', 'org', 'auth', 'api', 'onboarding',
  // разделы кабинета ('assistant' — страницы больше нет (вход в помощника
  // только через плавающий виджет), но slug остаётся зарезервированным:
  // иначе /assistant прочитается как публичная страница клуба)
  'assistant', 'channels', 'workouts', 'profile', 'network', 'insights',
  'load', 'quick', 'ai', 'injuries', 'goals', 'records', 'cycles',
  'marketplace', 'coach', 'doctor', 'athlete', 'parent', 'form-analysis',
  'templates', 'notes', 'challenges', 'competitions', 'streaks',
  'notifications', 'connections', 'contacts', 'directory', 'search',
  'share', 'about',
  // публичные префиксы (не org-страницы)
  'legal', 'demo', 'tools', 'invite', 'p',
])
