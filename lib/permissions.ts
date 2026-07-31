/**
 * lib/permissions.ts — централизованная permission model (sidebar этап 10).
 *
 * До этого PR'а permission-логика была раскидана по коду в виде
 * `user.role === 'admin'`, `role === 'doctor' || role === 'admin'` и так
 * далее. Это создавало три проблемы:
 *   1. Любое добавление новой роли (parent, org_admin, specialist)
 *      требовало grep'а и ручной правки десятков call-sites.
 *   2. Семантика проверки терялась в форме строкового сравнения —
 *      `role === 'doctor' || role === 'admin'` это «может видеть мед.
 *      отчёт», но это видно только из контекста.
 *   3. Невозможно покрыть unit-тестами — нечего импортировать.
 *
 * Этот файл — единый источник правды. Каждый helper:
 *   - принимает `GlobalRole` (плюс при необходимости `ScopedOrgRole`),
 *     которые импортируются из `lib/sidebar/config.ts` чтобы не было
 *     разъезда с filter-логикой;
 *   - возвращает `boolean`;
 *   - имеет JSDoc объясняющий **why** (бизнес-смысл), а не **what**;
 *   - покрывается `undefined` (роль ещё не загружена / пользователь не
 *     аутентифицирован) безопасным `false`.
 *
 * Будущие миграции call-sites должны идти как «найти строковое сравнение
 * → заменить на helper». Когда грeп `role === '` вернёт 0 матчей за
 * пределами этого файла — модель достроена.
 */
import type { GlobalRole, ScopedOrgRole } from './sidebar/config'

// Re-export для удобства потребителей (один импорт вместо двух).
export type { GlobalRole, ScopedOrgRole } from './sidebar/config'

/** Платформенный admin Sporteo (back-office: CRM, leads, audit). */
export function isPlatformAdmin(role: GlobalRole | undefined): boolean {
  return role === 'admin'
}

/** Глобальный или scoped владелец организации. */
export function isOrgOwner(
  globalRole: GlobalRole | undefined,
  scopedOrgRole: ScopedOrgRole | null | undefined,
): boolean {
  return globalRole === 'organization' || scopedOrgRole === 'org_owner'
}

/**
 * Может управлять клубом — owner или назначенный owner'ом админ.
 * Используется для всех Club-secrion разрешений (приглашения, посты,
 * аналитика); более узкие действия (биллинг, удаление org) должны
 * использовать `isOrgOwner` напрямую — об этом этап 7b.
 */
export function isClubManager(
  globalRole: GlobalRole | undefined,
  scopedOrgRole: ScopedOrgRole | null | undefined,
): boolean {
  return isOrgOwner(globalRole, scopedOrgRole) || scopedOrgRole === 'org_admin'
}

/**
 * Значения `org_members.member_role`, которые дают управление клубом.
 *
 * Дефект, ради которого константа появилась: список `['org_owner','org_admin']`
 * был скопирован в useEffectiveRole и в каждый будущий резолвер, поэтому
 * добавление роли требовало grep'а. Теперь он один и используется и в
 * `.in('member_role', …)` фильтрах запросов, и в чистом резолвере.
 */
export const CLUB_MANAGER_MEMBER_ROLES: readonly ScopedOrgRole[] = ['org_owner', 'org_admin']

/**
 * Type guard: строка из БД — это управляющая org-роль?
 *
 * Нужен потому, что `org_members.member_role` в схеме — свободная строка
 * (org_owner|org_admin|coach|doctor|specialist|athlete), а `ScopedOrgRole`
 * покрывает только управляющие две. Без guard'а call-site вынужден писать
 * `as ScopedOrgRole` и теряет проверку.
 */
export function isClubManagerMemberRole(
  memberRole: string | null | undefined,
): memberRole is ScopedOrgRole {
  return memberRole === 'org_owner' || memberRole === 'org_admin'
}

/** Врач (глобальная роль). */
export function isDoctor(role: GlobalRole | undefined): boolean {
  return role === 'doctor'
}

/** Тренер (глобальная роль). */
export function isCoach(role: GlobalRole | undefined): boolean {
  return role === 'coach'
}

/** Атлет (глобальная роль). */
export function isAthlete(role: GlobalRole | undefined): boolean {
  return role === 'athlete'
}

/**
 * Может просматривать клиническую страницу /doctor/report/[athleteId].
 * Это медицинский surface — open только врачам и платформенному admin'у
 * (последний — для compliance/audit запросов).
 */
export function canViewMedicalReport(role: GlobalRole | undefined): boolean {
  return isDoctor(role) || isPlatformAdmin(role)
}

/**
 * Может назначать/снимать роль org_admin. По текущей модели — только
 * глобальный organization-аккаунт (модель 1 owner = 1 org). scoped
 * org_admin делегировать кого-то ещё не может — это намеренно.
 */
export function canAssignOrgAdmin(role: GlobalRole | undefined): boolean {
  return role === 'organization'
}
