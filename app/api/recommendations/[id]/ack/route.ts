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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'INVALID_BODY', details: (e as Error).message }, { status: 400 })
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

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
    return NextResponse.json({ ok: false, error: 'ACK_FAILED', details: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, data })
}
