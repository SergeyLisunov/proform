import { NextResponse } from 'next/server'
import { runAthleteDailyDigest } from '@/services/email-digest.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  // Vercel Cron uses x-vercel-cron header; still require CRON_SECRET as bearer.
  return false
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const result = await runAthleteDailyDigest()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e)
    }, { status: 500 })
  }
}
