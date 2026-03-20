'use client'

import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'

const PAGE_META: Record<string, { title: string; sub: string }> = {
  '/dashboard': { title: 'Dashboard',     sub: 'Performance overview' },
  '/calendar':  { title: 'Calendar',      sub: 'Training schedule' },
  '/diary':     { title: 'Training Diary',sub: 'Session log' },
  '/analytics': { title: 'Analytics',     sub: 'WHOOP insights' },
  '/athletes':  { title: 'My Athletes',   sub: 'Team overview' },
  '/admin':     { title: 'Admin',         sub: 'Platform management' },
}

export default function TopBar() {
  const pathname = usePathname()
  const { user } = useUser()
  const meta = Object.entries(PAGE_META).find(([k]) => pathname === k || pathname.startsWith(k+'/'))?.[1]
    ?? { title: 'ProForm', sub: '' }

  const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div id="header" style={{
      height: 56, flexShrink: 0, background: '#fff',
      borderBottom: '1px solid #F0F0F0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Mobile burger */}
        <button className="lg:hidden" data-kt-drawer-toggle="true" data-kt-drawer-target="#sidebar"
          style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="ki-filled ki-burger-menu-2" style={{ fontSize: 13, color: '#A1A1AA' }} />
        </button>
        {/* Breadcrumb-style title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: '#09090B', letterSpacing: '0.03em', lineHeight: 1 }}>
            {meta.title}
          </span>
          {meta.sub && <>
            <span style={{ fontSize: 13, color: '#D4D4D8' }}>/</span>
            <span className="hidden sm:inline" style={{ fontSize: 12, color: '#A1A1AA' }}>{meta.sub}</span>
          </>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Date */}
        <span className="hidden md:inline" style={{ fontSize: 11, color: '#D4D4D8', marginRight: 6 }}>{date}</span>

        {/* WHOOP live pill */}
        <div className="hidden sm:flex items-center gap-1.5" style={{
          padding: '5px 10px', borderRadius: 20, background: '#F0FDF4',
          border: '1px solid #DCFCE7', fontSize: 10, fontWeight: 700,
          color: '#16A34A', letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
          Live
        </div>

        {/* Bell */}
        <button style={{ position: 'relative', width: 34, height: 34, borderRadius: 9, background: 'transparent', border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <i className="ki-filled ki-notification-on" style={{ fontSize: 14, color: '#A1A1AA' }} />
          <span style={{ position: 'absolute', top: 8, right: 8, width: 5, height: 5, borderRadius: '50%', background: '#F97316', border: '1.5px solid #fff' }} />
        </button>

        {/* User chip */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 6px', borderRadius: 20, background: '#FAFAFA', border: '1px solid #F0F0F0' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 10, color: '#fff' }}>
              {user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <span className="hidden sm:inline" style={{ fontSize: 12, fontWeight: 500, color: '#3F3F46' }}>{user.name.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </div>
  )
}
