/**
 * GET /api/cron/expire-inquiries — Sprint W5 Day 26 (PR #43).
 *
 * Daily cron — marks pending doctor_inquiries старше expires_at как 'expired'.
 * Используется чтобы coach видел что inquiry timed out и мог создать новый
 * (e.g. перейти на personal doctor вместо open queue).
 *
 * Auth: CRON_SECRET via Bearer (mirror /api/cron/expire-stale-pending pattern).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  // W21 audit fix (#4): fail-closed (was fail-open when CRON_SECRET unset).
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET_NOT_CONFIGURED' }, { status: 503 })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const start = Date.now()
  const admin = createAdminClient()

  // Mark expired pending inquiries
  const { data: expired, error } = await admin
    .from('doctor_inquiries')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  if (error) {
    return NextResponse.json({
      ok:           false,
      error:        'UPDATE_FAILED',
      duration_ms:  Date.now() - start,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok:           true,
    expired:      (expired ?? []).length,
    duration_ms:  Date.now() - start,
  })
}
