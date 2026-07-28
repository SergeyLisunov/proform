'use client'
import { useCallback, useEffect, useState } from 'react'

type Alert = {
  severity: 'info' | 'warning' | 'critical'
  type: 'recovery' | 'hrv' | 'strain' | 'load' | 'hr' | 'mood' | 'pattern'
  title: string
  detail: string
  action: string
}

type Report = {
  overall_status: 'green' | 'yellow' | 'red'
  summary: string
  alerts: Alert[]
}

const STATUS_STYLE: Record<Report['overall_status'], { dot: string; bg: string; ring: string; label: string }> = {
  green:  { dot: '#10B981', bg: '#ECFDF5', ring: 'ring-emerald-200', label: 'Всё в норме' },
  yellow: { dot: '#F59E0B', bg: '#FFFBEB', ring: 'ring-amber-200',   label: 'Нужно внимание' },
  red:    { dot: '#EF4444', bg: '#FEF2F2', ring: 'ring-red-200',     label: 'Критично' },
}

const SEVERITY_STYLE: Record<Alert['severity'], { bg: string; text: string; icon: string }> = {
  info:     { bg: '#DBEAFE', text: '#1D4ED8', icon: 'ki-information-2' },
  warning:  { bg: '#FEF3C7', text: '#B45309', icon: 'ki-shield-tick' },
  critical: { bg: '#FEE2E2', text: '#B91C1C', icon: 'ki-shield-cross' },
}

const TYPE_ICON: Record<Alert['type'], string> = {
  recovery: 'ki-heart',
  hrv:      'ki-pulse',
  strain:   'ki-flash-circle',
  load:     'ki-chart-line-up',
  hr:       'ki-abstract-26',
  mood:     'ki-emoji-happy',
  pattern:  'ki-element-11',
}

export default function AnomalyAlertCard() {
  const [data, setData]         = useState<Report | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/anomaly-check', { cache: 'no-store' })
      if (res.status === 503) { setDisabled(true); return }
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'AI_ERROR')
      setData(json.data as Report)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI_ERROR')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const st = data ? STATUS_STYLE[data.overall_status] : null

  return (
    <div
      className="rounded-[20px] border border-rose-100 overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#FFF1F2 0%,#FFF8F8 60%,#FFFFFF 100%)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-rose-100/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-rose-100">
            <i className="ki-filled ki-shield-tick text-[14px] text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500 leading-none">Аномалии</h3>
            <div className="text-[10px] text-muted-foreground mt-0.5">AI-мониторинг здоровья</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {st && (
            <span
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-bold"
              style={{ background: st.bg, color: st.dot }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
              {st.label}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading || disabled}
            title="Пересчитать"
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-accent transition"
          >
            <i className={`ki-filled ki-arrows-circle text-[12px] text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {disabled ? (
          <p className="text-xs text-muted-foreground">AI-мониторинг скоро появится — функция настраивается.</p>
        ) : error ? (
          <p className="text-xs text-red-600">Не удалось получить отчёт. <button onClick={load} className="underline">Повторить</button></p>
        ) : loading && !data ? (
          <div className="space-y-2">
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-foreground">{data.summary}</p>
            {data.alerts.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <i className="ki-filled ki-check-circle text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-900">Значимых аномалий не обнаружено</span>
              </div>
            ) : (
              <div className="space-y-2">
                {data.alerts.map((a, i) => {
                  const sev = SEVERITY_STYLE[a.severity]
                  return (
                    <div key={i} className="flex gap-3 rounded-xl border border-border p-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: sev.bg, color: sev.text }}
                      >
                        <i className={`ki-filled ${TYPE_ICON[a.type]} text-[13px]`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-foreground">{a.title}</span>
                          <span
                            className="rounded-full px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider"
                            style={{ background: sev.bg, color: sev.text }}
                          >
                            {a.severity}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-foreground">{a.detail}</div>
                        <div className="mt-1 flex items-start gap-1 text-2xs text-muted-foreground">
                          <i className="ki-filled ki-arrow-right mt-[2px] text-[9px] text-orange-500" />
                          <span>{a.action}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
