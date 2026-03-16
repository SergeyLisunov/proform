'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import type { UserRole } from '@/types/database'

interface NavItem {
  href: string
  label: string
  icon: string
  roles?: UserRole[]
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard',       icon: 'ki-element-11' },
  { href: '/calendar',  label: 'Calendar',         icon: 'ki-calendar' },
  { href: '/diary',     label: 'Training Diary',   icon: 'ki-book-open',  roles: ['athlete', 'admin'] },
  { href: '/diary',     label: 'Obs. Diary',       icon: 'ki-notepad-edit', roles: ['coach'] },
  { href: '/analytics', label: 'Analytics',        icon: 'ki-graph-up' },
  { href: '/athletes',  label: 'My Athletes',      icon: 'ki-people',     roles: ['coach'] },
  { href: '/admin',     label: 'Admin',            icon: 'ki-setting-2',  roles: ['admin'] },
]

const ROLE_BADGE: Record<UserRole, { label: string; bg: string; text: string }> = {
  athlete: { label: 'Athlete', bg: '#DBEAFE', text: '#2563EB' },
  coach:   { label: 'Coach',   bg: '#FFEDD5', text: '#F97316' },
  admin:   { label: 'Admin',   bg: '#EDE9FE', text: '#7C3AED' },
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()

  const visibleNav = NAV.filter(item => {
    if (!item.roles) return true
    if (!user) return false
    // For coach: show coach diary not athlete diary
    if (item.href === '/diary' && item.roles.includes('coach') && user.role === 'coach') return true
    if (item.href === '/diary' && item.roles.includes('athlete') && user.role !== 'coach') return true
    if (item.href === '/diary') return false
    return item.roles.includes(user.role)
  })

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const badge = user ? ROLE_BADGE[user.role] : null

  return (
    <div
      id="sidebar"
      className="kt-sidebar bg-white border-e border-[#E2E8F0] fixed top-0 bottom-0 z-20 hidden lg:flex flex-col items-stretch shrink-0"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
      style={{ width: 240 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#F97316' }}>
            <i className="ki-filled ki-abstract-26 text-white text-base" />
          </div>
          <span className="pf-num text-xl text-slate-900 tracking-wide">ProForm</span>
        </div>
        {/* Collapse toggle */}
        <button
          id="sidebar_toggle"
          data-kt-toggle="body"
          data-kt-toggle-class="kt-sidebar-collapse"
          className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline size-7 rounded-lg border-[#E2E8F0] text-slate-400 hover:text-slate-700"
        >
          <i className="ki-filled ki-black-left text-xs kt-toggle-active:rotate-180 transition-transform duration-200" />
        </button>
      </div>

      {/* WHOOP badge */}
      <div className="mx-4 mt-3 mb-1 px-3 py-2 rounded-xl flex items-center gap-2.5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <i className="ki-filled ki-pulse text-green-500 text-sm" />
        <div>
          <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider leading-none">WHOOP Connected</div>
          <div className="text-[10px] text-green-500 mt-0.5">100K records loaded</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-3 px-3" id="sidebar_content">
        <div className="kt-menu flex flex-col gap-0.5" data-kt-menu="true">
          {visibleNav.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                  active
                    ? 'text-[#2563EB] bg-[#EFF6FF]'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <i className={`ki-filled ${item.icon} text-base ${active ? 'text-[#2563EB]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{item.label}</span>
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#2563EB' }} />}
              </Link>
            )
          })}
        </div>
      </div>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-[#F1F5F9]">
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
              style={{ background: badge?.text }}>
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-800 truncate">{user.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge?.bg, color: badge?.text }}>
                  {badge?.label}
                </span>
              </div>
            </div>
            <button onClick={signOut} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0">
              <i className="ki-filled ki-exit-right text-sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
