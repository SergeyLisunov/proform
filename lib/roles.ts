/**
 * Подписи и цвета глобальных ролей — единственное место, где они живут.
 *
 * ЗАЧЕМ. Раньше у каждого компонента был свой словарь, и они разошлись:
 * сайдбар знал пять ролей и всё остальное подписывал «Гость», шапка знала
 * четыре и всё остальное подписывала «Орг». Специалист (физиотерапевт,
 * массажист, нутрициолог) в одном месте интерфейса значился гостем, в другом
 * — организацией, и ни там, ни там — специалистом.
 *
 * Ключ — значение `users.role` из базы. Это строка, а не GlobalRole: роль
 * specialist в GlobalRole сейчас нет, но в базе она существует, и подпись
 * обязана её знать.
 */
export interface RoleMeta {
  /** Полная подпись: «Тренер», «Организация». */
  label: string
  /** Короткая для тесных мест — плашка в шапке. */
  short: string
  bg: string
  text: string
}

export const ROLE_META: Record<string, RoleMeta> = {
  athlete:      { label: 'Спортсмен',     short: 'Атлет',   bg: '#FEF0E7', text: '#F35703' },
  coach:        { label: 'Тренер',        short: 'Тренер',  bg: '#F0FDF4', text: '#16A34A' },
  doctor:       { label: 'Врач',          short: 'Врач',    bg: '#FEF2F2', text: '#DC2626' },
  specialist:   { label: 'Специалист',    short: 'Спец.',   bg: '#F0F9FF', text: '#0284C7' },
  organization: { label: 'Организация',   short: 'Клуб',    bg: '#EFF6FF', text: '#2563EB' },
  admin:        { label: 'Администратор', short: 'Админ',   bg: '#F5F3FF', text: '#7C3AED' },
}

/**
 * Незнакомая или ещё не загруженная роль. Нейтральная подпись вместо
 * прежнего «Гость»: человек в кабинете — уже не гость, просто роль ещё не
 * пришла или неизвестна.
 */
export const UNKNOWN_ROLE: RoleMeta = {
  label: 'Пользователь', short: '—', bg: '#F8FAFC', text: '#64748B',
}

export function roleMeta(role: string | null | undefined): RoleMeta {
  return (role && ROLE_META[role]) || UNKNOWN_ROLE
}

/**
 * Подзаголовок под логотипом в сайдбаре. Раньше там у всех ролей было
 * «Панель атлета и тренера» — и у врача, и у клуба, и у админа.
 */
export const ROLE_PANEL_TITLE: Record<string, string> = {
  athlete:      'Кабинет спортсмена',
  coach:        'Кабинет тренера',
  doctor:       'Кабинет врача',
  specialist:   'Кабинет специалиста',
  organization: 'Кабинет клуба',
  admin:        'Управление платформой',
}

export function rolePanelTitle(role: string | null | undefined): string {
  return (role && ROLE_PANEL_TITLE[role]) || 'Личный кабинет'
}
