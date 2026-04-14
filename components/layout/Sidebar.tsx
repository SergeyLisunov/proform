'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { createBrowserClient } from '@supabase/ssr'

const NAV_SECTIONS = [
  {
    title: 'Обзор',
    items: [
      { href: '/dashboard', icon: 'ki-element-11', label: 'Главная', roles: null },
    ],
  },
  {
    title: 'Тренировки',
    items: [
      { href: '/calendar', icon: 'ki-calendar', label: 'Календарь', roles: ['athlete', 'coach', 'admin'] as string[] },
      { href: '/diary', icon: 'ki-book-open', label: 'Дневник тренировок', roles: ['athlete', 'admin'] as string[] },
      { href: '/diary', icon: 'ki-notepad-edit', label: 'Дневник наблюдений', roles: ['coach'] as string[] },
      { href: '/messages', icon: 'ki-message-text-2', label: 'Сообщения', roles: ['athlete', 'coach'] as string[] },
    ],
  },
  {
    title: 'Команда',
    items: [
      { href: '/analytics', icon: 'ki-chart-line-up', label: 'Аналитика', roles: ['athlete', 'coach', 'admin'] as string[] },
      { href: '/athletes', icon: 'ki-people', label: 'Мои атлеты', roles: ['coach', 'admin'] as string[] },
    ],
  },
  {
    title: 'Управление',
    items: [
      { href: '/org', icon: 'ki-office-bag', label: 'Организация', roles: ['organization'] as string[] },
      { href: '/admin', icon: 'ki-setting-2', label: 'Администратор', roles: ['admin'] as string[] },
      { href: '/admin/crm', icon: 'ki-graph-3', label: 'CRM', roles: ['admin'] as string[] },
    ],
  },
  {
    title: 'Доступ',
    items: [
      { href: '/pricing', icon: 'ki-dollar', label: 'Тарифы', roles: null },
    ],
  },
] as const

const ROLE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  athlete:      { label: 'Атлет',         bg: '#FFF7ED', text: '#F97316' },
  coach:        { label: 'Тренер',        bg: '#F0FDF4', text: '#16A34A' },
  admin:        { label: 'Администратор', bg: '#F5F3FF', text: '#7C3AED' },
  organization: { label: 'Организация',   bg: '#EFF6FF', text: '#2563EB' },
}

const GUEST_ROLE = { label: 'Гость', bg: '#F8FAFC', text: '#64748B' }

