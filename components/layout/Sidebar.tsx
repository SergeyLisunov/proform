'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import type { UserRole } from '@/types/database'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',     icon: 'ki-element-11',    roles: null },
  { href: '/calendar',   label: 'Calendar',       icon: 'ki-calendar',      roles: null },
  { href: '/diary',      label: 'Training Diary', icon: 'ki-book-open',     roles: ['athlete','admin'] as UserRole[] },
  { href: '/diary',      label: 'Obs. Diary',     icon: 'ki-notepad-edit',  roles: ['coach'] as UserRole[] },
  { href: '/analytics',  label: 'Analytics',      icon: 'ki-chart-line-up', roles: null },
  { href: '/athletes',   label: 'My Athletes',    icon: 'ki-people',        roles: ['coach'] as UserRole[] },
  { href: '/admin',      label: 'Admin',          icon: 'ki-setting-2',     roles: ['admin'] as UserRole[] },
]

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  athlete: { label: 'Athlete', color: '#2563EB', bg: '#EFF6FF' },
  coach:   { label: 'Coach',   color: '#F97316', bg: '#FFF7ED' },
  admin:   { label: 'Admin',   color: '#7C3AED', bg: '#F5F3FF' },
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user } = useUser()

  const visibleNav = NAV.filter(item => {
    if (!item.roles) return true
    if (!user) return false
    if (item.href === '/diary') {
      if (item.roles.includes('coach') && user.role === 'coach') return true
      if (!item.roles.includes('coach') && user.role !== 'coach') return true
      return false
    }
    return item.roles.includes(user.role)
  })

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  const rm = user ? ROLE_META[user.role] : null

  return (
    <div
      id="sidebar"
      className="kt-sidebar fixed top-0 bottom-0 z-20 hidden lg:flex flex-col shrink-0 [--kt-drawer-enable:true] lg:[--kt-drawer-enable:false]"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
      style={{ width: 240, background: '#fff', borderRight: '1px solid #F0F0F0' }}
    >
      {/* Orange top rule */}
      <div style={{ height: 3, background: '#F97316', flexShrink: 0 }} />

      {/* Logo row */}
      <div style={{ padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ki-filled ki-abstract-26" style={{ color: '#fff', fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 19, color: '#09090B', letterSpacing: '0.06em', lineHeight: 1 }}>ProForm</div>
            <div style={{ fontSize: 9, color: '#A1A1AA', letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 1 }}>Training Platform</div>
          </div>
        </div>
        <button id="sidebar_toggle" data-kt-toggle="body" data-kt-toggle-class="kt-sidebar-collapse"
          style={{ width: 26, height: 26, borderRadius: 7, background: '#FAFAFA', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#A1A1AA' }}>
          <i className="ki-filled ki-black-left kt-toggle-active:rotate-180 transition-transform duration-200" style={{ fontSize: 10 }} />
        </button>
      </div>

      {/* WHOOP badge */}
      <div style={{ margin: '0 14px 14px', padding: '8px 12px', background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 0 2px #bbf7d0' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1 }}>WHOOP Connected</div>
          <div style={{ fontSize: 10, color: '#4ADE80', marginTop: 2 }}>100,000 records loaded</div>
        </div>
      </div>

      {/* Divider label */}
      <div style={{ padding: '0 20px 6px', fontSize: 9, fontWeight: 700, color: '#D4D4D8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Menu
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
        {visibleNav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href + item.label} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 12px', borderRadius: 11, marginBottom: 2,
                background: active ? '#FFF7ED' : 'transparent',
                border: active ? '1px solid #FFEDD5' : '1px solid transparent',
                textDecoration: 'none', transition: 'all 0.12s',
              }}
              className="pf-nav-item"
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: active ? '#F97316' : '#F4F4F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.12s',
              }}>
                <i className={`ki-filled ${item.icon}`} style={{ fontSize: 13, color: active ? '#fff' : '#A1A1AA' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#F97316' : '#52525B', transition: 'color 0.12s' }}>
                {item.label}
              </span>
              {active && (
                <div style={{ marginLeft: 'auto', width: 5, height: 5, borderRadius: '50%', background: '#F97316' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      {user && rm && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', background: rm.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Bebas Neue',sans-serif", fontSize: 13, color: rm.color,
              border: `1.5px solid ${rm.color}30`,
            }}>
              {user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: rm.color, marginTop: 1, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{rm.label}</div>
            </div>
            <button onClick={signOut} title="Sign out"
              style={{ width: 28, height: 28, borderRadius: 7, background: 'transparent', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#A1A1AA', flexShrink: 0 }}>
              <i className="ki-filled ki-exit-right" style={{ fontSize: 12 }} />
            </button>
          </div>
        </div>
      )}

      <style>{`.pf-nav-item:hover { background: #FAFAFA !important; border-color: #F0F0F0 !important; }`}</style>
    </div>
  )
}
