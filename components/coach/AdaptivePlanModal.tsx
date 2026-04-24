'use client'

import { useCallback, useEffect, useState } from 'react'

interface Suggestion {
  workout_id: string
  current_summary: string
  proposed_action: 'reduce_volume'|'lower_intensity'|'make_recovery'|'reschedule'|'delete'|'keep'
  new_duration_min: number | null
  new_description: string | null
  rationale: string
}
interface PlanData {
  reason: 'acwr_danger'|'acwr_monitor'|'skip_streak'|'low_recovery'|'ok'
  overview: string
  suggestions: Suggestion[]
  team_focus_next_week: string
}
interface Context {
  acwr: number | null
  zone: string | null
  skipStreak: number
  avgRecovery: number | null
}

const REASON_LABEL: Record<PlanData['reason'], string> = {
  acwr_danger:  'ACWR в красной зоне',
  acwr_monitor: 'ACWR растёт слишком быстро',
  skip_streak:  'Атлет пропускает тренировки подряд',
  low_recovery: 'Низкое восстановление последних дней',
  ok:           'План сбалансирован',
}

const ACTION_LABEL: Record<Suggestion['proposed_action'], { label: string; color: string; bg: string; border: string }> = {
  reduce_volume:   { label: 'Сократить объём',        color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  lower_intensity: { label: 'Снизить интенсивность',  color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  make_recovery:   { label: 'Восстановительная',      color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  reschedule:      { label: 'Перенести',              color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  delete:          { label: 'Отменить',               color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  keep:            { label: 'Оставить как есть',      color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
}

export default function AdaptivePlanModal({
  athleteId, athleteName, onClose, onApplied,
}: {
  athleteId: string
  athleteName: string
  onClose: () => void
  onApplied?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [err, setErr]         = useState<string | null>(null)
  const [data, setData]       = useState<PlanData | null>(null)
  const [ctx, setCtx]         = useState<Context | null>(null)
  const [picked, setPicked]   = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)
  const [result, setResult]     = useState<{ applied: number; skipped: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(`/api/ai/adaptive-plan/${athleteId}`)
      const json = await res.json()
      if (!json.ok) { setErr(json.error ?? 'AI_ERROR'); return }
      setData(json.data as PlanData)
      setCtx(json.context as Context)
      // По умолчанию отмечены все non-keep.
      const pre: Record<string, boolean> = {}
      for (const s of (json.data as PlanData).suggestions) {
        pre[s.workout_id] = s.proposed_action !== 'keep'
      }
      setPicked(pre)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }, [athleteId])
  useEffect(() => { load() }, [load])

  const apply = async () => {
    if (!data) return
    setApplying(true); setErr(null)
    const items = data.suggestions.filter(s => picked[s.workout_id])
    try {
      const res = await fetch('/api/ai/adaptive-plan/apply', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ athlete_id: athleteId, items }),
      })
      const json = await res.json()
      if (!json.ok) { setErr(json.error ?? 'APPLY_FAILED'); return }
      setResult({ applied: json.applied ?? 0, skipped: (json.skipped?.length ?? 0) })
      onApplied?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setApplying(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 py-10 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()}
        className="relative z-10 w-full max-w-3xl rounded-2xl bg-background shadow-2xl border border-purple-200">

        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-purple-700">AI · Адаптация плана</p>
            <h3 className="text-lg font-semibold text-foreground">{athleteName}</h3>
          </div>
          <button onClick={onClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full pf-spin mx-auto mb-3" />
              Claude анализирует ACWR и последние 14 дней…
            </div>
          ) : err ? (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              Ошибка: {err === 'AI_NOT_CONFIGURED'
                ? 'AI не настроен (ANTHROPIC_API_KEY)'
                : err === 'COACH_ONLY' ? 'Доступно только тренерам'
                : err === 'NOT_LINKED' ? 'Атлет не связан с вами'
                : err}
            </div>
          ) : data ? (
            <>
              {/* Context banner */}
              {ctx && (
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="ACWR" value={ctx.acwr != null ? ctx.acwr.toFixed(2) : '—'}
                    accent={ctx.zone === 'danger' ? '#B91C1C' : ctx.zone === 'monitor' ? '#C2410C' : '#15803D'} />
                  <Stat label="Ср. recovery (7д)" value={ctx.avgRecovery != null ? `${ctx.avgRecovery}%` : '—'} accent="#2563EB" />
                  <Stat label="Скипы подряд" value={String(ctx.skipStreak)} accent="#64748B" />
                </div>
              )}

              {/* Reason + overview */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-700 mb-1">
                  Причина адаптации · {REASON_LABEL[data.reason]}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{data.overview}</p>
              </div>

              {/* Suggestions */}
              {data.suggestions.length === 0 ? (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                  На ближайшие 7 дней назначенных тренировок нет.
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Предложения Claude ({data.suggestions.filter(s => picked[s.workout_id]).length} выбрано из {data.suggestions.length})
                  </p>
                  {data.suggestions.map(s => {
                    const meta = ACTION_LABEL[s.proposed_action]
                    const isKeep = s.proposed_action === 'keep'
                    return (
                      <label key={s.workout_id}
                        className={`block rounded-xl border p-3 cursor-pointer transition-all ${picked[s.workout_id] ? 'ring-2 ring-purple-300' : ''}`}
                        style={{ borderColor: meta.border, background: meta.bg }}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox"
                            checked={!!picked[s.workout_id]}
                            onChange={e => setPicked(p => ({ ...p, [s.workout_id]: e.target.checked }))}
                            disabled={isKeep}
                            className="mt-1 w-4 h-4 rounded accent-purple-600" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: 'white', color: meta.color, border: `1px solid ${meta.border}` }}>
                                {meta.label}
                              </span>
                              {s.new_duration_min != null && (
                                <span className="text-[10px] font-semibold text-foreground">
                                  → {s.new_duration_min} мин
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm text-foreground">
                              <strong>Сейчас:</strong> {s.current_summary}
                            </div>
                            {s.new_description && (
                              <div className="mt-1 text-sm text-foreground">
                                <strong>Станет:</strong> {s.new_description}
                              </div>
                            )}
                            <div className="mt-1 text-[11px] text-muted-foreground italic">
                              {s.rationale}
                            </div>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {data.team_focus_next_week && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 text-sm">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-700 block mb-0.5">Фокус следующей недели</span>
                  {data.team_focus_next_week}
                </div>
              )}

              {result && (
                <div className="rounded-lg bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm">
                  ✅ Применено {result.applied}. Пропущено {result.skipped}.
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            AI-адаптация — не замена вашему профессиональному суждению. Всегда можно редактировать вручную.
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="rounded-xl border border-border bg-background hover:bg-muted px-4 py-2 text-sm font-semibold">
              Закрыть
            </button>
            {data && data.suggestions.some(s => picked[s.workout_id]) && !result && (
              <button onClick={apply} disabled={applying}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50">
                {applying ? 'Применяем…' : `Применить выбранные (${data.suggestions.filter(s => picked[s.workout_id]).length})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="pf-num text-xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  )
}
