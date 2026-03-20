'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':  { title: 'Dashboard',       sub: 'Your performance overview' },
  '/calendar':   { title: 'Calendar',         sub: 'Training & competition schedule' },
  '/diary':      { title: 'Training Diary',   sub: 'Log and review sessions' },
  '/analytics':  { title: 'Analytics',        sub: 'WHOOP biometric insights' },
  '/athletes':   { title: 'My Athletes',      sub: 'Team performance overview' },
  '/admin':      { title: 'Admin Panel',      sub: 'Platform management' },
}

export default function TopBar() {
  const pathname = usePathname()
  const { user } = useUser()

  const pageInfo = Object.entries(PAGE_TITLES).find(([k]) =>
    pathname === k || pathname.startsWith(k + '/')
  )?.[1] ?? { title: 'ProForm', sub: '' }

  const now = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <div
      id="header"
      style={{
        height: 58, flexShrink: 0,
        background: '#fff',
        borderBottom: '1px solid #E4E4E7',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky', top: 0, zIndex: 10,
      }}
    >
      {/* Mobile hamburger + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          className="lg:hidden"
          data-kt-drawer-toggle="true"
          data-kt-drawer-target="#sidebar"
          style={{ width: 34, height: 34, borderRadius: 8, background: 'transparent', border: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#71717A' }}
        >
          <i className="ki-filled ki-burger-menu-2" style={{ fontSize: 14 }} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: '#09090B', lineHeight: 1, letterSpacing: '0.03em', margin: 0 }}>
              {pageInfo.title}
            </h1>
            <span className="hidden sm:inline" style={{ fontSize: 12, color: '#A1A1AA' }}>
              — {pageInfo.sub}
            </span>
          </div>
          <div className="hidden sm:block" style={{ fontSize: 11, color: '#A1A1AA', marginTop: 1 }}>{now}</div>
        </div>
      </div>

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* LIVE indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', fontSize: 10, fontWeight: 700, color: '#16A34A', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulse 2s infinite', boxShadow: '0 0 4px #22c55e' }} />
          WHOOP Live
        </div>

        {/* Notifications */}
        <button style={{ width: 34, height: 34, borderRadius: 8, background: 'transparent', border: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <i className="ki-filled ki-notification-on" style={{ fontSize: 15, color: '#71717A' }} />
          <span style={{ position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: '50%', background: '#F97316', border: '1.5px solid #fff' }} />
        </button>

        {/* User quick info */}
        {user && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: '#FAFAFA', border: '1px solid #E4E4E7' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', fontFamily: "'Bebas Neue', sans-serif" }}>
              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#3F3F46' }}>{user.name.split(' ')[0]}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
