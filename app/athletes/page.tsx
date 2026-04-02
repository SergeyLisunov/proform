'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { RISK_COLORS, COACH_MARKS, recoveryColor } from '@/lib/utils/data'
import dynamic from 'next/dynamic'
import { createBrowserClient } from '@supabase/ssr'
import type { Workout } from '@/services/workouts.service'

const ApexChart = dynamic(() => import('@/components/charts/ApexChart'), { ssr: false })

function sb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type AthleteUser = {
  id: string; name: string; sport_type: string | null; age: number | null; gender: string | null
}

type AthleteWithStats = AthleteUser & {
  recovery: number | null; hrv: number | null; rhr: number | null
  sessions: number; recentWorkouts: Workout[]
}

type TabType = 'overview' | 'sessions' | 'diary' | 'marks'

function getRisk(recovery: number | null): 'high' | 'moderate' | 'low' {
  if (recovery == null) return 'low'
  if (recovery < 40) return 'high'
  if (recovery < 60) return 'moderate'
  return 'low'
}

function AthleteCard({ athlete, onSelect, selected }: {
  athlete: AthleteWithStats; onSelect: () => void; selected: boolean
}) {
  const rc  = recoveryColor(athlete.recovery ?? 50)
  const risk = getRisk(athlete.recovery)
  const rr  = RISK_COLORS[risk]

  return (
    <div onClick={onSelect}
      className={['bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm',
        selected ? 'border-orange-400 shadow-sm' : 'border-border hover:border-orange-200'].join(' ')}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num"
          style={{ background: rc + '20', color: rc }}>
          {athlete.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{athlete.name}</div>
          <div className="text-2xs text-muted-foreground">{athlete.sport_type ?? 'Спорт не указан'}</div>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-bold border"
          style={{ background: rr.bg, color: rr.text, borderColor: rr.border }}>
          <i className={`ki-filled ${rr.icon} mr-0.5 text-[9px]`} />
          {risk}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <RecoveryRing score={athlete.recovery ?? 0} size={56} />
        <div className="flex-1 space-y-1.5">
          {athlete.hrv != null && (
            <div>
              <span className="text-[9px] text-muted-foreground">HRV {athlete.hrv.toFixed(0)} ms</span>
              <div className="h-1.5 bg-border rounded-full overflow-hidden mt-0.5">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, athlete.hrv)}%`, background: rc }} />
              </div>
            </div>
          )}
          {athlete.rhr != null && (
            <div>
              <span className="text-[9px] text-muted-foreground">ЧСС покоя {athlete.rhr} bpm</span>
              <div className="h-1.5 bg-border rounded-full overflow-hidden mt-0.5">
                <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(0, 100 - (athlete.rhr - 40) * 3)}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-4 mt-3 pt-2.5 border-t border-border text-center">
        <div className="flex-1">
          <div className="pf-num text-lg text-foreground">{athlete.sessions}</div>
          <div className="text-[9px] text-muted-foreground">сессий</div>
        </div>
        <div className="flex-1">
          <div className="pf-num text-lg" style={{ color: rc }}>{athlete.recovery != null ? `${athlete.recovery}%` : '—'}</div>
          <div className="text-[9px] text-muted-foreground">восстановление</div>
        </div>
      </div>
    </div>
  )
}

function AthleteDetail({ athlete }: { athlete: AthleteWithStats }) {
  const [tab, setTab] = useState<TabType>('overview')
  const rc = recoveryColor(athlete.recovery ?? 50)
  const risk = getRisk(athlete.recovery)

  const strainData = athlete.recentWorkouts.slice(0, 7).map(w => w.activity_strain ?? 0).reverse()
  const hrvData    = athlete.recentWorkouts.slice(0, 7).map(w => w.hrv ?? 0).reverse()

  const lineOpts = {
    chart: { type: 'line' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: [2, 2], dashArray: [0, 4] },
    colors: ['#F97316', '#2563EB'],
    xaxis: {
      categories: athlete.recentWorkouts.slice(0, 7).map(w => (w.event_date ?? '').slice(5)).reverse(),
      labels: { style: { fontSize: '11px', colors: '#A1A1AA' } },
      axisBorder: { show: false }, axisTicks: { show: false },
    },
    yaxis: [{ labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }, { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Обзор',      icon: 'ki-element-11' },
    { id: 'sessions', label: 'Тренировки', icon: 'ki-abstract-26' },
    { id: 'marks',    label: 'Метки',      icon: 'ki-tag' },
  ]

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold pf-num"
          style={{ background: rc + '20', color: rc }}>
          {athlete.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{athlete.name}</h3>
          <p className="text-2xs text-muted-foreground">
            {[athlete.sport_type, athlete.age ? `${athlete.age} лет` : null, athlete.gender === 'F' ? 'Женщина' : athlete.gender === 'M' ? 'Мужчина' : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex border-b border-border px-4">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={['flex items-center gap-1.5 px-3 py-3 text-2sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'].join(' ')}>
            <i className={`ki-filled ${t.icon} text-xs`} />{t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: 'Восстановление', value: athlete.recovery != null ? `${athlete.recovery}%` : '—', color: rc },
                { label: 'HRV',            value: athlete.hrv      != null ? `${athlete.hrv.toFixed(0)} ms` : '—', color: '#2563EB' },
                { label: 'ЧСС покоя',      value: athlete.rhr      != null ? `${athlete.rhr} bpm` : '—', color: '#EF4444' },
                { label: 'Тренировок',     value: athlete.sessions.toString(), color: '#7C3AED' },
              ].map(k => (
                <div key={k.label} className="bg-background border border-border rounded-xl p-3 text-center">
                  <div className="pf-num text-2xl leading-none mb-0.5" style={{ color: k.color }}>{k.value}</div>
                  <div className="text-2xs text-muted-foreground">{k.label}</div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Оценка рисков</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Риск перегрузки',    status: risk,                                                          icon: 'ki-warning-2' },
                  { label: 'Недовосстановление', status: (athlete.recovery ?? 100) < 50 ? 'moderate' : 'low' as const,  icon: 'ki-abstract-26' },
                  { label: 'Нагрузка',           status: 'low' as const,                                                 icon: 'ki-chart-line-up' },
                  { label: 'Стабильность',       status: 'low' as const,                                                 icon: 'ki-abstract-31' },
                ].map(r => {
                  const rr = RISK_COLORS[r.status as keyof typeof RISK_COLORS]
                  return (
                    <div key={r.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border"
                      style={{ background: rr.bg, borderColor: rr.border }}>
                      <i className={`ki-filled ${r.icon} text-sm`} style={{ color: rr.text }} />
                      <div>
                        <div className="text-2xs font-semibold" style={{ color: rr.text }}>{r.label}</div>
                        <div className="text-[9px] text-muted-foreground capitalize">{r.status}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {strainData.length > 0 && (
              <div>
                <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Недельный тренд</div>
                <ApexChart type="line"
                  series={[{ name: 'Нагрузка', data: strainData }, { name: 'HRV (ms)', data: hrvData }]}
                  options={lineOpts} height={160} />
              </div>
            )}
          </div>
        )}

        {tab === 'sessions' && (
          <div className="divide-y divide-border -mx-5 -mb-5">
            {athlete.recentWorkouts.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-2sm">
                Тренировок пока нет
              </div>
            ) : athlete.recentWorkouts.slice(0, 10).map(w => {
              const r = recoveryColor(w.recovery_score ?? 50)
              return (
                <div key={w.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{w.name ?? w.activity_type ?? 'Тренировка'}</div>
                    <div className="text-2xs text-muted-foreground">{w.event_date} · {w.activity_duration_min ? `${w.activity_duration_min} мин` : ''}</div>
                  </div>
                  {w.activity_strain != null && (
                    <div className="w-24 hidden sm:block">
                      <div className="flex justify-between text-2xs mb-1">
                        <span className="text-muted-foreground">Нагрузка</span>
                        <span className="font-bold text-foreground">{w.activity_strain.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, (w.activity_strain / 21) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {w.recovery_score != null && (
                    <div className="text-right shrink-0">
                      <div className="pf-num text-lg leading-none" style={{ color: r }}>{w.recovery_score}%</div>
                      <div className="text-[9px] text-muted-foreground">восстановление</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'marks' && (
          <div className="flex flex-col gap-3">
            <div className="text-2xs text-muted-foreground">Метки тренера для тренировочных сессий</div>
            {Object.entries(COACH_MARKS).map(([key, mark]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl border"
                style={{ background: mark.bg, borderColor: mark.text + '30' }}>
                <div>
                  <div className="text-2sm font-semibold" style={{ color: mark.text }}>{mark.label}</div>
                  <div className="text-[9px] text-muted-foreground capitalize">{key.replace('_', ' ')}</div>
                </div>
                <button className="px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all hover:opacity-80"
                  style={{ background: mark.bg, color: mark.text, borderColor: mark.text + '40' }}>
                  Применить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AthletesPage() {
  const { user } = useUser()
  const [athletes, setAthletes] = useState<AthleteWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    if (user.role !== 'coach' && user.role !== 'admin') return

    async function load() {
      const { data: users } = await sb()
        .from('users')
        .select('id, name, sport_type, age, gender')
        .eq('role', 'athlete')
        .limit(30)
      if (!users) { setLoading(false); return }

      const rows: AthleteWithStats[] = await Promise.all(
        users.map(async u => {
          const { data: ws } = await sb()
            .from('workouts')
            .select('*')
            .eq('athlete_id', u.id)
            .order('event_date', { ascending: false })
            .limit(20)
          const workouts = (ws ?? []) as Workout[]
          const withRecovery = workouts.filter(w => w.recovery_score != null)
          const withHRV      = workouts.filter(w => w.hrv != null)
          const withRHR      = workouts.filter(w => w.avg_heart_rate != null)
          return {
            ...u,
            recovery: withRecovery.length ? Math.round(withRecovery[0].recovery_score!) : null,
            hrv:      withHRV.length      ? parseFloat(withHRV[0].hrv!.toFixed(1)) : null,
            rhr:      withRHR.length      ? Math.round(withRHR[0].avg_heart_rate!) : null,
            sessions: workouts.length,
            recentWorkouts: workouts,
          }
        })
      )
      setAthletes(rows)
      setLoading(false)
    }
    load()
  }, [user?.id, user?.role])

  if (user?.role !== 'coach' && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <i className="ki-filled ki-lock-2 text-2xl text-red-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Доступ ограничен</p>
          <p className="text-2sm text-muted-foreground mt-1">Этот раздел доступен только тренерам.</p>
        </div>
      </div>
    )
  }

  const avgRecovery = athletes.filter(a => a.recovery != null).length
    ? Math.round(athletes.reduce((s, a) => s + (a.recovery ?? 0), 0) / athletes.filter(a => a.recovery != null).length)
    : 0
  const atRisk = athletes.filter(a => getRisk(a.recovery) !== 'low').length

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Панель тренера</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Мои атлеты</h2>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Атлеты',             value: loading ? '…' : athletes.length,   bg: 'bg-blue-50 text-blue-600',    icon: 'ki-people' },
          { label: 'Ср. восстановление', value: loading ? '…' : `${avgRecovery}%`, bg: 'bg-green-50 text-green-600',  icon: 'ki-abstract-26' },
          { label: 'В зоне риска',       value: loading ? '…' : atRisk,            bg: atRisk > 0 ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-600', icon: 'ki-warning-2' },
          { label: 'Всего тренировок',   value: loading ? '…' : athletes.reduce((s, a) => s + a.sessions, 0), bg: 'bg-violet-50 text-violet-600', icon: 'ki-calendar' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <i className={`ki-filled ${s.icon} text-base`} />
            </div>
            <div>
              <div className="pf-num text-2xl text-foreground">{s.value}</div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <i className="ki-filled ki-people text-3xl text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">Атлетов пока нет</p>
          <p className="text-2sm text-muted-foreground">Когда атлеты зарегистрируются в системе, они появятся здесь.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
          <div className="flex flex-col gap-3">
            {athletes.map((a, i) => (
              <AthleteCard key={a.id} athlete={a} onSelect={() => setSelected(i)} selected={selected === i} />
            ))}
          </div>
          {athletes[selected] && <AthleteDetail athlete={athletes[selected]} />}
        </div>
      )}
    </div>
  )
}
