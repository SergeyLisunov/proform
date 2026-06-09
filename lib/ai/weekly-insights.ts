/**
 * AI weekly/monthly training insights.
 * Combines raw metrics (computed in SQL/code) with Claude-generated narrative
 * so we don't pay the model to do arithmetic.
 */
import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { AI_MODEL_SMART, isAiConfigured } from './claude'

export type PeriodKind = 'week' | 'month'

export type WorkoutRow = {
  event_date: string
  activity_type: string | null
  activity_duration_min: number | null
  activity_strain: number | string | null
  avg_heart_rate: number | string | null
  max_heart_rate: number | string | null
  recovery_score: number | string | null
  hrv: number | string | null
  mood: number | null
  name: string | null
  description: string | null
  risk_flag?: string | null
}

export type NoteRow = { note_date: string; title: string | null; content: string }

export type PeriodMetrics = {
  sessions: number
  total_minutes: number
  avg_strain: number | null
  max_strain: number | null
  avg_hr: number | null
  avg_recovery: number | null
  avg_hrv: number | null
  avg_mood: number | null
  days_active: number
  longest_session_min: number | null
  types_breakdown: { type: string; sessions: number; minutes: number }[]
  risk_sessions: number
}

function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const x = typeof v === 'string' ? parseFloat(v) : (v as number)
  return Number.isFinite(x) ? x : null
}

export function computeMetrics(workouts: WorkoutRow[]): PeriodMetrics {
  const sessions = workouts.length
  const minutes = workouts.reduce((a, w) => a + (w.activity_duration_min ?? 0), 0)

  const strains = workouts.map(w => n(w.activity_strain)).filter((x): x is number => x !== null)
  const hrs     = workouts.map(w => n(w.avg_heart_rate)).filter((x): x is number => x !== null)
  const recs    = workouts.map(w => n(w.recovery_score)).filter((x): x is number => x !== null)
  const hrvs    = workouts.map(w => n(w.hrv)).filter((x): x is number => x !== null)
  const moods   = workouts.map(w => w.mood).filter((x): x is number => typeof x === 'number')

  const typeMap = new Map<string, { sessions: number; minutes: number }>()
  for (const w of workouts) {
    const k = w.activity_type || 'other'
    const cur = typeMap.get(k) ?? { sessions: 0, minutes: 0 }
    cur.sessions += 1
    cur.minutes  += w.activity_duration_min ?? 0
    typeMap.set(k, cur)
  }
  const types_breakdown = Array.from(typeMap.entries())
    .map(([type, v]) => ({ type, sessions: v.sessions, minutes: v.minutes }))
    .sort((a, b) => b.minutes - a.minutes)

  const dayset = new Set(workouts.map(w => w.event_date))
  const longest = workouts.reduce<number | null>((m, w) => {
    const d = w.activity_duration_min ?? null
    if (d === null) return m
    return m === null || d > m ? d : m
  }, null)

  const avg = (xs: number[]) => xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null
  const maxOf = (xs: number[]) => xs.length ? Math.max(...xs) : null

  return {
    sessions,
    total_minutes: minutes,
    avg_strain: avg(strains),
    max_strain: maxOf(strains),
    avg_hr: avg(hrs),
    avg_recovery: avg(recs),
    avg_hrv: avg(hrvs),
    avg_mood: avg(moods),
    days_active: dayset.size,
    longest_session_min: longest,
    types_breakdown,
    risk_sessions: workouts.filter(w => w.risk_flag && w.risk_flag !== 'ok' && w.risk_flag !== 'none').length,
  }
}

export const InsightSchema = z.object({
  title: z.string().describe('Короткий заголовок на русском'),
  summary: z.string().describe('2–3 предложения: общая картина периода'),
  overall_score: z.number().min(0).max(10),
  highlights: z.array(z.string()).max(5).describe('Яркие факты / достижения'),
  trends: z.array(z.object({
    label: z.string(),
    direction: z.enum(['up', 'down', 'flat']),
    note: z.string(),
  })).max(5),
  risks: z.array(z.object({
    title: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    note: z.string(),
  })).max(5),
  recommendations: z.array(z.string()).max(6),
})

