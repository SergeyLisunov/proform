/**
 * Типы связей между пользователями и роли их сторон — единственное место в
 * приложении.
 *
 * Тот же список в базе — функция connection_type_roles() (миграция 119),
 * по нему триггер согласия (115) проверяет каждый запрос на связь. Тест
 * lib/connections/types.test.ts сверяет их: тип, добавленный только сюда,
 * база отклонит; только туда — API не пропустит.
 */
export const CONNECTION_TYPE_ROLES = {
  coach_athlete:      ['coach', 'athlete'],
  org_coach:          ['organization', 'coach'],
  org_athlete:        ['organization', 'athlete'],
  doctor_athlete:     ['doctor', 'athlete'],
  coach_doctor:       ['coach', 'doctor'],
  org_doctor:         ['organization', 'doctor'],
  admin_doctor:       ['admin', 'doctor'],
  specialist_athlete: ['specialist', 'athlete'],
} as const satisfies Record<string, readonly [string, string]>

export type ConnectionType = keyof typeof CONNECTION_TYPE_ROLES

export function isConnectionType(value: unknown): value is ConnectionType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONNECTION_TYPE_ROLES, value)
}

/** Подходят ли роли двух сторон к типу связи — в любом порядке. */
export function rolesMatchConnectionType(
  type: string, roleA: string | null | undefined, roleB: string | null | undefined,
): boolean {
  if (!isConnectionType(type)) return false
  const [r1, r2] = CONNECTION_TYPE_ROLES[type]
  return (roleA === r1 && roleB === r2) || (roleA === r2 && roleB === r1)
}

/** Тип связи для пары ролей (в любом порядке) или null, если такой связи нет. */
export function connectionTypeForRoles(
  roleA: string | null | undefined, roleB: string | null | undefined,
): ConnectionType | null {
  for (const type of Object.keys(CONNECTION_TYPE_ROLES) as ConnectionType[]) {
    if (rolesMatchConnectionType(type, roleA, roleB)) return type
  }
  return null
}

/** Роль в родительном падеже: «в качестве спортсмена». */
const ROLE_GENITIVE: Record<string, string> = {
  athlete:      'спортсмена',
  coach:        'тренера',
  doctor:       'врача',
  specialist:   'специалиста',
  organization: 'организации',
  admin:        'администратора',
}

/**
 * Кем подключается приглашённый — вторая сторона связи относительно
 * пригласившего. Одна и та же связь specialist_athlete приглашает
 * спортсмена, если зовёт специалист, и специалиста, если зовёт спортсмен.
 */
export function invitedAsLabel(type: string, inviterRole: string | null | undefined): string | null {
  if (!isConnectionType(type)) return null
  const [r1, r2] = CONNECTION_TYPE_ROLES[type]
  const invited = inviterRole === r1 ? r2 : inviterRole === r2 ? r1 : null
  return invited ? ROLE_GENITIVE[invited] ?? null : null
}
