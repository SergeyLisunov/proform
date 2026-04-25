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
    href: '/diary',
    icon: 'ki-plus-squared',
    label: 'Тренировка',
    hint: 'Записать сессию',
    bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA',
  },
  {
    href: '/calendar',
    icon: 'ki-calendar',
    label: 'Календарь',
    hint: 'Расписание недели',
    bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE',
  },
  {
    href: '/competitions',
    icon: 'ki-medal-star',
    label: 'Соревнования',
    hint: 'Старты и подготовка',
    bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF',
  },
  {
    href: '/injuries',
    icon: 'ki-shield-cross',
    label: 'Травмы',
    hint: 'Журнал и реабилитация',
    bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA',
  },
  {
    href: '/tools/acwr',
    icon: 'ki-chart-line-up',
    label: 'ACWR',
    hint: 'Риск травмы',
    bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0',
  },
]

/**
 * Лента крупных action-кнопок под hero-баром. Самые частые сценарии
 * атлета в один клик: запись тренировки, календарь, соревнования,
 * лог травмы, проверка ACWR.
 */
export default function AthleteQuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {ACTIONS.map(a => (
        <Link key={a.href} href={a.href}
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
