/**
 * POST /api/clearance/override — clearance #5 (gating audit).
 *
 * Тренер сознательно идёт против doctor'ского banned/red clearance, чтобы
 * запланировать тренировку. Записывает audit_logs row для post-hoc разбора
 * и compliance trail. UI (WorkoutAddDrawer) обязан запросить reason ДО
 * фактического INSERT в workouts.
 *
 * Body:
 *   athlete_id: uuid
 *   reason:     string (10..500)  — причина override; обязательна
 *   planned:    { title?, event_date?, activity_type? } — что собираются создать
 *
 * Авторизация: только authenticated. Реальное правило (только coach связанный
 * с athlete) дальше энфорсится RLS на workouts INSERT — этот endpoint только
 * фиксирует намерение. Audit нельзя обойти потому что без вызова этого
 * endpoint клиент не получит «продолжайте создание тренировки».
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  athlete_id: z.string().uuid(),
  reason:     z.string().trim().min(10).max(500),
  planned: z.object({
    title:          z.string().trim().max(200).optional(),
    event_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    activity_type:  z.string().trim().max(80).optional(),
  }).optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  const { data: meRow } = await supabase
    .from('users').select('id, role').eq('auth_id', authUser.id).maybeSingle()
  if (!meRow) return NextResponse.json({ ok: false, error: 'no_profile' }, { status: 404 })
  const actorId = (meRow as { id: string }).id
  const actorRole = (meRow as { role: string }).role

  let body: z.infer<typeof BodySchema>
  try { body = BodySchema.parse(await req.json()) }
  catch { return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 }) }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  // Snapshot the current clearance into the audit row so post-hoc review knows
  // exactly what the coach overrode.
  const { data: clearance } = await adminAny
    .from('current_clearances')
    .select('id, status, valid_until, review_needed, doctor_id')
    .eq('athlete_id', body.athlete_id)
    .maybeSingle()

  const { data: row, error: insertErr } = await adminAny.from('audit_logs').insert({
    actor_id:     actorId,
    action:       'clearance_override',
    target_table: 'clearances',
    target_id:    clearance?.id ?? null,
    payload: {
      athlete_id:    body.athlete_id,
      actor_role:    actorRole,
      reason:        body.reason,
      clearance_snapshot: clearance ?? null,
      planned:       body.planned ?? null,
    },
  }).select('id, created_at').single()

  if (insertErr || !row) {
    return NextResponse.json({ ok: false, error: 'audit_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, override_id: row.id, created_at: row.created_at })
}
