/**
 * POST /api/child/request-claim — tenant refactor #4b-v follow-up.
 *
 * Обратная инициатива к #177: ребёнок-атлет в /settings нажимает «попросить
 * родителя выдать мне доступ». Сервер создаёт notification для каждого active
 * родителя — родитель кликает на уведомление и попадает в /parent/dashboard,
 * где уже есть кнопка «Выдать доступ» (#177).
 *
 * Анти-спам: один pending claim-request на пару (child, parent) в течение
 * 24 часов — повторный клик не создаёт дубликат.
 *
 * Body: пустое (child_id = caller).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REQUEST_COOLDOWN_HOURS = 24

export async function POST() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id, name, email').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const childId   = (meRow as { id: string }).id
  const childName = (meRow as { name: string | null }).name ?? 'Атлет'

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  // Find all active parents of this user.
  const { data: parentsRaw } = await adminAny
    .from('parent_links')
    .select('parent_id')
    .eq('child_id', childId)
    .eq('status', 'active')
  const parentIds = ((parentsRaw ?? []) as Array<{ parent_id: string }>).map((r) => r.parent_id)
  if (parentIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_active_parent' }, { status: 422 })
  }

  // Anti-spam: skip parents who already have a fresh pending claim_request.
  const cutoff = new Date(Date.now() - REQUEST_COOLDOWN_HOURS * 3600 * 1000).toISOString()
  const { data: recentRaw } = await adminAny
    .from('notifications')
    .select('user_id, created_at')
    .eq('type', 'claim_request')
    .eq('entity_type', 'child_claim')
    .eq('entity_id', childId)
    .in('user_id', parentIds)
    .gte('created_at', cutoff)
  const recentParentIds = new Set(((recentRaw ?? []) as Array<{ user_id: string }>).map((r) => r.user_id))

  const newParents = parentIds.filter((p) => !recentParentIds.has(p))
  if (newParents.length === 0) {
    return NextResponse.json({
      ok: true,
      sent_to: 0,
      skipped_recent: parentIds.length,
      message: 'cooldown',
    })
  }

  const rows = newParents.map((parentId) => ({
    user_id:     parentId,
    type:        'claim_request',
    title:       `${childName} просит выдать ему доступ к Sporteo`,
    body:        'Нажмите, чтобы перейти в кабинет родителя и выдать ребёнку личную ссылку для входа.',
    entity_type: 'child_claim',
    entity_id:   childId,
    action_url:  '/parent/dashboard',
  }))
  const { error: insertErr } = await adminAny.from('notifications').insert(rows)
  if (insertErr) {
    return NextResponse.json({ ok: false, error: 'notify_failed' }, { status: 500 })
  }

  return NextResponse.json({
    ok:             true,
    sent_to:        newParents.length,
    skipped_recent: parentIds.length - newParents.length,
  })
}
