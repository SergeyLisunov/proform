'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import type { UserRole } from '@/types/database'

const NAV = [
  { href: '/dashboard', icon: 'ki-element-11',   label: 'Dashboard',      roles: null },
  { href: '/calendar',  icon: 'ki-calendar',      label: 'Calendar',       roles: null },
  { href: '/diary',     icon: 'ki-book-open',     label: 'Training Diary', roles: ['athlete', 'admin'] as string[] },
  { href: '/diary',     icon: 'ki-notepad-edit',  label: 'Obs. Diary',     roles: ['coach'] as string[] },
  { href: '/analytics', icon: 'ki-chart-line-up', label: 'Analytics',      roles: null },
  { href: '/athletes',  icon: 'ki-people',        label: 'My Athletes',    roles: ['coach'] as string[] },
  { href: '/admin',     icon: 'ki-setting-2',     label: 'Admin',          roles: ['admin'] as string[] },
]

const ROLE_COLORS: Record<UserRole, { text: string; bg: string }> = {
  athlete: { text: '#F97316', bg: '#fff3e8' },
  coach:   { text: '#16A34A', bg: '#F0FDF4' },
  admin:   { text: '#7C3AED', bg: '#F5F3FF' },
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()

  const visible = NAV.filter(item => {
    if (!item.roles) return true
    if (!user) return false
    if (item.href === '/diary') {
      if (item.roles.includes('coach') && user.role === 'coach') return true
      if (item.roles.includes('athlete') && user.role !== 'coach') return true
      return false
    }
    return item.roles.includes(user.role)
  })

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  const rc = user ? ROLE_COLORS[user.role] : null

  return (
    <div
      id="sidebar"
      className="kt-sidebar bg-background border-e border-e-border fixed top-0 bottom-0 z-20 hidden lg:flex flex-col items-stretch shrink-0"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
      style={{ '--kt-sidebar-border-color': '#F1F1F4' } as React.CSSProperties}
    >
      {/* Sidebar Header */}
      <div className="kt-sidebar-header hidden lg:flex items-center justify-between px-6 shrink-0 border-b border-b-border" id="sidebar_header"
        style={{ height: 'var(--header-height, 70px)' }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F97316' }}>
            <i className="ki-filled ki-abstract-26 text-white text-sm" />
          </div>
          <span className="pf-num text-xl text-foreground tracking-wide">ProForm</span>
        </Link>
        <button
          id="sidebar_toggle"
          className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline size-[30px]"
          data-kt-toggle="body"
          data-kt-toggle-class="kt-sidebar-collapse"
        >
          <i className="ki-filled ki-black-left-line text-xs kt-toggle-active:rotate-180 transition-all duration-300" />
        </button>
      </div>

      {/* Sidebar Content */}
      <div className="kt-sidebar-content flex grow shrink-0 py-4" id="sidebar_content">
        <div
          className="kt-scrollable-y-hover grow shrink-0 flex px-4"
          data-kt-scrollable="true"
          data-kt-scrollable-dependencies="#sidebar_header"
          data-kt-scrollable-height="auto"
          data-kt-scrollable-wrappers="#sidebar_content"
          id="sidebar_scrollable"
        >
          <div className="kt-menu flex flex-col gap-0.5 grow" data-kt-menu="true">

            {/* Section label */}
            <div className="px-2 pt-1 pb-2">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">Menu</span>
            </div>

            {/* Nav items */}
            {visible.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              return (
                <div key={item.href + item.label} className="kt-menu-item">
                  <Link
                    href={item.href}
                    className={`kt-menu-link flex items-center gap-2.5 py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                      active
                        ? 'border-orange-200 text-orange-600 bg-orange-50'
                        : 'border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <span className="kt-menu-icon flex items-center justify-center w-5 shrink-0">
                      <i className={`ki-filled ${item.icon} text-base ${active ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </span>
                    <span className="kt-menu-title">{item.label}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  </Link>
                </div>
              )
            })}

            {/* WHOOP badge */}
            <div className="mt-4 mx-1 px-3 py-2.5 rounded-xl border" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                <div>
                  <div className="text-2xs font-bold text-green-600 uppercase tracking-wide leading-none">WHOOP Live</div>
                  <div className="text-2xs text-green-500 mt-0.5">100,000 records</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-t-border shrink-0">
        {user && rc && (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
              style={{ background: rc.bg, color: rc.text, fontFamily: "'Bebas Neue', sans-serif" }}
            >
              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">{user.name}</div>
              <div className="text-2xs font-bold uppercase tracking-wide mt-0.5" style={{ color: rc.text }}>{user.role}</div>
            </div>
            <button
              onClick={signOut}
              className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost w-7 h-7 shrink-0"
              title="Sign out"
            >
              <i className="ki-filled ki-exit-right text-xs text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
