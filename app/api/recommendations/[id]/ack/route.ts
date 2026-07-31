import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/recommendations/[id]/ack
 * Body: { as: 'coach' | 'athlete' }
 *
 * Acknowledges a recommendation for the calling role. RLS enforces
 * who CAN update which timestamp:
 *   - athlete: only on recommendations where athlete_id = me
 *   - coach: only on recommendations where coach_id = me OR coach is
 *     linked via trainer_athletes(status='accepted')
 *
 * Trigger in migration 052 auto-bumps status='acknowledged' when both
 * required parties have ack'd (per visibility_level).
 */

const Schema = z.object({ as: z.enum(['coach', 'athlete']) })

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY', details: (e as Error).message }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  // P1: поле `as` приходит из тела запроса и раньше принималось на веру —
  // спортсмен мог отправить {"as":"coach"} и проставить подтверждение «от
  // тренера», из-за чего рекомендация получала статус «ознакомлен» без
  // участия тренера. Сверяем заявленную сторону с фактической ролью и
  // фактической связью со спортсменом.
  const { data: meRow } = await sb
    .from('users').select('id, role').eq('auth_id', auth.user.id).maybeSingle()
  const me = meRow as { id: string; role: string | null } | null
  if (!me) return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recRow } = await (sb as any).from('recommendations')
    .select('id, athlete_id, coach_id')
    .eq('id', params.id)
    .maybeSingle()
  const rec = recRow as { id: string; athlete_id: string; coach_id: string | null } | null
  if (!rec) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  if (body.as === 'athlete') {
    if (rec.athlete_id !== me.id) {
      return NextResponse.json({ ok: false, error: 'NOT_YOUR_RECOMMENDATION' }, { status: 403 })
    }
  } else {
    if (me.role !== 'coach' && me.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'COACH_ONLY' }, { status: 403 })
    }
    if (me.role === 'coach' && rec.coach_id !== me.id) {
      const { data: link } = await sb.from('trainer_athletes')
        .select('athlete_id')
        .eq('trainer_id', me.id)
        .eq('athlete_id', rec.athlete_id)
        .eq('status', 'accepted')
        .maybeSingle()
      if (!link) {
        return NextResponse.json({ ok: false, error: 'NOT_YOUR_ATHLETE' }, { status: 403 })
      }
    }
  }

  const patch = body.as === 'coach'
    ? { acknowledged_by_coach_at: new Date().toISOString() }
    : { acknowledged_by_athlete_at: new Date().toISOString() }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('recommendations')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: 'ACK_FAILED' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data })
}
