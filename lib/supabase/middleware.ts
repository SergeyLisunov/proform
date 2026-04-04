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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthRoute = pathname.startsWith('/auth')
  const isPublic = pathname === '/'

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

  if (!user && !isAuthRoute && !isPublic && !isOrgPublicPage) {
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
