'use client'

import {
  CONFLICT_KIND_LABEL,
  formatConflictTime,
  type Conflict,
} from '@/services/calendar-conflicts.service'

type Color = 'orange' | 'red' | 'purple'

const COLOR_CLASSES: Record<Color, { border: string; bg: string; text: string; badge: string; btn: string }> = {
  orange: {
    border: 'border-orange-300',
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    badge: 'bg-orange-100 text-orange-700',
    btn: 'bg-orange-500 hover:bg-orange-600',
  },
  red: {
    border: 'border-red-300',
    bg: 'bg-red-50',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    btn: 'bg-red-500 hover:bg-red-600',
  },
  purple: {
    border: 'border-purple-300',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    badge: 'bg-purple-100 text-purple-700',
    btn: 'bg-purple-500 hover:bg-purple-600',
  },
}

/** Compact inline banner listing conflicts for a single athlete. */
export function ConflictWarning({
  conflicts,
  color = 'orange',
  title = 'Обнаружены пересечения в календаре',
}: {
  conflicts: Conflict[]
  color?: Color
  title?: string
}) {
  if (conflicts.length === 0) return null
  const c = COLOR_CLASSES[color]

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
      <div className={`flex items-center gap-2 ${c.text} text-xs font-semibold mb-2`}>
        <i className="ki-filled ki-information-2 text-sm" />
        <span>{title} ({conflicts.length})</span>
      </div>
      <ul className="space-y-1.5">
        {conflicts.map(ev => (
          <li key={`${ev.kind}:${ev.id}`} className="flex items-center gap-2 text-[11px]">
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${c.badge}`}>
              {CONFLICT_KIND_LABEL[ev.kind]}
            </span>
            <span className="font-medium text-foreground truncate">{ev.title}</span>
            <span className="text-muted-foreground ml-auto shrink-0">{formatConflictTime(ev)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Per-athlete conflict list, used when a group session has multiple participants. */
export function GroupConflictWarning({
  items,
  color = 'purple',
}: {
  items: Array<{ athleteId: string; athleteName: string; conflicts: Conflict[] }>
  color?: Color
}) {
  const affected = items.filter(i => i.conflicts.length > 0)
  if (affected.length === 0) return null
  const c = COLOR_CLASSES[color]

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-3`}>
      <div className={`flex items-center gap-2 ${c.text} text-xs font-semibold mb-2`}>
        <i className="ki-filled ki-information-2 text-sm" />
        <span>Пересечения у {affected.length} участник(ов)</span>
      </div>
      <ul className="space-y-2">
        {affected.map(a => (
          <li key={a.athleteId} className="rounded-lg bg-background border border-border p-2">
            <div className="text-[11px] font-semibold text-foreground mb-1">{a.athleteName}</div>
            <ul className="space-y-1">
              {a.conflicts.map(ev => (
                <li key={`${ev.kind}:${ev.id}`} className="flex items-center gap-2 text-[11px]">
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${c.badge}`}>
                    {CONFLICT_KIND_LABEL[ev.kind]}
                  </span>
                  <span className="text-foreground truncate">{ev.title}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">{formatConflictTime(ev)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
