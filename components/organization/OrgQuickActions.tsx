'use client'

import Link from 'next/link'

interface QuickAction {
  href: string
  icon: string
  label: string
  hint: string
  bg: string
  color: string
  border: string
}

const ACTIONS: QuickAction[] = [
  {
    href: '/calendar',
    icon: 'ki-calendar-tick',
    label: 'Событие',
    hint: 'Командная тренировка',
    bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE',
  },
  {
    href: '/org/wall',
    icon: 'ki-abstract-45',
    label: 'Пост',
    hint: 'Новость на стене',
    bg: '#FFF7ED', color: '#F35703', border: '#FED7AA',
  },
  {
    href: '/org/newsletters',
    icon: 'ki-sms',
    label: 'Рассылка',
    hint: 'Email команде',
    bg: '#FAF5FF', color: '#9333EA', border: '#E9D5FF',
  },
  {
    href: '/org/members',
    icon: 'ki-people',
    label: 'Участники',
    hint: 'Состав и приглашения',
    bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0',
  },
  {
    href: '/competitions',
    icon: 'ki-medal-star',
    label: 'Старты',
    hint: 'Календарь соревнований',
    bg: '#FEF2F2', color: '#DC2626', border: '#FECACA',
  },
]

export default function OrgQuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {ACTIONS.map(a => (
        <Link key={a.label} href={a.href}
          className="group rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm flex items-center gap-3"
          style={{ borderColor: a.border }}>
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: a.bg, color: a.color }}>
            <i className={`ki-filled ${a.icon} text-lg`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-foreground truncate">{a.label}</div>
            <div className="text-[11px] text-muted-foreground truncate">{a.hint}</div>
          </div>
          <i className="ki-filled ki-arrow-right text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </Link>
      ))}
    </div>
  )
}
