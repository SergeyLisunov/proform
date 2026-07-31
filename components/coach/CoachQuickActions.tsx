'use client'

import Link from 'next/link'
import { useState } from 'react'
import dynamic from 'next/dynamic'

const PrescribeWorkoutDrawer = dynamic(
  () => import('@/components/ui/PrescribeWorkoutDrawer').then(m => m.PrescribeWorkoutDrawer),
  { ssr: false },
)

interface QuickAction {
  href?: string
  onClick?: () => void
  icon: string
  label: string
  hint: string
  bg: string
  color: string
  border: string
}

interface CoachQuickActionsProps {
  coachId: string
  athletes: Array<{ id: string; name: string }>
}

/**
 * Лента крупных action-кнопок тренера. Открывает drawer назначения
 * тренировки прямо отсюда (без перехода) + ссылки на остальные
 * частые сценарии.
 */
export default function CoachQuickActions({ coachId, athletes }: CoachQuickActionsProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Назначать некому — у тренера ещё нет принятых спортсменов. Drawer в этом
  // случае не рендерится (условие ниже), поэтому кнопка, открывающая его,
  // была бы кнопкой-обманкой: нажатие без единого видимого следствия. Вместо
  // этого ведём туда, где связь заводится.
  const hasAthletes = athletes.length > 0

  const actions: QuickAction[] = [
    hasAthletes
      ? {
          onClick: () => setDrawerOpen(true),
          icon: 'ki-plus-squared',
          label: 'Назначить',
          hint: 'Тренировка атлету',
          bg: '#FEF0E7', color: '#D44A02', border: '#FBC1A0',
        }
      : {
          href: '/athletes',
          icon: 'ki-plus-squared',
          label: 'Добавить атлета',
          hint: 'Нет подопечных',
          bg: '#FEF0E7', color: '#D44A02', border: '#FBC1A0',
        },
    {
      href: '/diary',
      icon: 'ki-notepad-edit',
      label: 'Дневник',
      hint: 'Новая запись',
      bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE',
    },
    {
      href: '/calendar',
      icon: 'ki-calendar',
      label: 'Календарь',
      hint: 'Расписание',
      bg: '#FAF5FF', color: '#7C3AED', border: '#E9D5FF',
    },
    {
      href: '/athletes/load',
      icon: 'ki-shield-cross',
      label: 'ACWR',
      hint: 'Риск травмы команды',
      bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA',
    },
    {
      href: '/competitions',
      icon: 'ki-medal-star',
      label: 'Соревнования',
      hint: 'График стартов',
      bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0',
    },
    {
      href: '/coach/passes',
      icon: 'ki-minus-squared',
      label: 'Списать сессию',
      hint: 'Абонементы атлетов',
      bg: '#FEF0E7', color: '#B03D04', border: '#FBC1A0',
    },
  ]

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {actions.map(a => {
          const inner = (
            <>
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: a.bg, color: a.color }}>
                <i className={`ki-filled ${a.icon} text-lg`} />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-bold text-foreground truncate">{a.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{a.hint}</div>
              </div>
              <i className="ki-filled ki-arrow-right text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </>
          )
          const cn = 'group rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm flex items-center gap-3 w-full'
          return a.href ? (
            <Link key={a.label} href={a.href} className={cn} style={{ borderColor: a.border }}>
              {inner}
            </Link>
          ) : (
            <button key={a.label} onClick={a.onClick} className={cn} style={{ borderColor: a.border }}>
              {inner}
            </button>
          )
        })}
      </div>

      {drawerOpen && athletes.length > 0 && (
        <PrescribeWorkoutDrawer
          coachId={coachId}
          athletes={athletes}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => setDrawerOpen(false)}
        />
      )}
    </>
  )
}
