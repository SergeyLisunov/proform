/**
 * lib/org/resolve-org-context.ts — чистая логика «какой организацией я управляю».
 *
 * Почему отдельный файл, а не всё в `lib/org/org-context.ts`:
 * серверный резолвер импортирует `@/lib/supabase/server`, который тянет
 * `next/headers` — такой модуль нельзя импортировать из клиентского хука,
 * иначе сборка падает. Чистая часть вынесена сюда, чтобы **одно и то же
 * правило** использовали и сервер (`getOrgContext`), и клиент
 * (`useOrgContext`), и юнит-тесты. Разъезд server/client правил — это ровно
 * то, из-за чего org_admin получал сайдбар, но не получал страницы.
 *
 * Правило резолва org_id (первопричина второй половины дефекта P1):
 *   - у аккаунта-организации `organizations.id = users.id`
 *     (FK organizations_id_fkey), поэтому org_id === собственный users.id;
 *   - у org_admin это ЧУЖОЙ id, и брать `user.id` нельзя — org_id живёт в
 *     `org_members.org_id` активной строки с управляющей ролью.
 */
import {
  isClubManager,
  isClubManagerMemberRole,
  isOrgOwner,
  type GlobalRole,
  type ScopedOrgRole,
} from '@/lib/permissions'

/** Строка `org_members` в объёме, достаточном для резолва (сырые типы из БД). */
export interface OrgMembershipRow {
  org_id:      string
  member_role: string
  status:      string
}

export interface OrgContext {
  /** `users.id` текущего пользователя (НЕ auth.users.id). */
  userId:        string
  /** Глобальная роль из `users.role`. */
  globalRole:    GlobalRole | undefined
  /** Управляющая роль в организации, если есть. */
  scopedOrgRole: ScopedOrgRole | null
  /** `organizations.id` клуба, которым пользователь управляет. null — не управляет. */
  orgId:         string | null
  /** Может открывать и изменять управленческие разделы клуба (/org/**). */
  canManage:     boolean
  /**
   * Владелец клуба. Более узкие действия (биллинг, делегирование прав,
   * удаление клуба) обязаны проверять именно это, а не `canManage` —
   * org_admin управляет клубом, но не раздаёт права.
   */
  isOwner:       boolean
}

/**
 * Резолвит контекст из уже загруженных данных. Без IO — тестируется напрямую.
 *
 * @param userId      `users.id` пользователя
 * @param globalRole  `users.role`
 * @param memberships строки `org_members` этого пользователя (любые; фильтрация внутри)
 */
export function resolveOrgContext(
  userId: string,
  globalRole: GlobalRole | undefined,
  memberships: readonly OrgMembershipRow[],
): OrgContext {
  const managing = memberships.filter(
    m => m.status === 'active' && isClubManagerMemberRole(m.member_role),
  )

  // Детерминированный выбор: org_owner важнее org_admin. Без явного
  // приоритета `.limit(1)` в запросе возвращал произвольную строку, и
  // пара (роль, org_id) могла разъехаться у пользователя, который владеет
  // одним клубом и админит другой.
  const preferred =
    managing.find(m => m.member_role === 'org_owner') ?? managing[0] ?? null

  const scopedOrgRole: ScopedOrgRole | null =
    preferred && isClubManagerMemberRole(preferred.member_role) ? preferred.member_role : null

  const orgId = globalRole === 'organization' ? userId : (preferred?.org_id ?? null)

  // `orgId !== null` — не формальность: без клуба «управлять» нечем, а
  // страница, пропустившая пользователя внутрь с orgId=null, немедленно
  // сделала бы запрос по пустому фильтру.
  return {
    userId,
    globalRole,
    scopedOrgRole,
    orgId,
    canManage: isClubManager(globalRole, scopedOrgRole) && orgId !== null,
    isOwner:   isOrgOwner(globalRole, scopedOrgRole) && orgId !== null,
  }
}
