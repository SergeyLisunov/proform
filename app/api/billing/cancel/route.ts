import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/billing/cancel — Sprint W3 Day 13.
 *
 * Body: { cancel: boolean }
 *   - true  → mark subscription cancel_at_period_end + record cancelled_at
 *   - false → reactivate (un-cancel) before period ends
 *
 * The actual access lockout doesn't happen here — webhook (or future
 * cron) flips status='cancelled' when current_period_end passes. Until
 * then user keeps access. This is industry-standard SaaS UX (Stripe /
 * ЮKassa both support this pattern).
 *
 * Auth required. RLS scopes update to caller's own row by user_id =
 * get_my_user_id().
 */

const Schema = z.object({ cancel: z.boolean() })

export async function POST(req: Request) {
  let body: z.infer<typeof Schema>
  try {
    body = Schema.parse(await req.json())
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_BODY', details: (e as Error).message },
      { status: 400 },
    )
  }

  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { data: me } = await sb
    .from('users')
    .select('id')
    .eq('auth_id', auth.user.id)
    .maybeSingle()
  const meRow = me as { id: string } | null
  if (!meRow) {
    return NextResponse.json({ ok: false, error: 'NO_PROFILE' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from('subscriptions')
    .update({
      cancel_at_period_end: body.cancel,
      cancelled_at: body.cancel ? new Date().toISOString() : null,
    })
    .eq('user_id', meRow.id)
    .select()
    .single()
  if (error) {
    return NextResponse.json(
      { ok: false, error: 'UPDATE_FAILED', details: error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ ok: true, data })
}
