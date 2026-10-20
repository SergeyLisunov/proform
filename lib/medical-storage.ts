/**
 * Медицинские файлы — в закрытом бакете (миграция 117).
 *
 * ЗАЧЕМ. Раньше вложения медицинского дневника и выгрузки Apple Health
 * лежали в публичном бакете note-attachments: кто видел ссылку однажды,
 * читал файл всегда. Теперь в записи хранится только путь, а ссылку на
 * файл база выдаёт на время и только тому, кому видна сама запись.
 *
 * Путь начинается с users.id автора: политика бакета пускает загружать
 * только в свою папку и связывает файл с записью её автора.
 *
 * Без React — модуль нужен и серверным маршрутам, и клиенту
 * (lib/medical-attachments — хук подписанных ссылок).
 */
export const MEDICAL_BUCKET = 'medical-private'

/** Вложение записи: path — в закрытом бакете; url — старая публичная
 *  ссылка, до переноса скриптом scripts/migrate-medical-attachments.mjs. */
export interface StoredAttachment {
  path?: string
  url?: string
}

/** Подпапки внутри папки автора. */
export type MedicalFolder = 'med' | 'apple_health'

/** Путь нового файла: папка автора, случайное имя, исходное расширение.
 *  Исходное имя в путь не попадает — в нём бывает фамилия или диагноз. */
export function buildMedicalPath(userId: string, fileName: string, folder: MedicalFolder = 'med'): string {
  const dot = fileName.lastIndexOf('.')
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  return `${userId}/${folder}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
}

/** Адрес для ссылки или превью: подписанный — для закрытого файла, старый
 *  публичный — для ещё не перенесённого, undefined — пока подписи нет. */
export function attachmentHref(
  att: StoredAttachment,
  signed: Record<string, string>,
): string | undefined {
  if (att.path) return signed[att.path]
  return att.url
}

function lastSegment(value: string): string {
  const raw = value.split('?')[0].split('/').pop() ?? ''
  try { return decodeURIComponent(raw) } catch { return raw }
}

/**
 * Вложения из формы, открытой до переноса файлов скриптом, — к виду
 * записи сейчас. Старое вложение со ссылкой, чей файл уже перенесён (в
 * записи лежит вложение с путём и тем же именем файла), заменяется
 * перенесённым. Иначе сохранение такой формы вернуло бы в запись ссылку
 * на удалённый публичный файл.
 */
export function reconcileWithMigrated<T extends StoredAttachment>(next: readonly T[], current: readonly T[]): T[] {
  const migrated = new Map<string, T>()
  for (const att of current) {
    if (att.path) migrated.set(lastSegment(att.path), att)
  }
  return next.map(att => {
    if (att.path || !att.url) return att
    return migrated.get(lastSegment(att.url)) ?? att
  })
}
