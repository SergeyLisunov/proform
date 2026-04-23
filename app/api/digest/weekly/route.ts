import { NextResponse } from 'next/server'
import { runCoachWeeklyDigest } from '@/services/email-digest.service'

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
    const result = await runCoachWeeklyDigest()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}
