import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware — refreshes the Supabase session cookie on every request
 * AND enforces onboarding completion for authenticated users (W7 Day 33).
 *
 * Onboarding enforcement (W7 Day 33):
 *   - Authenticated user → fetch role + onboarding_state from `users`.
 *   - If role !== 'admin' AND onboarding_state.completed !== true →
 *     redirect to /onboarding (which dispatches to role-specific wizard).
 *   - Legacy users (pre-2026-05-12) were backfilled in Migration 068
 *     with `completed: true, backfilled: true` so they pass through.
 *   - New post-W6 signups have default '{}'::jsonb → forced through wizard.
 *
 * Fail-safe principle: if the prefs lookup fails (DB hiccup, RLS edge
 * case, network), the user is NOT locked out — we fall through to the
 * normal session-refresh response. Better to let an un-onboarded user
 * see the dashboard than to block everyone on a flaky query.
 *
 * Exempt paths (no redirect even if onboarding incomplete):
 *   - /onboarding/*  — the wizard itself
 *   - /auth/*        — login / logout / register / callback
 *   - /api/*         — JSON handlers manage their own auth
 *   - /legal/*       — terms, privacy, etc.
 *   - /tools/*       — public lead magnets
 *   - /invite/*      — public invite acceptance
 *   - /p/*           — public athlete passports
 *   - /             — landing page
 *   - public org pages (single-segment slug, not in reservedTopLevelSlugs)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // W15 Day 77 A/B variant cookie assignment retired W16 Day 78 — landing
  // rebuilt к single voice (variant B copy не sold). Calculator widget +
  // admin page kept для будущих tests. Когда new A/B run — re-add cookie
  // logic здесь.

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/auth')
  const isPublic = pathname === '/'

  // API routes manage their own auth and должны возвращать 401/404 в JSON.
  // Middleware не должен редиректить их на login, иначе тесты/клиенты
  // получают 200 (рендер login-страницы) вместо правильного статуса.
  const isApiRoute = pathname.startsWith('/api/')

  // Public multi-segment prefixes — lead-magnet tools, invite tokens, network pages.
  const isPublicPrefix =
    pathname.startsWith('/tools/') ||
    pathname.startsWith('/invite/') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/network')

  // W7 Day 33: paths exempt from onboarding redirect (in addition to
  // public/api/auth — those are exempted by being above the auth gate).
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isLegalRoute      = pathname.startsWith('/legal/')

  // Public org pages: /[orgSlug] — single-segment paths that do not collide with app slugs.
  const reservedTopLevelSlugs = new Set([
    'dashboard',
    'calendar',
    'diary',
    'analytics',
    'athletes',
    'messages',
    'settings',
    'pricing',
    'admin',
    'org',
    'auth',
    'api',
    'onboarding',
  ])
  const isOrgPublicPage =
    !reservedTopLevelSlugs.has(pathname.slice(1)) &&
    /^\/[a-z0-9-]+$/.test(pathname)

  if (!user && !isAuthRoute && !isPublic && !isPublicPrefix && !isOrgPublicPage && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  // ── W7 Day 33: onboarding gate for authenticated non-admin users ────
  if (user && !isAuthRoute && !isApiRoute && !isOnboardingRoute && !isLegalRoute && !isPublicPrefix && !isOrgPublicPage && !isPublic) {
    try {
      const { data: meRow } = await supabase
        .from('users')
        .select('role, onboarding_state')
        .eq('auth_id', user.id)
        .maybeSingle()

      const me = meRow as { role: string | null; onboarding_state: { completed?: boolean } | null } | null
      // Skip check for admins (they may have created accounts manually
      // bypassing the wizard) and for users with missing rows (defensive).
      if (me && me.role !== 'admin') {
        const completed = me.onboarding_state?.completed === true
        if (!completed) {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          // Preserve original destination so wizard can return there on finish
          // (future enhancement; current wizards redirect to role home).
          url.searchParams.set('return_to', `${pathname}${request.nextUrl.search}`)
          return NextResponse.redirect(url)
        }
      }
    } catch {
      // Fail-open: if the lookup fails, let the user through. Better UX
      // than a hard lock on a flaky DB query.
    }
  }

  if (user && isAuthRoute) {
    // After login/register, if onboarding isn't complete, route there
    // directly instead of bouncing through /dashboard.
    try {
      const { data: meRow } = await supabase
        .from('users')
        .select('role, onboarding_state')
        .eq('auth_id', user.id)
        .maybeSingle()
      const me = meRow as { role: string | null; onboarding_state: { completed?: boolean } | null } | null
      const completed = me?.onboarding_state?.completed === true
      const url = request.nextUrl.clone()
      url.pathname = (me && me.role !== 'admin' && !completed) ? '/onboarding' : '/dashboard'
      return NextResponse.redirect(url)
    } catch {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
