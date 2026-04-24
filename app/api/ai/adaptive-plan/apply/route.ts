import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ApplyItemSchema = z.object({
  workout_id: z.string().uuid(),
  proposed_action: z.enum(['reduce_volume','lower_intensity','make_recovery','reschedule','delete','keep']),
  new_duration_min: z.number().int().min(0).max(600).nullable().optional(),
  new_description:  z.string().max(400).nullable().optional(),
  new_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

const ApplySchema = z.object({
  athlete_id: z.string().uuid(),
  items:      z.array(ApplyItemSchema).min(1).max(15),
})

/**
 * POST /api/ai/adaptive-plan/apply
 * Тренер принимает предложения AdaptivePlan — мы обновляем/удаляем
 * prescribed workouts только тех, что он сам назначил (prescribed_by
 * = current user) данному атлету. Возвращаем применённые/пропущенные.
 */
export async function POST(req: Request) {
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const { data: me } = await sb.from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const meRow = me as { id: string; role: string } | null
  if (!meRow) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  if (meRow.role !== 'coach') return NextResponse.json({ ok: false, error: 'COACH_ONLY' }, { status: 403 })

  const json = await req.json().catch(() => ({}))
  const parsed = ApplySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_body', issues: parsed.error.issues }, { status: 400 })
  const { athlete_id, items } = parsed.data

  // Связь
  const { data: link } = await sb.from('trainer_athletes')
    .select('athlete_id').eq('trainer_id', meRow.id).eq('athlete_id', athlete_id)
    .eq('status', 'accepted').maybeSingle()
  if (!link) return NextResponse.json({ ok: false, error: 'NOT_LINKED' }, { status: 403 })

  let applied = 0
  const skipped: string[] = []

  for (const it of items) {
    if (it.proposed_action === 'keep') { skipped.push(it.workout_id); continue }

    // Владение тренировкой: prescribed_by=meRow AND athlete_id matches.
    const { data: wRaw } = await sb.from('workouts')
      .select('id, prescribed_by, athlete_id')
      .eq('id', it.workout_id).maybeSingle()
    const w = wRaw as { id: string; prescribed_by: string | null; athlete_id: string } | null
    if (!w || w.prescribed_by !== meRow.id || w.athlete_id !== athlete_id) {
      skipped.push(it.workout_id)
      continue
    }

    if (it.proposed_action === 'delete') {
      await sb.from('workouts').delete().eq('id', w.id)
      applied++
      continue
    }

    const patch: Record<string, unknown> = {}
    if (it.proposed_action === 'reduce_volume' && typeof it.new_duration_min === 'number') {
      patch.activity_duration_min = it.new_duration_min
    }
    if (it.proposed_action === 'make_recovery') {
      patch.activity_type = 'recovery'
      if (typeof it.new_duration_min === 'number') patch.activity_duration_min = it.new_duration_min
    }
    if (it.proposed_action === 'lower_intensity') {
      // Не меняем activity_type; описание обновляется ниже.
    }
    if (it.proposed_action === 'reschedule' && it.new_date) {
      patch.event_date = it.new_date
    }
    if (it.new_description) patch.description = it.new_description

    if (Object.keys(patch).length === 0) { skipped.push(it.workout_id); continue }

    const { error } = await (sb as any).from('workouts').update(patch).eq('id', w.id)
    if (error) skipped.push(it.workout_id)
    else applied++
  }

  return NextResponse.json({ ok: true, applied, skipped })
}
