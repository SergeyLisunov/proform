'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import type { UserRole } from '@/types/database'

const NAV = [
  { href: '/dashboard', icon: 'ki-element-11',   label: 'Главная',           roles: null },
  { href: '/calendar',  icon: 'ki-calendar',      label: 'Календарь',         roles: ['athlete', 'coach', 'admin'] as string[] },
  { href: '/diary',     icon: 'ki-book-open',     label: 'Дневник тренировок', roles: ['athlete', 'admin'] as string[] },
  { href: '/diary',     icon: 'ki-notepad-edit',  label: 'Дневник наблюдений', roles: ['coach'] as string[] },
  { href: '/analytics', icon: 'ki-chart-line-up', label: 'Аналитика',         roles: ['athlete', 'coach', 'admin'] as string[] },
  { href: '/athletes',  icon: 'ki-people',        label: 'Мои атлеты',        roles: ['coach', 'admin'] as string[] },
  { href: '/org',       icon: 'ki-office-bag',    label: 'Организация',       roles: ['organization'] as string[] },
  { href: '/admin',     icon: 'ki-setting-2',     label: 'Администратор',     roles: ['admin'] as string[] },
]

const ROLES: { value: UserRole; label: string; icon: string; bg: string; text: string; border: string }[] = [
  { value: 'athlete',      label: 'Атлет',         icon: 'ki-abstract-26',  bg: '#FFF7ED', text: '#F97316', border: '#FED7AA' },
  { value: 'coach',        label: 'Тренер',        icon: 'ki-notepad-edit', bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  { value: 'admin',        label: 'Администратор', icon: 'ki-setting-2',    bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  { value: 'organization', label: 'Организация',   icon: 'ki-office-bag',   bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, switching, switchRole } = useUser()
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

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
      router.push('/auth/login')
    } catch (err) {
      console.error('signOut error:', err)
      setSigningOut(false)
    }
  }

  const currentRole = ROLES.find(r => r.value === user?.role)
  const initials = user ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : ''

  return (
    <>
      <div
        id="sidebar"
        className="kt-sidebar bg-card border-e border-e-border fixed top-0 bottom-0 z-20 hidden lg:flex flex-col items-stretch shrink-0"
        data-kt-drawer="true"
        data-kt-drawer-class="kt-drawer kt-drawer-start top-0 bottom-0"
      >
        {/* Logo */}
        <div className="kt-sidebar-header hidden lg:flex items-center justify-between px-5 shrink-0" id="sidebar_header">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 group-hover:bg-orange-600 transition-colors">
              <i className="ki-filled ki-abstract-26 text-white text-sm" />
            </div>
            <span className="pf-num text-[20px] text-foreground tracking-wide">ProForm</span>
          </Link>
          <button
            id="sidebar_toggle"
            className="kt-btn kt-btn-sm kt-btn-icon kt-btn-outline size-[30px]"
            data-kt-toggle="body"
            data-kt-toggle-class="kt-sidebar-collapse"
          >
            <i className="ki-filled ki-black-left-line text-xs kt-toggle-active:rotate-180 transition-all duration-300" />
          </button>
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

              {/* Current role badge */}
              {currentRole && (
                <div className="mx-1 mb-3 px-3 py-2 rounded-xl border flex items-center gap-2" style={{ background: currentRole.bg, borderColor: currentRole.border }}>
                  <i className={`ki-filled ${currentRole.icon} text-sm`} style={{ color: currentRole.text }} />
                  <div>
                    <div className="text-2xs font-bold uppercase tracking-widest" style={{ color: currentRole.text }}>Просмотр как</div>
                    <div className="text-2sm font-semibold" style={{ color: currentRole.text }}>{currentRole.label}</div>
                  </div>
                  <button
                    onClick={() => setShowRolePicker(true)}
                    className="ml-auto px-2 py-1 rounded-lg text-2xs font-semibold transition-all hover:opacity-80 border"
                    style={{ background: currentRole.text + '15', color: currentRole.text, borderColor: currentRole.border }}
                    title="Переключить роль"
                  >
                    Переключить
                  </button>
                </div>
              )}

              <div className="px-2 pb-2">
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">Навигация</span>
              </div>

              {visible.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
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
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                    </Link>
                  </div>
                )
              })}

              <div className="grow" />

              {/* WHOOP badge */}
              <div className="mx-1 mb-1 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                  <div>
                    <div className="text-2xs font-bold text-green-700 uppercase tracking-wide leading-none">WHOOP Live</div>
                    <div className="text-2xs text-green-600 mt-0.5">100,000 records synced</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-t-border shrink-0">
          {user && currentRole && (
            <div className="flex flex-col gap-2">
              {/* User info */}
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num"
                  style={{ background: currentRole.bg, color: currentRole.text }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate leading-tight">{user.name}</div>
                  <div className="text-2xs text-muted-foreground font-mono truncate">{user.email}</div>
                </div>
              </div>

              {/* Logout button — always visible */}
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
          )}
        </div>
      </div>

      {/* Role Picker Modal */}
      {showRolePicker && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowRolePicker(false) }}
        >
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="pf-num text-xl text-foreground">Переключить роль</h3>
                <p className="text-2xs text-muted-foreground mt-0.5">Выберите роль для просмотра приложения с этой точки зрения</p>
              </div>
              <button onClick={() => setShowRolePicker(false)} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
                <i className="ki-filled ki-cross text-sm" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {ROLES.map(role => {
                const isActive = user?.role === role.value
                return (
                  <button
                    key={role.value}
                    onClick={async () => {
                      if (!isActive) {
                        setShowRolePicker(false)
                        await switchRole(role.value)
                      }
                    }}
                    disabled={isActive || switching}
                    className={[
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left',
                      isActive ? 'cursor-default' : 'cursor-pointer hover:shadow-sm',
                    ].join(' ')}
                    style={{ background: isActive ? role.bg : '#FAFAFA', borderColor: isActive ? role.border : '#E4E4E7' }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: role.bg, border: `1px solid ${role.border}` }}>
                      <i className={`ki-filled ${role.icon} text-base`} style={{ color: role.text }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{role.label}</div>
                      <div className="text-2xs text-muted-foreground">
                        {role.value === 'athlete'      && 'Дневник тренировок, метрики, календарь'}
                        {role.value === 'coach'        && 'Тренировки атлетов, дневник, анализ'}
                        {role.value === 'admin'        && 'Системное администрирование, пользователи'}
                        {role.value === 'organization' && 'Дашборд организации, стена, рассылки'}
                      </div>
                    </div>
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-2xs font-bold" style={{ background: role.text + '18', color: role.text }}>
                        Активна
                      </span>
                    ) : (
                      <i className="ki-filled ki-right text-muted-foreground/40 text-xs" />
                    )}
                  </button>
                )
              })}
            </div>

            {switching && (
              <div className="flex items-center justify-center gap-2 mt-4 py-2">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
                <span className="text-2sm text-muted-foreground">Переключение роли…</span>
              </div>
            )}

            <p className="text-2xs text-muted-foreground/60 text-center mt-4">
              Изменение роли вступает в силу немедленно
            </p>
          </div>
        </div>
      )}
    </>
  )
}
