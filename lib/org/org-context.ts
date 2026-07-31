/**
 * lib/org/org-context.ts — СЕРВЕРНЫЙ резолвер org-контекста (P1, org_admin).
 *
 * Дефект: страницы `/org/*` проверяли `user.role !== 'organization'`, то есть
 * ГЛОБАЛЬНУЮ роль. У администратора клуба (`org_members.member_role='org_admin'`)
 * такой роли нет — сайдбар пункт «Клуб» показывал, а каждая страница
 * отбрасывала. Клиентский резолвер scoped-роли существовал
 * (`lib/hooks/useEffectiveRole.ts`), серверного не было вовсе — серверные
 * страницы физически не могли проверить право иначе как по users.role.
 *
 * Этот модуль закрывает пробел: один вызов даёт и право (`canManage`), и
 * идентификатор клуба (`orgId`), которым дальше фильтруются запросы.
 *
 * Клиентский аналог — `lib/hooks/useOrgContext.ts`; общее правило резолва
 * живёт в `lib/org/resolve-org-context.ts` (импортировать этот файл из
 * клиентских компонентов нельзя — `@/lib/supabase/server` тянет next/headers).
 */
import { createClient } from '@/lib/supabase/server'
import { CLUB_MANAGER_MEMBER_ROLES, type GlobalRole } from '@/lib/permissions'
import {
  resolveOrgContext,
  type OrgContext,
  type OrgMembershipRow,
} from '@/lib/org/resolve-org-context'

export type { OrgContext, OrgMembershipRow } from '@/lib/org/resolve-org-context'

/**
 * Возвращает org-контекст текущей сессии либо `null`, если пользователь не
 * аутентифицирован или у него нет строки в `public.users` (страница в этом
 * случае обязана редиректить на /auth/login — молча продолжать нельзя).
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  // users.auth_id → auth.users.id; всё остальное в схеме ссылается на users.id.
  const { data: meRow } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .maybeSingle()
  const me = meRow as { id: string; role: GlobalRole } | null
  if (!me) return null

  // Сужаем выборку до управляющих ролей прямо в запросе — резолвер всё равно
  // отфильтрует, но тащить весь список членств (у org-аккаунта это может быть
  // много строк) незачем.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from('org_members')
    .select('org_id, member_role, status')
    .eq('user_id', me.id)
    .eq('status', 'active')
    .in('member_role', CLUB_MANAGER_MEMBER_ROLES)

  return resolveOrgContext(me.id, me.role, (rows ?? []) as OrgMembershipRow[])
}
