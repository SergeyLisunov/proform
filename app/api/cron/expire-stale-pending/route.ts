import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/expire-stale-pending — Sprint W3 Day 14 (PR #29).
 *
 * Vercel Cron job scheduled hourly (`"0 * * * *"`). Cleans up
 * `payments` rows that have been in `requires_payment_method` /
 * `pending` state for over 1 hour — these are abandoned checkouts
 * (user clicked "Pay" but never reached the ЮKassa redirect, or the
 * ЮKassa API call failed before user got to it).
 *
 * Why: stale pending payments accumulate forever otherwise, and
 * they confuse the /settings/billing UI ("you have a pending payment")
 * for users who actually abandoned.
 *
 * Auth: standard cron Bearer secret (CRON_SECRET) — same pattern as
 * /api/digest/* and /api/cron/expire-recommendations (Day 11).
 *
 * Idempotent: safe to call multiple times, second call is a no-op
 * because already-cleaned rows no longer match the filter.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!cronSecret || !auth || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString() // -1 hour

  // Find candidates first (for response transparency)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidatesRaw } = await (admin as any).from('payments')
    .select('id')
    .in('status', ['requires_payment_method', 'pending'])
    .lt('created_at', cutoff)
    .limit(500) // Cap per run — at scale, multiple runs cover the queue
  const candidates = ((candidatesRaw ?? []) as Array<{ id: string }>)
  const candidateIds = candidates.map(c => c.id)

  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, expired: 0, message: 'No stale pending payments' })
  }

  // Mark as canceled (don't delete — we want audit trail)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('payments')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .in('id', candidateIds)
  if (error) {
    console.error('[cron/expire-stale-pending] update failed:', error.message)
    return NextResponse.json({ ok: false, error: 'UPDATE_FAILED' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    expired: candidateIds.length,
    message: `Expired ${candidateIds.length} stale pending payments (older than 1h)`,
  })
}
