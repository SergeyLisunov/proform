'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'

const TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':          { title: 'Главная',              sub: 'Обзор ваших тренировок' },
  '/calendar':           { title: 'Календарь',            sub: 'График и события' },
  '/diary':              { title: 'Дневник тренировок',   sub: 'Сессии и наблюдения' },
  '/analytics':          { title: 'Аналитика',            sub: 'Анализ показателей' },
  '/athletes':           { title: 'Мои атлеты',           sub: 'Панель тренера' },
  '/admin/orgs':         { title: 'Организации',          sub: 'Управление организациями' },
  '/admin':              { title: 'Панель администратора', sub: 'Системное администрирование' },
  '/org/members':        { title: 'Участники',            sub: 'Управление участниками' },
  '/org/wall':           { title: 'Стена',                sub: 'Посты и объявления' },
  '/org/newsletters':    { title: 'Рассылки',             sub: 'Рассылка участникам' },
  '/org':                { title: 'Организация',          sub: 'Дашборд организации' },
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  athlete:      { bg: '#FFF7ED', text: '#F97316', border: '#FED7AA' },
  coach:        { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  admin:        { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  organization: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
}

export default function TopBar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const meta = Object.entries(TITLES).find(([k]) => pathname === k || pathname.startsWith(k + '/'))?.[1]
  const title = meta?.title ?? 'ProForm'
  const sub = meta?.sub ?? ''
  const date = new Date().toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const rc = user ? ROLE_COLORS[user.role] : null

  return (
    <header
      id="header"
      className={[
        'kt-header fixed top-0 z-10 start-0 end-0 flex items-stretch shrink-0 transition-all duration-200',
        scrolled
          ? 'bg-card border-b border-b-border shadow-sm'
          : 'bg-card/80 backdrop-blur-md border-b border-b-transparent',
      ].join(' ')}
    >
      <div className="kt-container-fixed flex justify-between items-center px-5 lg:px-8 gap-4 w-full" id="headerContainer">

        {/* Left */}
        <div className="flex items-center gap-3">
          <button className="kt-btn kt-btn-icon kt-btn-ghost lg:hidden" data-kt-drawer-toggle="#sidebar">
            <i className="ki-filled ki-burger-menu-2 text-base" />
          </button>
          <div>
            <h1 className="pf-num text-xl text-foreground leading-none">{title}</h1>
            {sub && <p className="text-2xs text-muted-foreground mt-0.5 hidden sm:block">{sub}</p>}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Date */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border">
            <i className="ki-filled ki-calendar text-xs text-muted-foreground" />
            <span className="text-2xs text-muted-foreground">{date}</span>
          </div>

          {/* WHOOP live */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-2xs font-bold uppercase tracking-wide"
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
          {user && rc && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full border cursor-default" style={{ background: rc.bg, borderColor: rc.border }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: rc.text + '20', color: rc.text, fontFamily: "'Bebas Neue', sans-serif" }}>
                {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-2sm font-semibold" style={{ color: rc.text }}>{user.name.split(' ')[0]}</span>
              <span className="text-2xs uppercase font-bold opacity-60" style={{ color: rc.text }}>{user.role}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
