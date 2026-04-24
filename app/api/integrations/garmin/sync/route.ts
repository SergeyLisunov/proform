import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (!process.env.GARMIN_CONSUMER_KEY || !process.env.GARMIN_CONSUMER_SECRET) {
    return NextResponse.json({
      ok: false,
      error: 'GARMIN_NOT_CONFIGURED',
      hint: 'Подключение Garmin требует Health API Partner Program.',
    }, { status: 503 })
  }
  // TODO: полноценная синхронизация через Garmin Health API.
  return NextResponse.json({ ok: false, error: 'NOT_IMPLEMENTED' }, { status: 501 })
}
