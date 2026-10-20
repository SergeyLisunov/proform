/**
 * Словарь роли «специалист» — единственное место.
 *
 * Ключи специализаций и форматов совпадают с CHECK в таблице specialists
 * (миграция 118); lib/specialist.test.ts сверяет их с миграцией.
 *
 * Термин для тех, с кем работает специалист, — «клиенты» (решение
 * владельца): массажист, нутрициолог или психолог — не врач, и
 * «пациенты» остаются у врача.
 */
export const SPECIALIST_TYPES = ['physio', 'massage', 'nutrition', 'psychology', 'other'] as const
export type SpecialistType = (typeof SPECIALIST_TYPES)[number]

export interface SpecialistTypeMeta {
  label: string
  /** Чем занимается — подсказка в выборе специализации. */
  hint: string
  icon: string
}

export const SPECIALIST_TYPE_META: Record<SpecialistType, SpecialistTypeMeta> = {
  physio:     { label: 'Физиотерапевт', hint: 'Реабилитация, ЛФК, восстановление после травм', icon: 'ki-bandage' },
  massage:    { label: 'Массажист',     hint: 'Спортивный и восстановительный массаж',          icon: 'ki-heart' },
  nutrition:  { label: 'Нутрициолог',   hint: 'Питание под нагрузки и цели',                    icon: 'ki-drop' },
  psychology: { label: 'Психолог',      hint: 'Спортивная психология, стресс, мотивация',       icon: 'ki-emoji-happy' },
  other:      { label: 'Другое',        hint: 'Другая специализация в команде заботы',          icon: 'ki-abstract-41' },
}

export const SPECIALIST_FORMATS = ['offline', 'online', 'visit'] as const
export type SpecialistFormat = (typeof SPECIALIST_FORMATS)[number]

export const SPECIALIST_FORMAT_LABEL: Record<SpecialistFormat, string> = {
  offline: 'Очно',
  online:  'Онлайн',
  visit:   'Выезд',
}

export const SPECIALIST_FORMAT_META: Record<SpecialistFormat, { label: string; hint: string; icon: string }> = {
  offline: { label: SPECIALIST_FORMAT_LABEL.offline, hint: 'В кабинете или зале',     icon: 'ki-geolocation' },
  online:  { label: SPECIALIST_FORMAT_LABEL.online,  hint: 'Видеосвязь и переписка',  icon: 'ki-messages' },
  visit:   { label: SPECIALIST_FORMAT_LABEL.visit,   hint: 'Приезжаете к клиенту', icon: 'ki-route' },
}

export function isSpecialistType(value: unknown): value is SpecialistType {
  return typeof value === 'string' && (SPECIALIST_TYPES as readonly string[]).includes(value)
}

/** «Физиотерапевт, массажист» — для карточек и заголовков. */
export function specialistTypesLabel(types: readonly string[] | null | undefined): string {
  const labels = (types ?? []).filter(isSpecialistType).map(t => SPECIALIST_TYPE_META[t].label)
  if (labels.length === 0) return 'Специалист'
  return labels.map((l, i) => (i === 0 ? l : l.toLowerCase())).join(', ')
}

/**
 * Границы роли — что специалист делает и чего не делает. Показываются в
 * мастере онбординга (специалист подтверждает) и в кабинете.
 */
export const SPECIALIST_SCOPE = {
  canTitle: 'Можно',
  cannotTitle: 'Нельзя',
  can: [
    'Работать со спортсменом только после его согласия',
    'Видеть ограничения и травмы — без медицинского текста врача',
    'Вести свои записи и рекомендации по восстановлению и питанию',
  ],
  cannot: [
    'Ставить диагнозы, выписывать рецепты и анализы',
    'Менять допуск к тренировкам',
    'Читать заключения и назначения врача',
  ],
} as const

/** Тип связи специалиста со спортсменом (миграция 119). */
export const SPECIALIST_CONNECTION_TYPE = 'specialist_athlete'