export type Insight = z.infer<typeof InsightSchema>

export async function generateInsight(input: {
  periodKind: PeriodKind
  periodStart: string
  periodEnd: string
  metrics: PeriodMetrics
  prevMetrics?: PeriodMetrics | null
  workouts: WorkoutRow[]
  notes: NoteRow[]
  sport?: string | null
}): Promise<Insight> {
  if (!isAiConfigured()) throw new Error('AI_NOT_CONFIGURED')

  const periodLabel = input.periodKind === 'week' ? 'неделю' : 'месяц'
  const workoutsLine = input.workouts.slice(0, 40).map(w => {
    const bits = [
      w.event_date,
      w.activity_type ?? 'workout',
      w.activity_duration_min ? `${w.activity_duration_min}мин` : null,
      w.activity_strain ? `strain ${w.activity_strain}` : null,
      w.avg_heart_rate ? `чсс ${w.avg_heart_rate}` : null,
      w.recovery_score ? `recovery ${w.recovery_score}` : null,
      w.hrv ? `hrv ${w.hrv}` : null,
      w.mood ? `mood ${w.mood}/5` : null,
      w.risk_flag && w.risk_flag !== 'none' ? `risk:${w.risk_flag}` : null,
    ].filter(Boolean)
    return '- ' + bits.join(', ') + (w.name ? ` — ${w.name}` : '')
  }).join('\n')

  const notesLine = input.notes.slice(0, 12).map(nt => {
    const t = (nt.title ?? '').trim() || nt.content.slice(0, 80)
    return `- ${nt.note_date}: ${t.slice(0, 160)}`
  }).join('\n')

  const system =
`Ты — опытный тренер и спортивный аналитик. На основе метрик, тренировок и заметок атлета
за указанный период выдавай структурированный разбор на русском. Будь конкретен, опирайся на цифры.
Если данных мало — скажи прямо. Не выдумывай числа, которые не приведены.`

  const user =
`Период: ${periodLabel} ${input.periodStart} — ${input.periodEnd}.
Метрики: ${JSON.stringify(input.metrics)}
${input.prevMetrics ? `Предыдущий период: ${JSON.stringify(input.prevMetrics)}` : ''}
${input.sport ? `Вид спорта атлета: ${input.sport}` : ''}

Тренировки (${input.workouts.length}):
${workoutsLine || '- нет тренировок за период'}

Заметки (${input.notes.length}):
${notesLine || '- нет заметок'}

Сформируй JSON по схеме: заголовок, summary, overall_score 0..10,
highlights, trends (up/down/flat по метрикам), risks (low/medium/high),
recommendations.`

  const { object } = await generateObject({
    model: anthropic(AI_MODEL_SMART),
    schema: InsightSchema,
    system,
    prompt: user,
    maxOutputTokens: 1200,
  })
  return object
}

export function periodRange(kind: PeriodKind, ref: Date = new Date()): { start: string; end: string } {
  const d = new Date(ref); d.setHours(0, 0, 0, 0)
  if (kind === 'week') {
    const dow = (d.getDay() + 6) % 7 // Monday = 0
    const start = new Date(d); start.setDate(d.getDate() - dow)
    const end   = new Date(start); end.setDate(start.getDate() + 6)
    return { start: iso(start), end: iso(end) }
  }
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { start: iso(start), end: iso(end) }
}

export function prevRange(kind: PeriodKind, start: string): { start: string; end: string } {
  const s = new Date(start + 'T00:00:00')
  if (kind === 'week') {
    const prevEnd   = new Date(s); prevEnd.setDate(s.getDate() - 1)
    const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - 6)
    return { start: iso(prevStart), end: iso(prevEnd) }
  }
  const prevStart = new Date(s.getFullYear(), s.getMonth() - 1, 1)
  const prevEnd   = new Date(s.getFullYear(), s.getMonth(), 0)
  return { start: iso(prevStart), end: iso(prevEnd) }
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
