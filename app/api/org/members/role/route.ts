/**
 * PATCH /api/org/members/role — sidebar-rebuild step 7a.
 *
 * Назначение / разжалование роли org_admin внутри организации владельца.
 * Только org_owner может вызвать. Запись в audit_logs обязательна — это
 * permission change, разбор инцидентов потребует кто, когда, кого, причина.
 *
 * Body:
 *   member_id: uuid — id строки org_members (НЕ user.id)
 *   new_role:  'org_admin' | 'coach' — единственные допустимые переходы
 *   reason:    string (>= 4) — для audit (требуем явное обоснование)
 *
 * Заборы:
 *   - actor authenticated
 *   - actor.users.role === 'organization' (UI скрыт, но защита остаётся)
 *   - target.org_id === actor.users.id (модель 1 owner = 1 org, id == owner.id)
 *   - target.member_role !== 'org_owner' (владельца не разжаловать)
 *   - actor != target user (нельзя промоутить себя — owner и так выше)
 *
 * Текущий enforcement — server-side через admin client; RLS-policy на
 * org_members.member_role в отдельной миграции прилетит позже когда мы
 * закроем repo↔prod migration gap (см. PR #165). До тех пор клиент НЕ
 * имеет прямого пути менять member_role: использует только этот endpoint.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canAssignOrgAdmin, type GlobalRole } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  member_id: z.string().uuid(),
  new_role:  z.enum(['org_admin', 'coach']),
  reason:    z.string().trim().min(4).max(500),
})

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id, role').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const actorId   = (meRow as { id: string }).id
  const actorRole = (meRow as { role: GlobalRole }).role
  // Этап 10 — централизованный permission helper. Раньше было прямое
  // сравнение строки; теперь семантика «может ли делегировать org_admin»
  // живёт в lib/permissions.ts и тестируема отдельно.
  if (!canAssignOrgAdmin(actorRole)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 }) }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  const { data: target } = await adminAny
    .from('org_members')
    .select('id, org_id, user_id, member_role, status')
    .eq('id', body.member_id)
    .maybeSingle()

  if (!target) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  if (target.org_id !== actorId) {
    return NextResponse.json({ ok: false, error: 'not_your_org' }, { status: 403 })
  }
  if (target.member_role === 'org_owner') {
    return NextResponse.json({ ok: false, error: 'cannot_change_owner' }, { status: 409 })
  }
  if (target.user_id === actorId) {
    return NextResponse.json({ ok: false, error: 'cannot_self_assign' }, { status: 409 })
  }
  if (target.status !== 'active') {
    return NextResponse.json({ ok: false, error: 'target_not_active' }, { status: 409 })
  }

  // Промоут coach -> org_admin или demote org_admin -> coach. Любые
  // другие текущие member_role (doctor/specialist/athlete) запрещаем —
  // org_admin это управленческая роль над coach'ами.
  if (
    !(target.member_role === 'coach' && body.new_role === 'org_admin') &&
    !(target.member_role === 'org_admin' && body.new_role === 'coach')
  ) {
    return NextResponse.json({ ok: false, error: 'transition_not_allowed' }, { status: 409 })
  }

  const prevRole = target.member_role

  const { error: upErr } = await adminAny
    .from('org_members')
    .update({ member_role: body.new_role })
    .eq('id', target.id)

  if (upErr) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })

  await adminAny.from('audit_logs').insert({
    actor_id:     actorId,
    action:       'org_member_role_change',
    target_table: 'org_members',
    target_id:    target.id,
    payload: {
      org_id:       target.org_id,
      target_user:  target.user_id,
      prev_role:    prevRole,
      new_role:     body.new_role,
      reason:       body.reason,
    },
  })

  return NextResponse.json({ ok: true, member_id: target.id, new_role: body.new_role })
}
