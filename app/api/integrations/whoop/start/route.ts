import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl } from '@/lib/integrations/whoop/adapter'
import crypto from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/whoop/start
 * Auth required. Генерирует CSRF-state, выставляет http-only cookie
 * `whoop_oauth_state`, редиректит на Whoop.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, error: 'WHOOP_NOT_CONFIGURED' }, { status: 503 })
  }

  const state = crypto.randomBytes(24).toString('hex')
  const url   = buildAuthorizeUrl(state)
  const res   = NextResponse.redirect(url)
  res.cookies.set('whoop_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: 600, path: '/',
  })
  return res
}
