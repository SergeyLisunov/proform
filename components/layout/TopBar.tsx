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
  const title = Object.entries(TITLES).find(([k]) =>
    pathname === k || pathname.startsWith(k + '/')
  )?.[1] ?? 'ProForm'
  const date = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })

  return (
    <header
      id="header"
      className="kt-header fixed top-0 z-10 start-0 end-0 flex items-stretch shrink-0 bg-background border-b border-b-border"
      data-kt-sticky="true"
      data-kt-sticky-class="shadow-sm"
      data-kt-sticky-name="header"
    >
      <div className="kt-container-fixed flex justify-between items-center px-5 lg:px-8 gap-4" id="headerContainer">

        {/* Left: mobile hamburger + title */}
        <div className="flex items-center gap-3">
          <button
            className="kt-btn kt-btn-icon kt-btn-ghost lg:hidden"
            data-kt-drawer-toggle="#sidebar"
          >
            <i className="ki-filled ki-burger-menu-2 text-base" />
          </button>
          <div>
            <h1 className="pf-num text-xl text-foreground leading-none">{title}</h1>
            <p className="text-2xs text-muted-foreground mt-0.5 hidden sm:block">{date}</p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Live badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-2xs font-bold uppercase tracking-wide"
            style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>

          {/* Notifications */}
          <button className="kt-btn kt-btn-icon kt-btn-ghost relative">
            <i className="ki-filled ki-notification-on text-base" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-orange-400" />
          </button>

          {/* User pill */}
          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent border border-border cursor-default">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                style={{ background: '#F97316', color: '#fff', fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-foreground">{user.name.split(' ')[0]}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
