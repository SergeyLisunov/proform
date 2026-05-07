import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/expire-recommendations
 *
 * Sprint W2 Day 11 — daily cron, calls expire_stale_recommendations()
 * SECURITY DEFINER function (migration 052) which marks status='expired'
 * for recommendations whose valid_until < CURRENT_DATE.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` —
 * matches existing /api/digest/* pattern. Без правильного header'а — 401.
 *
 * Idempotent: function only updates rows that need expiring; повторный
 * запуск в тот же день дополнительно ничего не меняет (rows уже
 * status='expired').
 *
 * Schedule в vercel.json: "0 3 * * *" (3 AM UTC daily).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET_NOT_CONFIGURED' }, { status: 503 })
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const sb = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc('expire_stale_recommendations')
  if (error) {
    console.error('[cron expire-recommendations] rpc error:', error.message)
    return NextResponse.json({ ok: false, error: 'RPC_FAILED', details: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    expired_count: typeof data === 'number' ? data : 0,
    timestamp: new Date().toISOString(),
  })
}
