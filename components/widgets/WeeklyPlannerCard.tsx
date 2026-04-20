'use client'
import { useState } from 'react'

type Day = {
  day_offset: number
  weekday: string
  activity: string
  headline: string
  duration_min: number
  intensity: 'rest' | 'easy' | 'moderate' | 'hard' | 'peak'
  rationale: string
}

type Plan = {
  overview: string
  total_min: number
  days: Day[]
  warnings: string[]
}

const ACT_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'Бег':       { bg: '#EFF6FF', color: '#2563EB', icon: 'ki-abstract-26' },
  'Велоспорт': { bg: '#FFF7ED', color: '#EA580C', icon: 'ki-technology-4' },
  'Плавание':  { bg: '#E0F2FE', color: '#0284C7', icon: 'ki-abstract-14' },
  'Силовые':   { bg: '#FAF5FF', color: '#9333EA', icon: 'ki-abstract-45' },
  'Ходьба':    { bg: '#F0FDF4', color: '#16A34A', icon: 'ki-map' },
  'Отдых':     { bg: '#F1F5F9', color: '#64748B', icon: 'ki-moon' },
  'Другое':    { bg: '#F8FAFC', color: '#64748B', icon: 'ki-calendar' },
}

const INTENSITY_DOT: Record<Day['intensity'], string> = {
  rest: '#94A3B8', easy: '#60A5FA', moderate: '#F59E0B', hard: '#EF4444', peak: '#A855F7',
}

function fireWorkoutsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('proform:workout-added'))
  }
}

export default function WeeklyPlannerCard() {
  const [plan, setPlan]         = useState<Plan | null>(null)
  const [loading, setLoading]   = useState(false)
  const [goal, setGoal]         = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [applied, setApplied]   = useState(false)
  const [applying, setApplying] = useState(false)

  async function generate() {
    setLoading(true); setError(null); setApplied(false)
    try {
      const res = await fetch('/api/ai/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goal.trim() || undefined }),
      })
      if (res.status === 503) { setDisabled(true); return }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'AI_ERROR')
      setPlan(json.data as Plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI_ERROR')
    } finally {
      setLoading(false)
    }
  }

  async function accept() {
    if (!plan) return
    setApplying(true)
    try {
      const res = await fetch('/api/ai/weekly-plan/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: plan.days.map(d => ({
            day_offset: d.day_offset,
            activity: d.activity,
            headline: d.headline,
            duration_min: d.duration_min,
            intensity: d.intensity,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'APPLY_ERROR')
      setApplied(true)
      fireWorkoutsChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'APPLY_ERROR')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="rounded-[20px] border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#F3E8FF' }}>
            <i className="ki-filled ki-calendar-tick text-[14px] text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">План на неделю</h3>
            <div className="text-[10px] text-muted-foreground mt-0.5">AI составит 7 дней</div>
          </div>
        </div>
        {plan && !applied && (
          <button
            onClick={accept}
            disabled={applying}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-2xs font-bold text-white hover:bg-orange-600 transition disabled:opacity-60"
          >
            {applying ? 'Добавляю…' : 'Принять в календарь'}
          </button>
        )}
        {applied && (
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-2xs font-bold text-emerald-700 border border-emerald-200">
            ✓ В календаре
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {disabled ? (
          <p className="text-xs text-muted-foreground">Планировщик отключён. Добавьте <code className="rounded bg-accent px-1">ANTHROPIC_API_KEY</code>.</p>
        ) : (
          <>
            {!plan && (
              <>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Цель на неделю (необязательно)
                  </label>
                  <input
                    type="text"
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="напр. подготовка к полумарафону, восстановление, базовый объём"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-orange-400"
                  />
                </div>
                <button
                  onClick={generate}
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-60"
                >
                  {loading ? 'Генерирую план…' : '✨ Сгенерировать план'}
                </button>
              </>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            {plan && (
              <>
                <div className="rounded-xl border border-border bg-accent/40 p-3">
                  <p className="text-xs text-foreground leading-relaxed">{plan.overview}</p>
                  <div className="mt-2 text-2xs text-muted-foreground">
                    Объём: <span className="pf-num font-bold text-foreground">{plan.total_min} мин</span>
                  </div>
                </div>

                {plan.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">Внимание</div>
                    <ul className="space-y-0.5">
                      {plan.warnings.map((w, i) => (
                        <li key={i} className="flex gap-1.5 text-xs text-amber-900">
                          <i className="ki-filled ki-information-2 mt-[2px] text-[10px]" />
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5">
                  {plan.days.map(d => {
                    const s = ACT_STYLE[d.activity] ?? ACT_STYLE['Другое']
                    return (
                      <div key={d.day_offset} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                        <div className="w-10 shrink-0 text-center">
                          <div className="text-2xs font-bold uppercase text-muted-foreground">{d.weekday}</div>
                        </div>
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: s.bg, color: s.color }}
                        >
                          <i className={`ki-filled ${s.icon} text-[12px]`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ background: INTENSITY_DOT[d.intensity] }}
                            />
                            <span className="truncate text-sm font-semibold text-foreground">{d.headline}</span>
                          </div>
                          <div className="truncate text-2xs text-muted-foreground">{d.rationale}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-2xs font-bold text-foreground pf-num">{d.duration_min > 0 ? `${d.duration_min} мин` : '—'}</div>
                          <div className="text-2xs text-muted-foreground">{d.activity}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { setPlan(null); setApplied(false) }}
                    className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent transition"
                  >
                    Перегенерировать
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
