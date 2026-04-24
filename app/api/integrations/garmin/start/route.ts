import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Garmin Connect использует OAuth 1.0a и требует одобрения в
 * Health API Partner Program. На этом этапе — stub: если нет
 * credentials в env — возвращаем 503 с понятным кодом.
 *
 * TODO: реализовать OAuth 1.0a (request_token → authorize → access_token)
 * когда будет аппрув.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })

  if (!process.env.GARMIN_CONSUMER_KEY || !process.env.GARMIN_CONSUMER_SECRET) {
    return NextResponse.json({
      ok: false,
      error: 'GARMIN_NOT_CONFIGURED',
      hint: 'Требуется одобрение Garmin Health API Partner Program и env GARMIN_CONSUMER_KEY/SECRET.',
    }, { status: 503 })
  }

  // TODO: запустить OAuth 1.0a handshake.
  return NextResponse.json({ ok: false, error: 'GARMIN_OAUTH_NOT_IMPLEMENTED' }, { status: 501 })
}