function getSB() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getRoleMeta(role?: string) {
  return role && ROLE_LABELS[role] ? ROLE_LABELS[role] : GUEST_ROLE
}

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [signingOut, setSigningOut] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const roleMeta = getRoleMeta(user?.role)

  useEffect(() => {
    if (!user || (user.role !== 'athlete' && user.role !== 'coach')) return
    const sb = getSB()
    let mounted = true

    async function loadUnread() {
      const { data: chats } = await sb
        .from('chats')
        .select('id')
        .or(`athlete_id.eq.${user!.id},coach_id.eq.${user!.id}`)

      if (!mounted) return
      if (!chats?.length) { setUnreadCount(0); return }

      const chatIds = chats.map((c: { id: string }) => c.id)
      const { count } = await sb
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('chat_id', chatIds)
        .eq('is_read', false)
        .neq('sender_id', user!.id)

      if (!mounted) return
      setUnreadCount(count ?? 0)
    }

    loadUnread()

    const channel = sb
      .channel('sidebar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadUnread())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => loadUnread())
      .subscribe()

    return () => {
      mounted = false
      sb.removeChannel(channel)
    }
  }, [user])

  const visibleSections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (!item.roles) return true
        if (!user) return false
        return item.roles.includes(user.role)
      }),
    }))
    .filter(section => section.items.length > 0)

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
      className="kt-sidebar bg-card border-e border-e-border fixed top-0 bottom-0 z-20 hidden lg:flex flex-col items-stretch shrink-0 shadow-[0_12px_40px_rgba(15,23,42,0.04)]"
      data-kt-drawer="true"
      data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
    >
      <div
        className="kt-sidebar-header hidden lg:flex flex-col gap-4 px-4 pt-5 pb-5 shrink-0"
        id="sidebar_header"
        style={{ height: 'auto' }}
      >
        <Link href="/dashboard" className="flex items-center gap-3 no-underline group rounded-2xl border border-border/70 bg-background/80 px-3 py-3 shadow-sm transition-all hover:border-orange-200 hover:bg-orange-50/70">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-md shadow-orange-500/20 ring-1 ring-orange-200/60 shrink-0 transition-transform group-hover:scale-[1.02]">
            <i className="ki-filled ki-abstract-26 text-white text-base" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="pf-num text-[20px] leading-none text-foreground tracking-wide">ProForm</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Панель атлета и тренера</p>
          </div>
        </Link>

        <div className="flex flex-col items-start gap-2.5 rounded-2xl border border-border/60 bg-muted/20 px-3 py-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{
              backgroundColor: roleMeta.bg,
              borderColor: `${roleMeta.text}22`,
              color: roleMeta.text,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {roleMeta.label}
          </span>

          {user ? (
            <span className="block w-full pl-0.5 text-[11px] leading-4 text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount > 99 ? '99+' : unreadCount} новых` : 'Нет новых сообщений'}
            </span>
          ) : (
            <span className="block w-full pl-0.5 text-[11px] leading-4 text-muted-foreground">Гостевой режим</span>
          )}
        </div>
      </div>

      <div className="kt-sidebar-content flex grow py-3 overflow-hidden" id="sidebar_content">
        <div
          className="kt-scrollable-y-hover grow flex flex-col px-4"
          data-kt-scrollable="true"
          data-kt-scrollable-dependencies="#sidebar_header"
          data-kt-scrollable-height="auto"
          data-kt-scrollable-wrappers="#sidebar_content"
          id="sidebar_scrollable"
        >
          <div className="kt-menu flex flex-col gap-5 grow" data-kt-menu="true">
            {visibleSections.map(section => (
              <div key={section.title} className="space-y-2.5">
                <div className="px-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                    {section.title}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {section.items.map(item => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                    const isMessages = item.href === '/messages'
                    const showBadge = isMessages && unreadCount > 0

                    return (
                      <div key={`${item.href}-${item.label}`} className="kt-menu-item">
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={[
                            'kt-menu-link group flex min-h-[56px] items-center gap-3 rounded-2xl border-l-4 px-3 py-3 text-sm font-medium transition-all duration-150',
                            active
                              ? 'border-l-orange-500 border-y border-r border-y-orange-100 border-r-orange-100 bg-gradient-to-r from-orange-50 via-orange-50/70 to-white text-orange-700 shadow-sm'
                              : 'border-l-transparent border-y border-r border-y-transparent border-r-transparent text-foreground/75 hover:border-border hover:bg-muted/60 hover:text-foreground',
                          ].join(' ')}
                        >
                          <span
                            className={[
                              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors',
                              active
                                ? 'border-orange-200 bg-orange-100/80 text-orange-600'
                                : 'border-border/70 bg-muted/40 text-muted-foreground group-hover:border-border group-hover:bg-background group-hover:text-foreground',
                            ].join(' ')}
                          >
                            <i className={`ki-filled ${item.icon} text-[15px]`} />
                          </span>

                          <span className="kt-menu-title min-w-0 flex-1 text-[15px] leading-5 break-words">
                            {item.label}
                          </span>

                          {showBadge ? (
                            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white shadow-sm">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          ) : active ? (
                            <i className="ki-filled ki-right shrink-0 text-[12px] text-orange-400" />
                          ) : null}
                        </Link>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-t-border shrink-0">
        <div className="rounded-3xl border border-border/70 bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Аккаунт
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {user ? 'Сессия активна' : 'Гостевой доступ'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {user ? 'Выход завершит текущую сессию на этом устройстве.' : 'Войдите, чтобы увидеть персональную навигацию.'}
              </p>
            </div>

            <span
              className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              style={{
                backgroundColor: roleMeta.bg,
                borderColor: `${roleMeta.text}22`,
                color: roleMeta.text,
              }}
            >
              {roleMeta.label}
            </span>
          </div>

          <button
            onClick={signOut}
            disabled={signingOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border/80 bg-background px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  )
}
