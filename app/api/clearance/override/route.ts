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

  // P1: маршрут принимал произвольный athlete_id от ЛЮБОГО
  // аутентифицированного пользователя и дальше работал admin-клиентом в
  // обход RLS: посторонний мог записать «обход медицинского допуска» на
  // чужого спортсмена и отправить уведомление его врачу. Обход допуска —
  // действие тренера этого спортсмена (или его врача / администратора).
  if (actorRole !== 'admin') {
    let allowed = false

    if (actorRole === 'coach') {
      const { data: link } = await supabase.from('trainer_athletes')
        .select('athlete_id')
        .eq('trainer_id', actorId)
        .eq('athlete_id', body.athlete_id)
        .eq('status', 'accepted')
        .maybeSingle()
      allowed = !!link
    } else if (actorRole === 'doctor' || actorRole === 'specialist') {
      const { data: link } = await supabase.from('connections')
        .select('id')
        .eq('connection_type', 'doctor_athlete')
        .eq('status', 'active')
        .or(
          `and(initiator_id.eq.${actorId},recipient_id.eq.${body.athlete_id}),` +
          `and(initiator_id.eq.${body.athlete_id},recipient_id.eq.${actorId})`
        )
        .maybeSingle()
      allowed = !!link
    }

    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'not_your_athlete' }, { status: 403 })
    }
  }

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

  // action — enum public.audit_action. Значения 'clearance_override' в нём
  // не было, поэтому insert падал с 22P02 — а он здесь ПРОВЕРЯЕТСЯ и
  // возвращается как 500 'audit_failed'. То есть обход допуска не просто не
  // логировался: маршрут падал на каждом вызове, функция была мертва
  // целиком. Значение добавлено в enum миграцией 109; строгое поведение
  // «нет записи в журнале — нет операции» здесь оставлено намеренно:
  // обход врачебного ограничения без следа недопустим.
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
  // P0: замыкаем петлю override. Раньше врач, чей запрет тренер сознательно
  // обошёл, не получал никакого сигнала — узнать об override можно было
  // только вручную из audit_logs. Admin-клиент, потому что notifications
  // INSERT гейтится can_notify (care-team предикаты), а это системное
  // серверное уведомление.
  if (clearance?.doctor_id) {
    try {
      await adminAny.from('notifications').insert({
        user_id:     clearance.doctor_id,
        type:        'broadcast',
        title:       'Тренер обошёл ограничение допуска',
        body:        `Причина: ${body.reason}`,
        entity_type: 'clearance_override',
        entity_id:   row.id,
        action_url:  '/doctor/clearances',
      })
    } catch (e) {
      console.warn('[clearance-override.notify]', e instanceof Error ? e.message : e)
    }
  }

  return NextResponse.json({ ok: true, override_id: row.id, created_at: row.created_at })
}
