'use client'

/**
 * Карточка «Форма, готовность и цели» — визуализирует движок lib/analytics.
 *
 * Дополняет существующий «светофор ACWR» новыми сигналами: форма Банистера
 * (TSB), готовность по wellness z-оценкам, надёжный EWMA-ACWR и прогноз целей.
 * Самодостаточна: сама тянет данные через services/training-readiness (клиентский
 * Supabase, текущий атлет). Пока данных мало — показывает пустое состояние.
 */

import { useEffect, useState } from 'react'
import {
  buildLoadAnalyticsView,
  type AnalyticsCardView,
  type AnalyticsTone,
} from '@/lib/analytics'
import { getMyAnalytics } from '@/services/training-readiness.service'

// Тоны -> классы Metronic Tailwind (полные литералы, чтобы их видел сканер Tailwind).
const TONE_TEXT: Record<AnalyticsTone, string> = {
  neutral: 'text-navy-500',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-rose-600',
  info: 'text-sky-600',
}

const TONE_PILL: Record<AnalyticsTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
}

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'view'; view: AnalyticsCardView }

export function ReadinessCard() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const analytics = await getMyAnalytics()
        if (cancelled) return
        setState({ kind: 'view', view: buildLoadAnalyticsView(analytics) })
      } catch (err) {
        if (cancelled) return
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Не удалось загрузить аналитику.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">
          Форма · Готовность · Цели
        </div>
        <p className="text-sm text-muted-foreground">
          Детерминированные метрики за 12 недель: форма (TSB), готовность по wellness и прогноз целей.
        </p>
      </div>

      {state.kind === 'loading' ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Загрузка…
        </div>
      ) : state.kind === 'error' ? (
        <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 p-8 text-center text-sm text-rose-700">
          {state.message}
        </div>
      ) : state.view.kind === 'empty' ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          {state.view.reason}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {state.view.tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {state.view.tiles.map((tile) => (
                <div key={tile.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {tile.label}
                  </div>
                  <div className={`pf-num mt-1 text-xl font-bold ${TONE_TEXT[tile.tone]}`}>
                    {tile.value}
                  </div>
                  {tile.hint && <div className="mt-0.5 text-xs text-muted-foreground">{tile.hint}</div>}
                </div>
              ))}
            </div>
          )}

          {state.view.goals.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Цели</div>
              {state.view.goals.map((goal) => (
                <div
                  key={goal.key}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-navy-500">{goal.title}</span>
                    {goal.detail && <span className="mt-0.5 text-xs text-muted-foreground">{goal.detail}</span>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${TONE_PILL[goal.tone]}`}
                  >
                    {goal.statusLabel}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {state.view.dataQuality ? `${state.view.dataQuality} · ` : ''}
            Расчёт по детерминированным спортивно-научным формулам (ACWR, CTL/ATL/TSB, монотонность). Не медицинский совет.
          </p>
        </div>
      )}
    </section>
  )
}
