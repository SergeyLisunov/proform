import { NextResponse } from 'next/server'
import { runCoachWeeklyDigest, runParentWeeklyDigest } from '@/services/email-digest.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    // P1 — parent weekly report едет тем же воскресным кроном, что и
    // coach-дайджест: без новой записи в vercel.json.
    const [coach, parent] = await Promise.all([
      runCoachWeeklyDigest(),
      runParentWeeklyDigest(),
    ])
    return NextResponse.json({ ok: true, coach, parent })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}
