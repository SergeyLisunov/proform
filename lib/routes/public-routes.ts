import { RESERVED_TOP_LEVEL_SLUGS, PUBLIC_APP_SLUGS } from './reserved-slugs'

/**
 * Единственное место, где живёт правило «этот путь открыт анониму».
 *
 * ПОЧЕМУ ФУНКЦИЯ, А НЕ НАБОР ФЛАГОВ В MIDDLEWARE. Правило было расписано
 * шестью локальными переменными прямо в гейте, и проверить его можно было
 * только живым запросом. Так и накопились три независимых промаха, каждый
 * из которых уводил публичную страницу за форму входа:
 *
 *   • /legal/privacy и /legal/terms — признак `isLegalRoute` учитывался
 *     ТОЛЬКО в гейте для авторизованных. Вышло наоборот: документы читал
 *     тот, кто уже вошёл, а тот, кто решает, соглашаться ли, — не мог;
 *   • /tools — префикс проверялся как '/tools/', со слешем, поэтому сам
 *     индекс раздела под правило не подпадал;
 *   • /pricing — не попал в PUBLIC_APP_SLUGS, хотя ссылки «Тарифы» стоят
 *     на /about, /contacts, /auth/register и в лендингах /p и /tools.
 *
 * Вынесенная функция проверяется юнит-тестами по списку путей, а не
 * чтением исходника middleware — см. public-routes.test.ts.
 */

/**
 * Разделы, открытые целиком вместе со вложенными путями.
 * Каждый элемент покрывает и сам раздел, и всё под ним: '/legal' разрешает
 * '/legal' и '/legal/privacy', но НЕ '/legalese'.
 */
const PUBLIC_SECTIONS = [
  '/auth',     // вход, регистрация, восстановление пароля
  '/api',      // маршруты сами отвечают 401/404 в JSON, редирект их ломает
  '/legal',    // политика конфиденциальности и условия использования
  '/tools',    // лид-магниты
  '/invite',   // приглашения по токену
  '/p',        // публичные страницы клубов
  '/demo',     // демо-витрины на вымышленных данных
  '/network',  // публичный поиск тренеров
] as const

function inPublicSection(pathname: string): boolean {
  return PUBLIC_SECTIONS.some(s => pathname === s || pathname.startsWith(`${s}/`))
}

/**
 * Страница клуба вида /club-slug: один сегмент, который не занят разделом
 * приложения. Список зарезервированных — единый источник правды.
 */
function isOrgPublicPage(pathname: string): boolean {
  return /^\/[a-z0-9-]+$/.test(pathname) && !RESERVED_TOP_LEVEL_SLUGS.has(pathname.slice(1))
}

/** Открыт ли путь посетителю без авторизации. */
export function isAnonymousAllowed(pathname: string): boolean {
  if (pathname === '/') return true
  if (inPublicSection(pathname)) return true
  if (PUBLIC_APP_SLUGS.has(pathname.slice(1))) return true
  return isOrgPublicPage(pathname)
}
