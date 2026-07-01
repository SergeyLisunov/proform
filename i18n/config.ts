// i18n — конфиг локалей (Этап 0: cookie-based RU/EN, без URL-роутинга).
//
// Локаль хранится в cookie NEXT_LOCALE (не httpOnly — читается и сервером
// через i18n/request.ts, и клиентом в LanguageToggle). Дефолт — 'ru'
// (RU/CIS-рынок). Провайдер смонтирован только в app/auth/layout.tsx, чтобы
// не делать статичный лендинг динамическим — i18n трогает пока только auth.

export const LOCALES = ['ru', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ru'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/** Нативные названия локалей (для тумблера — показываем на своём языке всегда). */
export const LOCALE_LABEL: Record<Locale, string> = {
  ru: 'Рус',
  en: 'Eng',
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value != null && (LOCALES as readonly string[]).includes(value)
}
