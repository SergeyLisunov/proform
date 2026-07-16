/**
 * Plan streak service (P1 соц-ядро) — недельный стрик выполнения плана
 * тренера С МЕДИЦИНСКОЙ ЗАМОРОЗКОЙ.
 *
 * Уникальная механика Sporteo: ни одна платформа мира не может сделать
 * «стрик, который не заставляет тренироваться больным» — только та, что
 * знает мед-статус. Duolingo-механика (loss aversion) без anxiety-retention:
 *
 *   * неделя ЗАСЧИТАНА  — выполнено ≥70% назначенных тренировок недели;
 *   * неделя ЗАМОРОЖЕНА — в ней действовал допуск banned/light_only
 *     (по append-only журналу clearances) → не ломает и не наращивает;
 *   * неделя без назначений — не вина атлета → пропускается;
 *   * текущая (незавершённая) неделя показывается прогрессом и стрик
 *     не ломает.
 *
 * Считается на лету из данных, доступных атлету по RLS (свои prescribed
 * workouts + свой журнал clearances) — без новой таблицы.
 */
import { createClient } from '@/lib/supabase/client'

const LOOKBACK_WEEKS = 26
const COMPLETION_THRESHOLD = 0.7

export interface WeekCell {
  from:      string
  completed: number
  assigned:  number
  frozen:    boolean
  counted:   boolean
}

export interface PlanStreak {
  /** Серия засчитанных недель подряд (не считая текущую). */
  weeks: number
  /** Прогресс текущей недели. */
  thisWeek: { assigned: number; completed: number; frozen: boolean }
  /** Была ли хоть одна заморозка внутри серии (для бейджа). */
  hadFreeze: boolean
  /** Есть ли вообще prescribed-план (нет — виджет скрывается). */
  hasPlan: boolean
  /** Последние 8 недель для мини-полоски (новые справа). */
  cells: WeekCell[]
}

function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export async function getPlanStreak(athleteId: string): Promise<PlanStreak> {
  const sb = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any

  const todayISO = new Date().toISOString().slice(0, 10)
  const currentMonday = mondayOf(todayISO)
  const horizonFrom = addDays(currentMonday, -7 * LOOKBACK_WEEKS)

  const [{ data: prescribedRaw }, { data: clearancesRaw }] = await Promise.all([
    sbAny.from('workouts')
      .select('event_date, completion_status')
      .eq('athlete_id', athleteId)
      .eq('event_type', 'prescribed')
      .gte('event_date', horizonFrom)
      .lte('event_date', addDays(currentMonday, 6)),
    sbAny.from('clearances')
      .select('status, valid_until, created_at')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: true }),
  ])

  const prescribed = (prescribedRaw ?? []) as Array<{
    event_date: string; completion_status: string | null
  }>
  const journal = (clearancesRaw ?? []) as Array<{
    status: string; valid_until: string | null; created_at: string
  }>

  // Агрегация назначений по понедельникам недель.
  const byWeek = new Map<string, { assigned: number; completed: number }>()
  for (const w of prescribed) {
    const mon = mondayOf(w.event_date)
    const cell = byWeek.get(mon) ?? { assigned: 0, completed: 0 }
    cell.assigned += 1
    if (w.completion_status === 'completed') cell.completed += 1
    byWeek.set(mon, cell)
  }
  const hasPlan = prescribed.length > 0

  // Заморозка недели. Журнал clearances append-only, поэтому эффективный
  // статус недели = ПОСЛЕДНЯЯ запись, созданная до её конца (старый banned,
  // перекрытый более новым ok, замораживать не должен — иначе стрик такого
  // атлета навсегда «заморожен» и не растёт). Неделя заморожена, если этот
  // эффективный статус ограничивающий и не истёк до начала недели.
  function isFrozen(monISO: string): boolean {
    const weekStart = monISO
    const weekEnd = addDays(monISO, 6)
    let effective: { status: string; valid_until: string | null } | null = null
    for (const c of journal) {
      if (c.created_at.slice(0, 10) <= weekEnd) effective = c
      else break
    }
    if (!effective) return false
    if (effective.status !== 'banned' && effective.status !== 'light_only') return false
    return effective.valid_until == null || effective.valid_until.slice(0, 10) >= weekStart
  }

  // Идём назад от прошлой завершённой недели.
  let weeks = 0
  let hadFreeze = false
  for (let i = 1; i <= LOOKBACK_WEEKS; i++) {
    const mon = addDays(currentMonday, -7 * i)
    const cell = byWeek.get(mon)
    if (isFrozen(mon)) { hadFreeze = true; continue }        // заморожена — пропуск
    if (!cell || cell.assigned === 0) continue               // тренер не назначил — не вина атлета
    if (cell.completed / cell.assigned >= COMPLETION_THRESHOLD) { weeks += 1; continue }
    break                                                    // невыполненная неделя — серия прервана
  }

  const cur = byWeek.get(currentMonday) ?? { assigned: 0, completed: 0 }
  const cells: WeekCell[] = []
  for (let i = 7; i >= 0; i--) {
    const mon = addDays(currentMonday, -7 * i)
    const c = byWeek.get(mon) ?? { assigned: 0, completed: 0 }
    const frozen = isFrozen(mon)
    cells.push({
      from: mon,
      assigned: c.assigned,
      completed: c.completed,
      frozen,
      counted: !frozen && c.assigned > 0 && c.completed / c.assigned >= COMPLETION_THRESHOLD,
    })
  }

  return {
    weeks,
    thisWeek: { assigned: cur.assigned, completed: cur.completed, frozen: isFrozen(currentMonday) },
    hadFreeze,
    hasPlan,
    cells,
  }
}
