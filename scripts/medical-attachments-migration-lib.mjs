/**
 * Чистые правила переноса медицинских файлов (scripts/migrate-medical-
 * attachments.mjs) — без сети, чтобы их можно было проверить тестами.
 */
export const PUBLIC_BUCKET = 'note-attachments'
export const PRIVATE_BUCKET = 'medical-private'
const PUBLIC_MARKER = `/storage/v1/object/public/${PUBLIC_BUCKET}/`

/** Ссылка ведёт в публичный бакет note-attachments. */
export function isPublicUrl(url) {
  return typeof url === 'string' && url.includes(PUBLIC_MARKER)
}

/** Путь объекта в публичном бакете по его публичной ссылке. null — не
 *  ссылка на бакет или она не разбирается (битая %-последовательность). */
export function publicPathFromUrl(url) {
  if (!isPublicUrl(url)) return null
  try {
    return decodeURIComponent(url.slice(url.indexOf(PUBLIC_MARKER) + PUBLIC_MARKER.length).split('?')[0])
  } catch {
    return null
  }
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Вложение дневника лежит в папке своего автора: {auth_id}/med/{имя}. */
export function diaryOwned(path, authId) {
  return !!authId && new RegExp(`^${escapeRe(authId)}/med/[^/]+$`).test(path)
}

/** Выгрузка Apple Health — в папке владельца: {users.id}/[health-private/]apple_health/{имя}. */
export function healthOwned(path, userId) {
  return !!userId && new RegExp(`^${escapeRe(userId)}/(health-private/)?apple_health/[^/]+$`).test(path)
}

/** Вложения со старой публичной ссылкой → вид с путём, если файл перенесён. */
export function rewriteAttachments(atts, moved) {
  return (atts ?? []).map(att => {
    const from = att && !att.path ? publicPathFromUrl(att.url) : null
    if (!from || !moved.has(from)) return att
    const next = { ...att, path: moved.get(from) }
    delete next.url
    return next
  })
}
