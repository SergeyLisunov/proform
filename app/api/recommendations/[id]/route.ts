import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/recommendations/[id] — Sprint W2 Day 12.
 *
 * Doctor lifecycle actions on own recommendation:
 *   - { action: 'resolve' } → status='resolved'
 *   - { action: 'cancel' }  → status='cancelled'
 *
 * Auth: caller must be the doctor_id of the row (RLS enforces).
 * Body validated; status transitions logical: only sent/active/
 * acknowledged → resolved; only draft/sent → cancelled.
 *
 * Notification fan-out best-effort (silent fail).
 */

const Schema = z.object({ action: z.enum(['resolve', 'cancel']) })

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY', details: (e as Error).message }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  // Read current state to validate transition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cur } = await (sb as any).from('recommendations')
    .select('status, athlete_id, coach_id, title')
    .eq('id', params.id)
    .maybeSingle()
  if (!cur) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  // Validate transition
  if (body.action === 'resolve' && !['sent', 'active', 'acknowledged'].includes(cur.status)) {
    return NextResponse.json({ ok: false, error: 'INVALID_TRANSITION', details: `cannot resolve from status='${cur.status}'` }, { status: 409 })
  }
  if (body.action === 'cancel' && !['draft', 'sent'].includes(cur.status)) {
    return NextResponse.json({ ok: false, error: 'INVALID_TRANSITION', details: `cannot cancel from status='${cur.status}'` }, { status: 409 })
  }

  const newStatus = body.action === 'resolve' ? 'resolved' : 'cancelled'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).from('recommendations')
    .update({ status: newStatus })
    .eq('id', params.id)
    .select()
    .single()
  if (error) {
    return NextResponse.json({ ok: false, error: 'UPDATE_FAILED', details: error.message }, { status: 500 })
  }

  // Notify athlete + coach about status change (best effort)
  try {
    const targets: Array<{ user_id: string; type: string; title: string; body: string | null; entity_type: string; entity_id: string; action_url: string | null }> = []
    const titleVerb = body.action === 'resolve' ? 'Закрыта рекомендация' : 'Отменена рекомендация'
    if (cur.athlete_id) {
      targets.push({
        user_id:     cur.athlete_id,
        type:        'broadcast',
        title:       titleVerb,
        body:        cur.title,
        entity_type: 'recommendation',
        entity_id:   params.id,
        action_url:  '/dashboard',
      })
    }
    if (cur.coach_id) {
      targets.push({
        user_id:     cur.coach_id,
        type:        'broadcast',
        title:       titleVerb,
        body:        cur.title,
        entity_type: 'recommendation',
        entity_id:   params.id,
        action_url:  '/dashboard',
      })
    }
    if (targets.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).from('notifications').insert(targets)
    }
  } catch (e) {
    console.warn('[recommendations.lifecycle.notify]', e)
  }

  return NextResponse.json({ ok: true, data })
}
