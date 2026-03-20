'use client'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar':  'Calendar',
  '/diary':     'Training Diary',
  '/analytics': 'Analytics',
  '/athletes':  'My Athletes',
  '/admin':     'Admin',
}

export default function TopBar() {
  const pathname = usePathname()
  const { user } = useUser()
  const title = Object.entries(TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1] ?? 'ProForm'
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <header style={{
      height: 56, flexShrink: 0,
      background: '#fff', borderBottom: '1px solid #EBEBEC',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Mobile hamburger */}
        <button
          className="lg:hidden"
          data-kt-drawer-toggle="true"
          data-kt-drawer-target="#sidebar"
          style={{ width: 32, height: 32, borderRadius: 7, background: 'transparent', border: '1px solid #EBEBEC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ki-filled ki-burger-menu-2" style={{ fontSize: 13, color: '#7A7A80' }} />
        </button>
        <div>
          <h1 className="pf-num" style={{ fontSize: 20, color: '#0A0A0B', lineHeight: 1 }}>{title}</h1>
          <div style={{ fontSize: 11, color: '#ADADB3', marginTop: 2 }}>{date}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Live badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'block' }} className="pf-pulse" />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Live</span>
        </div>

        {/* Bell */}
        <button style={{ width: 32, height: 32, borderRadius: 7, background: 'transparent', border: '1px solid #EBEBEC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <i className="ki-filled ki-notification-on" style={{ fontSize: 14, color: '#7A7A80' }} />
          <span style={{ position: 'absolute', top: 7, right: 7, width: 5, height: 5, borderRadius: '50%', background: '#F97316', border: '1.5px solid #fff' }} />
        </button>

        {/* Avatar */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 4px 6px', background: '#F7F7F8', border: '1px solid #EBEBEC', borderRadius: 20, cursor: 'default' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 10, color: '#fff' }}>
              {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#3D3D40' }}>{user.name.split(' ')[0]}</span>
          </div>
        )}
      </div>
    </header>
  )
}
