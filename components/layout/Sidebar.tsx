'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import type { UserRole } from '@/types/database'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',      icon: 'ki-element-11',    roles: null },
  { href: '/calendar',   label: 'Calendar',        icon: 'ki-calendar',      roles: null },
  { href: '/diary',      label: 'Training Diary',  icon: 'ki-book-open',     roles: ['athlete', 'admin'] },
  { href: '/diary',      label: 'Obs. Diary',      icon: 'ki-notepad-edit',  roles: ['coach'] },
  { href: '/analytics',  label: 'Analytics',       icon: 'ki-chart-line-up', roles: null },
  { href: '/athletes',   label: 'My Athletes',     icon: 'ki-people',        roles: ['coach'] },
  { href: '/admin',      label: 'Admin',           icon: 'ki-setting-2',     roles: ['admin'] },
]

const ROLE_CONFIG: Record<UserRole, { color: string; bg: string; label: string; initBg: string }> = {
  athlete: { color: '#60A5FA', bg: '#1e3a5f', label: 'Athlete', initBg: '#1e3a5f' },
  coach:   { color: '#FB923C', bg: '#3d2010', label: 'Coach',   initBg: '#3d2010' },
  admin:   { color: '#A78BFA', bg: '#2d1f5e', label: 'Admin',   initBg: '#2d1f5e' },
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useUser()

  const visibleNav = NAV.filter(item => {
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
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const rc = user ? ROLE_CONFIG[user.role] : null

  return (
    <div
      id="sidebar"
      className="kt-sidebar fixed top-0 bottom-0 z-20 hidden lg:flex flex-col items-stretch shrink-0 [--kt-drawer-enable:true] lg:[--kt-drawer-enable:false]"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
      style={{ width: 240, background: '#111113', borderRight: '1px solid #1c1c1f' }}
    >
      {/* Top accent line */}
      <div style={{ height: 2, background: 'linear-gradient(90deg, #F97316, #fb923c44)', flexShrink: 0 }} />

      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1c1c1f' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 14 }} />
          </div>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: '#fff', letterSpacing: '0.06em' }}>ProForm</span>
        </div>
        <button
          id="sidebar_toggle"
          data-kt-toggle="body"
          data-kt-toggle-class="kt-sidebar-collapse"
          style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid #27272A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#52525B' }}
        >
          <i className="ki-filled ki-black-left text-xs kt-toggle-active:rotate-180 transition-transform duration-200" />
        </button>
      </div>

      {/* WHOOP badge */}
      <div style={{ margin: '12px 14px', padding: '8px 12px', background: '#0d1f0f', border: '1px solid #14532d', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px #22c55e' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#16a34a', letterSpacing: '0.09em', textTransform: 'uppercase', lineHeight: 1 }}>WHOOP Live</div>
          <div style={{ fontSize: 10, color: '#166534', marginTop: 2 }}>100,000 records</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 10px' }} id="sidebar_content">
        <div style={{ fontSize: 9, fontWeight: 700, color: '#3f3f46', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 10px 6px' }}>
          Navigation
        </div>
        {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href + item.label} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 10, marginBottom: 1,
                background: active ? '#1a1a1f' : 'transparent',
                borderLeft: active ? '2px solid #F97316' : '2px solid transparent',
                paddingLeft: 8,
                textDecoration: 'none',
                transition: 'all 0.12s',
              }}
              className="sidebar-link"
            >
              <i className={`ki-filled ${item.icon}`} style={{ fontSize: 15, color: active ? '#F97316' : '#52525B', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#fff' : '#71717A' }}>
                {item.label}
              </span>
              {active && <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#F97316' }} />}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #1c1c1f' }}>
        {user && rc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: rc.initBg, border: `1px solid ${rc.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: rc.color
            }}>
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: rc.color, marginTop: 1, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {rc.label}
              </div>
            </div>
            <button onClick={signOut}
              style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: '1px solid #27272A', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#52525B', flexShrink: 0 }}
              title="Sign out"
            >
              <i className="ki-filled ki-exit-right" style={{ fontSize: 12 }} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .sidebar-link:hover { background: #161618 !important; }
      `}</style>
    </div>
  )
}
