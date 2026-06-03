'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/lib/hooks/useUser'
import {
  computeCoachAthletesAcwr,
  ACWR_ZONE_META,
  type AthleteAcwr,
  type AcwrZone,
} from '@/services/acwr.service'
import AdaptivePlanModal from '@/components/coach/AdaptivePlanModal'
import { Card } from '@/components/ui/metronic'

const ZONE_ORDER: AcwrZone[] = ['danger', 'monitor', 'optimal', 'detraining', 'no_data']

export default function AthleteLoadPage() {
  const { user, loading: userLoading } = useUser()
  const [rows, setRows] = useState<AthleteAcwr[]>([])
  const [loading, setLoading] = useState(true)
  const [adaptive, setAdaptive] = useState<{ id: string; name: string } | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try { setRows(await computeCoachAthletesAcwr(user.id)) }
    finally { setLoading(false) }
  }, [user?.id])

  useEffect(() => { load() }, [load])

  if (userLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }
  if (user.role !== 'coach') {
    return (
      <Card className="max-w-xl mx-auto mt-12 p-8 text-center">
        <i className="ki-filled ki-lock text-3xl text-muted-foreground block mb-3" />
        <h1 className="text-lg font-bold text-foreground mb-1">Доступно только тренерам</h1>
        <p className="text-sm text-muted-foreground">Раздел показывает ACWR для атлетов, подключённых к вам.</p>
      </Card>
    )
  }

  const counts: Record<AcwrZone, number> = rows.reduce((acc, r) => {
    acc[r.zone] = (acc[r.zone] ?? 0) + 1
    return acc
  }, { danger: 0, monitor: 0, optimal: 0, detraining: 0, no_data: 0 } as Record<AcwrZone, number>)

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div className="relative overflow-hidden rounded-3xl border border-[#FECACA] bg-gradient-to-br from-[#FEF2F2] via-white to-[#FFF7ED] p-6 md:p-8">
        <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-red-200/40 blur-3xl" />
        <div className="relative flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FECACA] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#DC2626]">
            <i className="ki-filled ki-shield-cross text-[11px]" />
            Нагрузка
          </span>
          <h1 className="pf-num text-3xl md:text-4xl leading-tight text-foreground">ACWR — риск травмы</h1>
          <p className="max-w-2xl text-sm md:text-base text-muted-foreground">
            Отношение острой (7 дн) к хронической (28 дн) нагрузке. &laquo;Сладкая зона&raquo; — 0.8–1.3.
            Значение &gt; 1.5 связано с повышенным риском травмы в спортивной науке.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {ZONE_ORDER.map(z => {
          const meta = ACWR_ZONE_META[z]
          return (
            <div key={z} className="rounded-xl border p-3" style={{ borderColor: meta.border, background: meta.bg }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</div>
              <div className="pf-num text-2xl mt-1" style={{ color: meta.color }}>{counts[z]}</div>
            </div>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Атлеты · {rows.length}</p>
          <button onClick={load} className="text-[11px] font-semibold text-orange-600 hover:text-orange-700">
            <i className="ki-filled ki-refresh text-[10px] mr-1"/>
            Обновить
          </button>
        </div>
        {loading && rows.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted-foreground">Считаем нагрузку…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Нет связанных атлетов</p>
            <Link href="/network" className="text-xs text-orange-600 hover:underline">Найти атлетов →</Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map(r => {
              const meta = ACWR_ZONE_META[r.zone]
              const highlight = r.zone === 'danger' || r.zone === 'monitor'
              return (
                <div key={r.athlete_id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                  <Link href={`/profile/${r.athlete_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-xs shrink-0">
                      {r.athlete_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">{r.athlete_name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        острая {r.acute_avg.toFixed(1)} · хроническая {r.chronic_avg.toFixed(1)} · {r.workouts_28d} тренировок за 28 дн
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="pf-num text-lg font-bold" style={{ color: meta.color }}>
                      {r.acwr === null ? '—' : r.acwr.toFixed(2)}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                      {meta.label}
                    </span>
                    <button onClick={() => setAdaptive({ id: r.athlete_id, name: r.athlete_name })}
                      title="AI-адаптация плана"
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition-all ${highlight
                        ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
                        : 'bg-background text-purple-700 border-purple-200 hover:bg-purple-50'}`}>
                      🤖 AI-план
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card className="p-5 text-xs text-muted-foreground space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Как читать</p>
        <p><strong style={{ color: ACWR_ZONE_META.optimal.color }}>0.8–1.3</strong> — баланс: организм адаптируется, риск низкий.</p>
        <p><strong style={{ color: ACWR_ZONE_META.monitor.color }}>1.3–1.5</strong> — сигнал внимания: снизьте темп роста нагрузки.</p>
        <p><strong style={{ color: ACWR_ZONE_META.danger.color }}>&gt; 1.5</strong> — красная зона: повышенный риск травмы и перетренированности.</p>
        <p><strong style={{ color: ACWR_ZONE_META.detraining.color }}>&lt; 0.8</strong> — хроническая недогрузка: форма будет падать.</p>
        <p className="pt-2 text-[10px]">
          Нагрузка = Whoop strain (если есть), иначе длительность × 0.1. Минимум 3 тренировки за 28 дн для расчёта.
        </p>
      </Card>

      {adaptive && (
        <AdaptivePlanModal
          athleteId={adaptive.id}
          athleteName={adaptive.name}
          onClose={() => setAdaptive(null)}
          onApplied={load}
        />
      )}
    </div>
  )
}
