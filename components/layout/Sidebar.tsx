'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { createBrowserClient } from '@supabase/ssr'

const NAV = [
  { href: '/dashboard', icon: 'ki-element-11',    label: 'Главная',            roles: null },
  { href: '/calendar',  icon: 'ki-calendar',       label: 'Календарь',          roles: ['athlete', 'coach', 'admin'] as string[] },
  { href: '/diary',     icon: 'ki-book-open',      label: 'Дневник тренировок', roles: ['athlete', 'admin'] as string[] },
  { href: '/diary',     icon: 'ki-notepad-edit',   label: 'Дневник наблюдений', roles: ['coach'] as string[] },
  { href: '/messages',  icon: 'ki-message-text-2', label: 'Сообщения',          roles: ['athlete', 'coach'] as string[] },
  { href: '/analytics', icon: 'ki-chart-line-up',  label: 'Аналитика',          roles: ['athlete', 'coach', 'admin'] as string[] },
  { href: '/athletes',  icon: 'ki-people',         label: 'Мои атлеты',         roles: ['coach', 'admin'] as string[] },
  { href: '/org',       icon: 'ki-office-bag',     label: 'Организация',        roles: ['organization'] as string[] },
  { href: '/admin',     icon: 'ki-setting-2',      label: 'Администратор',      roles: ['admin'] as string[] },
  { href: '/admin/crm', icon: 'ki-graph-3', label: 'CRM', roles: ['admin'] as string[] },
  { href: '/pricing', icon: 'ki-dollar', label: 'Тарифы', roles: null },
]

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  athlete:      { label: 'Атлет',         bg: '#FFF7ED', text: '#F97316' },
  coach:        { label: 'Тренер',        bg: '#F0FDF4', text: '#16A34A' },
  admin:        { label: 'Администратор', bg: '#F5F3FF', text: '#7C3AED' },
  organization: { label: 'Организация',   bg: '#EFF6FF', text: '#2563EB' },
}

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [signingOut, setSigningOut] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Счётчик непрочитанных сообщений
  useEffect(() => {
    if (!user || (user.role !== 'athlete' && user.role !== 'coach')) return
    const sb = getSB()

    async function loadUnread() {
      const { data: chats } = await sb
        .from('chats')
        .select('id')
        .or(`athlete_id.eq.${user!.id},coach_id.eq.${user!.id}`)

      if (!chats?.length) { setUnreadCount(0); return }

      const chatIds = chats.map((c: { id: string }) => c.id)
      const { count } = await sb
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('chat_id', chatIds)
        .eq('is_read', false)
        .neq('sender_id', user!.id)

      setUnreadCount(count ?? 0)
    }

    loadUnread()

    // Realtime обновление счётчика
    const channel = sb
      .channel('sidebar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => loadUnread())
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [user])

  const visible = NAV.filter(item => {
    if (!item.roles) return true
    if (!user) return false
    if (item.href === '/diary') {
      if (item.roles.includes('coach') && user.role === 'coach') return true
      if (item.roles.includes('athlete') && (user.role === 'athlete' || user.role === 'admin')) return true
      return false
    }
    return item.roles.includes(user.role)
  })

  async function signOut() {
    setSigningOut(true)
    try {
      await createClient().auth.signOut()
      window.location.href = '/auth/login'
    } catch (err) {
      console.error('signOut error:', err)
      setSigningOut(false)
    }
  }

  return (
    <div
      id="sidebar"
      className="kt-sidebar bg-card border-e border-e-border fixed top-0 bottom-0 z-20 hidden lg:flex flex-col items-stretch shrink-0"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
    >
      {/* Logo */}
      <div className="kt-sidebar-header hidden lg:flex items-center px-5 shrink-0" id="sidebar_header">
        <Link href="/dashboard" className="flex items-center gap-2.5 no-underline group">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
            <i className="ki-filled ki-abstract-26 text-white text-sm" />
          </div>
          <span className="pf-num text-[20px] text-foreground tracking-wide">ProForm</span>
        </Link>
      </div>

      {/* Navigation */}
      <div className="kt-sidebar-content flex grow py-3 overflow-hidden" id="sidebar_content">
        <div
          className="kt-scrollable-y-hover grow flex flex-col px-3"
          data-kt-scrollable="true"
          data-kt-scrollable-dependencies="#sidebar_header"
          data-kt-scrollable-height="auto"
          data-kt-scrollable-wrappers="#sidebar_content"
          id="sidebar_scrollable"
        >
          <div className="kt-menu flex flex-col gap-0.5 grow" data-kt-menu="true">

            <div className="px-2 pb-2">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Навигация</span>
            </div>

            {visible.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
              const isMessages = item.href === '/messages'
              const showBadge = isMessages && unreadCount > 0

              return (
                <div key={item.href + item.label} className="kt-menu-item">
                  <Link
                    href={item.href}
                    className={[
                      'kt-menu-link flex items-center gap-2.5 py-2 px-3 rounded-lg border text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-orange-50 border-orange-200 text-orange-600'
                        : 'border-transparent text-foreground/70 hover:bg-accent hover:border-border hover:text-foreground',
                    ].join(' ')}
                  >
                    <span className="flex items-center justify-center w-5 shrink-0">
                      <i className={`ki-filled ${item.icon} text-[15px] ${active ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </span>
                    <span className="kt-menu-title flex-1">{item.label}</span>
                    {showBadge ? (
                      <span style={{
                        minWidth: 18, height: 18, borderRadius: 9,
                        background: '#f97316', color: 'white',
                        fontSize: 10, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px',
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    ) : active ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                    ) : null}
                  </Link>
                </div>
              )
            })}

            <div className="grow" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-t-border shrink-0">
        <button
          onClick={signOut}
          disabled={signingOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all disabled:opacity-60"
        >
          {signingOut ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Выход…</span>
            </>
          ) : (
            <>
              <i className="ki-filled ki-exit-right text-sm shrink-0" />
              <span>Выйти</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
