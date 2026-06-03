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
    label: 'Запись',
    hint: 'Новая консультация',
    bg: '#FEF2F2', color: '#DC2626', border: '#FECACA',
  },
  {
    href: '/calendar',
    icon: 'ki-calendar-tick',
    label: 'Расписание',
    hint: 'Назначить приём',
    bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0',
  },
  {
    href: '/injuries',
    icon: 'ki-shield-cross',
    label: 'Травмы',
    hint: 'Журнал команды',
    bg: '#FEF0E7', color: '#D44A02', border: '#FBC1A0',
  },
  {
    href: '/network?tab=find',
    icon: 'ki-magnifier',
    label: 'Поиск',
    hint: 'Найти пациента',
    bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE',
  },
  {
    href: '/diary',
    icon: 'ki-document',
    label: 'Дневник',
    hint: 'Все записи',
    bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF',
  },
]

/**
 * Лента крупных action-кнопок врача. Самые частые сценарии в один клик:
 * новая запись, плановый приём, журнал травм, поиск пациента, мед-дневник.
 */
export default function DoctorQuickActions() {
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
