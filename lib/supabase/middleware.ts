import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
    pathname.startsWith('/network')

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

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
