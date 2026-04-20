'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/lib/hooks/useToast'

type Trend = { label: string; direction: 'up' | 'down' | 'flat'; note: string }
type Risk  = { title: string; severity: 'low' | 'medium' | 'high'; note: string }
type Insight = {
  title: string
  summary: string
  overall_score: number
  highlights: string[]
  trends: Trend[]
  risks: Risk[]
  recommendations: string[]
}
type Metrics = {
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
type InsightRow = {
  id: string
  period_kind: 'week' | 'month'
  period_start: string
  period_end: string
  metrics: Metrics
  payload: Insight
  created_at: string
}

type Kind = 'week' | 'month'

function fmtDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  return `${s.toLocaleDateString('ru-RU', opts)} – ${e.toLocaleDateString('ru-RU', opts)}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function sevTone(sev: Risk['severity']): string {
  if (sev === 'high')   return 'bg-rose-50 text-rose-700 border-rose-200'
  if (sev === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function dirIcon(d: Trend['direction']): { icon: string; color: string } {
  if (d === 'up')   return { icon: 'ki-arrow-up',    color: '#10B981' }
  if (d === 'down') return { icon: 'ki-arrow-down',  color: '#EF4444' }
  return { icon: 'ki-minus', color: '#64748B' }
}

function scoreTone(s: number): string {
  if (s >= 7) return 'text-emerald-600'
  if (s >= 5) return 'text-amber-600'
  return 'text-rose-600'
}

export default function InsightsPage() {
  const { error, success } = useToast()
  const [kind, setKind] = useState<Kind>('week')
  const [current, setCurrent] = useState<InsightRow | null>(null)
  const [range, setRange] = useState<{ start: string; end: string } | null>(null)
  const [recent, setRecent] = useState<InsightRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (k: Kind) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/insights?kind=${k}`)
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'LOAD_ERROR')
      setCurrent(json.current as InsightRow | null)
      setRange(json.range ?? null)
      setRecent((json.recent ?? []) as InsightRow[])
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [error])

  useEffect(() => { load(kind) }, [kind, load])

  const regenerate = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || 'AI_ERROR')
      setCurrent(json.current as InsightRow)
      success('Разбор обновлён')
      load(kind)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Не удалось получить разбор')
    } finally {
      setBusy(false)
    }
  }, [kind, error, success, load])

  const m = current?.metrics ?? null
  const p = current?.payload ?? null

  const kindLabel = kind === 'week' ? 'Неделя' : 'Месяц'

  const topType = useMemo(() => {
    if (!m || !m.types_breakdown?.length) return null
    return m.types_breakdown[0]
  }, [m])

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_42%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-600">
            AI разбор
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-foreground">
            {kindLabel} · {range ? fmtDateRange(range.start, range.end) : '—'}
          </h1>
          <p className="max-w-[680px] text-sm text-muted-foreground">
            Claude разбирает ваши тренировки и заметки за период:
            сильные стороны, риски перетренированности и рекомендации.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-border bg-card p-1">
              {(['week', 'month'] as const).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    k === kind
                      ? 'bg-sky-500 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {k === 'week' ? 'Неделя' : 'Месяц'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={regenerate}
              disabled={busy || loading}
              className="rounded-full bg-sky-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-600 disabled:opacity-50"
            >
              <i className="ki-filled ki-magic-stick mr-1" />
              {busy ? 'Анализ…' : current ? 'Пересобрать' : 'Сделать разбор'}
            </button>
          </div>
        </div>
      </section>

      {/* Metrics KPI */}
      {m && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI label="Сессии" value={m.sessions} icon="ki-flash" iconColor="#F97316" />
          <KPI label="Объём" value={`${m.total_minutes} мин`} icon="ki-time" iconColor="#16A34A" />
          <KPI label="Дней активно" value={m.days_active} icon="ki-calendar" iconColor="#2563EB" />
          <KPI label="Средний strain" value={m.avg_strain ?? '—'} icon="ki-pulse" iconColor="#DC2626" />
          <KPI label="Средний пульс" value={m.avg_hr ? `${m.avg_hr} уд` : '—'} icon="ki-heart" iconColor="#EF4444" />
          <KPI label="Recovery" value={m.avg_recovery ?? '—'} icon="ki-shield-tick" iconColor="#10B981" />
          <KPI label="HRV" value={m.avg_hrv ?? '—'} icon="ki-chart-line-up" iconColor="#7C3AED" />
          <KPI label="Настроение" value={m.avg_mood ? `${m.avg_mood}/5` : '—'} icon="ki-happy" iconColor="#F59E0B" />
        </section>
      )}

      {/* AI payload */}
      {p ? (
        <>
          <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50">
                <i className="ki-filled ki-sparkle text-[18px] text-sky-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-lg font-bold text-foreground">{p.title}</div>
                  <div className={`text-xl font-bold ${scoreTone(p.overall_score)}`}>{p.overall_score.toFixed(1)}/10</div>
                </div>
                <p className="mt-2 text-sm text-foreground/90">{p.summary}</p>
                {topType && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Преобладающая активность: <b>{topType.type}</b> ({topType.sessions} сессий · {topType.minutes} мин)
                  </div>
                )}
              </div>
            </div>
          </section>

          {p.highlights?.length > 0 && (
            <Block title="Что получилось" color="emerald">
              {p.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <i className="ki-filled ki-check mt-0.5 text-emerald-500" />
                  <span>{h}</span>
                </li>
              ))}
            </Block>
          )}

          {p.trends?.length > 0 && (
            <Block title="Тренды" color="sky">
              {p.trends.map((t, i) => {
                const d = dirIcon(t.direction)
                return (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <i className={`ki-filled ${d.icon} mt-0.5`} style={{ color: d.color }} />
                    <span><b>{t.label}</b> — {t.note}</span>
                  </li>
                )
              })}
            </Block>
          )}

          {p.risks?.length > 0 && (
            <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-rose-600">Риски</div>
              <ul className="space-y-2">
                {p.risks.map((r, i) => (
                  <li key={i} className={`rounded-xl border px-3 py-2 text-sm ${sevTone(r.severity)}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.title}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wider">{r.severity}</span>
                    </div>
                    <div className="mt-1 text-[13px] opacity-90">{r.note}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.recommendations?.length > 0 && (
            <Block title="Рекомендации" color="indigo">
              {p.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                  <i className="ki-filled ki-arrow-right mt-0.5 text-indigo-500" />
                  <span>{r}</span>
                </li>
              ))}
            </Block>
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {loading ? 'Загрузка…' : busy ? 'Формируем разбор…' :
            'Нажмите «Сделать разбор», чтобы получить AI-анализ за выбранный период.'}
        </section>
      )}

      {/* History */}
      {recent.length > 1 && (
        <section>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            История разборов
          </div>
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {recent.map(r => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {r.period_kind === 'week' ? 'Неделя' : 'Месяц'}
                  </span>
                  <span className="text-muted-foreground">{fmtDate(r.period_start)} – {fmtDate(r.period_end)}</span>
                  {r.payload?.overall_score != null && (
                    <span className={`ml-auto font-bold ${scoreTone(r.payload.overall_score)}`}>
                      {r.payload.overall_score.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm font-semibold text-foreground">{r.payload?.title ?? '—'}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function KPI({ label, value, icon, iconColor }: { label: string; value: React.ReactNode; icon: string; iconColor: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${iconColor}18` }}>
          <i className={`ki-filled ${icon} text-[14px]`} style={{ color: iconColor }} />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="pf-num mt-1 text-xl font-bold text-foreground">{value}</div>
    </div>
  )
}

function Block({ title, color, children }: { title: string; color: 'emerald' | 'sky' | 'indigo'; children: React.ReactNode }) {
  const cls = color === 'emerald' ? 'text-emerald-600' : color === 'sky' ? 'text-sky-600' : 'text-indigo-600'
  return (
    <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
      <div className={`mb-3 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{title}</div>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  )
}
