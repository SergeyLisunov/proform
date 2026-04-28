import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCode, whoopProfile } from '@/lib/integrations/whoop/adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/whoop/callback?code=…&state=…
 * Проверяет state, обменивает code на токены, хранит в
 * user_device_connections и редиректит на /settings.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code  = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err   = url.searchParams.get('error')

  if (err) {
    return redirectTo(`/settings?device_error=${encodeURIComponent(err)}`)
  }
  if (!code || !state) {
    return redirectTo('/settings?device_error=missing_params')
  }

  const savedState = req.headers.get('cookie')?.match(/whoop_oauth_state=([a-f0-9]+)/)?.[1]
  if (!savedState || savedState !== state) {
    return redirectTo('/settings?device_error=state_mismatch')
  }

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return redirectTo('/auth/login?redirectTo=/settings')
  const { data: me } = await supabase.from('users').select('id').eq('auth_id', authUser.id).single()
  if (!me) return redirectTo('/settings?device_error=no_profile')
  const meId = (me as { id: string }).id

  try {
    const tokens = await exchangeCode(code)
    const profile = await whoopProfile(tokens.access_token).catch(() => null)

    const admin = createAdminClient()
    await admin.from('user_device_connections').upsert({
      user_id: meId,
      provider: 'whoop',
      status: 'connected',
      is_primary: true,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      provider_user_id: profile ? String(profile.user_id) : null,
      last_sync_at: null,
      last_sync_error: null,
      metadata: profile ? {
        email: profile.email,
        first_name: profile.first_name ?? null,
        last_name:  profile.last_name ?? null,
      } : null,
    }, { onConflict: 'user_id,provider' })

    // Снять is_primary со всех остальных устройств пользователя.
    await admin.from('user_device_connections')
      .update({ is_primary: false })
      .eq('user_id', meId)
      .neq('provider', 'whoop')

    return redirectTo('/settings?device_connected=whoop')
  } catch (e) {
    // Log the full error server-side; redirect with an opaque code only.
    // The previous implementation echoed e.message into the URL, which
    // ended up in browser history, server access logs, and any analytics
    // capturing query strings — a Whoop API error body or token snippet
    // could leak via that channel.
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[whoop/callback]', msg)
    return redirectTo('/settings?device_error=whoop_exchange_failed')
  }
}

function redirectTo(path: string): NextResponse {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://proform-delta.vercel.app'
  const res  = NextResponse.redirect(`${base}${path}`)
  // Очищаем state-cookie.
  res.cookies.set('whoop_oauth_state', '', { maxAge: 0, path: '/' })
  return res
}
