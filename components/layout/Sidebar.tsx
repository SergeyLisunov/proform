'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import type { UserRole } from '@/types/database'

const NAV = [
  { href: '/dashboard', icon: 'ki-element-11',     label: 'Dashboard',      roles: null },
  { href: '/calendar',  icon: 'ki-calendar',        label: 'Calendar',       roles: null },
  { href: '/diary',     icon: 'ki-book-open',       label: 'Training Diary', roles: ['athlete','admin'] as string[] },
  { href: '/diary',     icon: 'ki-notepad-edit',    label: 'Obs. Diary',     roles: ['coach'] as string[] },
  { href: '/analytics', icon: 'ki-chart-line-up',   label: 'Analytics',      roles: null },
  { href: '/athletes',  icon: 'ki-people',          label: 'My Athletes',    roles: ['coach'] as string[] },
  { href: '/admin',     icon: 'ki-setting-2',       label: 'Admin',          roles: ['admin'] as string[] },
]

const ROLE_BADGE: Record<UserRole, { c: string; bg: string }> = {
  athlete: { c: '#F97316', bg: '#fff3e8' },
  coach:   { c: '#16A34A', bg: '#F0FDF4' },
  admin:   { c: '#7C3AED', bg: '#F5F3FF' },
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

  const rb = user ? ROLE_BADGE[user.role] : null

  return (
    <div
      id="sidebar"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
      style={{
        width: 232, flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #EBEBEC',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 20,
      }}
      className="hidden lg:flex"
    >
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F2F2F3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, background: '#F97316', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 13 }} />
          </div>
          <span className="pf-num" style={{ fontSize: 19, color: '#0A0A0B', letterSpacing: '0.05em' }}>ProForm</span>
        </div>
        <button
          id="sidebar_toggle"
          data-kt-toggle="body"
          data-kt-toggle-class="kt-sidebar-collapse"
          style={{ width: 24, height: 24, borderRadius: 5, background: 'transparent', border: '1px solid #EBEBEC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ADADB3' }}
        >
          <i className="ki-filled ki-black-left" style={{ fontSize: 10 }} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#ADADB3', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>Menu</div>
        {visible.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href + item.label} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 9, marginBottom: 1,
              background: active ? '#FFF3E8' : 'transparent',
              borderLeft: `3px solid ${active ? '#F97316' : 'transparent'}`,
              transition: 'all .12s',
              color: 'inherit',
            }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F7F7F8' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <i className={`ki-filled ${item.icon}`} style={{ fontSize: 14, color: active ? '#F97316' : '#ADADB3', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#F97316' : '#3D3D40' }}>{item.label}</span>
            </Link>
          )
        })}

        {/* WHOOP badge */}
        <div style={{ margin: '16px 4px 0', padding: '10px 12px', background: '#F7F7F8', border: '1px solid #EBEBEC', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} className="pf-pulse" />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1 }}>WHOOP Live</div>
            <div style={{ fontSize: 10, color: '#ADADB3', marginTop: 2 }}>100,000 records</div>
          </div>
        </div>
      </nav>

      {/* User */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #F2F2F3' }}>
        {user && rb && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: rb.bg, border: `1.5px solid ${rb.c}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: rb.c,
            }}>
              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0A0A0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: rb.c, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 1 }}>{user.role}</div>
            </div>
            <button onClick={signOut} title="Sign out"
              style={{ width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid #EBEBEC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ADADB3', flexShrink: 0 }}>
              <i className="ki-filled ki-exit-right" style={{ fontSize: 11 }} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
