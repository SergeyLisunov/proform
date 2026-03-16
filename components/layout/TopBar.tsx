'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/calendar':   'Calendar',
  '/diary':      'Training Diary',
  '/analytics':  'Analytics',
  '/athletes':   'My Athletes',
  '/admin':      'Admin Panel',
}

export default function TopBar() {
  const pathname = usePathname()
  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1] ?? 'ProForm'

  const now = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div
      id="header"
      className="kt-header bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 sticky top-0 z-10"
      style={{ height: 60 }}
    >
      {/* Mobile hamburger */}
      <div className="flex items-center gap-4">
        <button
          className="kt-btn kt-btn-icon kt-btn-sm lg:hidden border border-[#E2E8F0] rounded-lg text-slate-500"
          data-kt-drawer-toggle="true"
          data-kt-drawer-target="#sidebar"
        >
          <i className="ki-filled ki-burger-menu-2 text-base" />
        </button>
        <div>
          <h1 className="pf-num text-xl text-slate-900 leading-none">{title}</h1>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{now}</p>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          LIVE
        </div>
        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition">
          <i className="ki-filled ki-notification-on text-lg" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F97316] border-2 border-white" />
        </button>
      </div>
    </div>
  )
}
