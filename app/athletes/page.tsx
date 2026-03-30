'use client'
import { useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { DEMO_ATHLETES, DEMO_DIARY, DEMO_SESSIONS, RISK_COLORS, COACH_MARKS, recoveryColor } from '@/lib/utils/data'
import ApexChart from '@/components/charts/ApexChart'

type TabType = 'overview' | 'sessions' | 'diary' | 'marks'

function AthleteCard({ athlete, onSelect, selected }: { athlete: typeof DEMO_ATHLETES[0]; onSelect: () => void; selected: boolean }) {
  const rc = recoveryColor(athlete.recovery)
  const rr = RISK_COLORS[athlete.risk]

  return (
    <div
      onClick={onSelect}
      className={[
        'bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-sm',
        selected ? 'border-orange-400 shadow-sm' : 'border-border hover:border-orange-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold pf-num" style={{ background: rc + '20', color: rc }}>
          {athlete.name.split(' ').map((n:string) => n[0]).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{athlete.name}</div>
          <div className="text-2xs text-muted-foreground">{athlete.sport}</div>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-2xs font-bold border" style={{ background: rr.bg, color: rr.text, borderColor: rr.border }}>
          <i className={`ki-filled ${rr.icon} mr-0.5 text-[9px]`} />
          {athlete.risk}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <RecoveryRing score={athlete.recovery} size={56} />
        <div className="flex-1 space-y-1.5">
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">HRV {athlete.hrv} ms</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, athlete.hrv)}%`, background: rc }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">RHR {athlete.rhr} bpm</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(0, 100 - (athlete.rhr - 40) * 3)}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-4 mt-3 pt-2.5 border-t border-border text-center">
        <div className="flex-1">
          <div className="pf-num text-lg text-foreground">{athlete.sessions}</div>
          <div className="text-[9px] text-muted-foreground">сессий</div>
        </div>
        <div className="flex-1">
          <div className="pf-num text-lg text-foreground">{athlete.streak}д</div>
          <div className="text-[9px] text-muted-foreground">серия</div>
        </div>
        <div className="flex-1">
          <div className="pf-num text-lg" style={{ color: rc }}>{athlete.recovery}%</div>
          <div className="text-[9px] text-muted-foreground">восстановление</div>
        </div>
      </div>
    </div>
  )
}

function AthleteDetail({ athlete }: { athlete: typeof DEMO_ATHLETES[0] }) {
  const [tab, setTab] = useState<TabType>('overview')
  const rc = recoveryColor(athlete.recovery)

  const lineOpts = {
    chart: { type: 'line' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: [2,2], dashArray: [0,4] },
    colors: ['#F97316','#2563EB'],
    xaxis: { categories: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: [{ labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }, { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const TABS: { id: TabType; label: string; icon: string }[] = [
    { id: 'overview', label: 'Обзор',       icon: 'ki-element-11' },
    { id: 'sessions', label: 'Тренировки',  icon: 'ki-abstract-26' },
    { id: 'diary',    label: 'Дневник',     icon: 'ki-notepad-edit' },
    { id: 'marks',    label: 'Метки',       icon: 'ki-tag' },
  ]

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Athlete header */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold pf-num" style={{ background: rc + '20', color: rc }}>
          {athlete.name.split(' ').map((n:string) => n[0]).join('')}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{athlete.name}</h3>
          <p className="text-2xs text-muted-foreground">{athlete.sport} · Возраст {athlete.age} · {athlete.gender === 'F' ? 'Женщина' : 'Мужчина'} · {athlete.id}</p>
        </div>
        <div className="flex gap-2">
          <button className="kt-btn kt-btn-sm kt-btn-outline gap-1.5">
            <i className="ki-filled ki-message-text text-xs" />
            Комментарий
          </button>
          <button className="kt-btn kt-btn-sm kt-btn-primary gap-1.5">
            <i className="ki-filled ki-eye text-xs" />
            Профиль
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-3 text-2sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <i className={`ki-filled ${t.icon} text-xs`} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: 'Восстановление', value: `${athlete.recovery}%`, color: rc },
                { label: 'ВСР',          value: `${athlete.hrv} ms`,   color: '#2563EB' },
                { label: 'ЧСС покоя',    value: `${athlete.rhr} bpm`,  color: '#EF4444' },
                { label: 'Серия',        value: `${athlete.streak}д`,  color: '#7C3AED' },
              ].map(k => (
                <div key={k.label} className="bg-background border border-border rounded-xl p-3 text-center">
                  <div className="pf-num text-2xl leading-none mb-0.5" style={{ color: k.color }}>{k.value}</div>
                  <div className="text-2xs text-muted-foreground">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Risk Cards */}
            <div>
              <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Оценка рисков</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Риск перегрузки',     status: athlete.risk === 'high' ? 'high' : 'low',      icon: 'ki-warning-2' },
                  { label: 'Недовосстановление',   status: athlete.recovery < 50 ? 'moderate' : 'low',   icon: 'ki-abstract-26' },
                  { label: 'Нестабильность',       status: 'low',                                         icon: 'ki-chart-line-up' },
                  { label: 'Тренировочная нагрузка', status: athlete.streak > 10 ? 'moderate' : 'low',   icon: 'ki-abstract-31' },
                ].map(r => {
                  const rr = RISK_COLORS[r.status as keyof typeof RISK_COLORS]
                  return (
                    <div key={r.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ background: rr.bg, borderColor: rr.border }}>
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

            {/* Trend chart */}
            <div>
              <div className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Недельный тренд</div>
              <ApexChart type="line"
                series={[{ name: 'Нагрузка', data: [8.2,11.5,7.1,14.2,10.8,6.3,12.1] }, { name: 'ВСР (ms)', data: [44,47,45,41,48,50,47] }]}
                options={lineOpts} height={160} />
            </div>
          </div>
        )}

        {tab === 'sessions' && (
          <div className="divide-y divide-border -mx-5 -mb-5">
            {DEMO_SESSIONS.slice(0,5).map((s,i) => {
              const r = recoveryColor(s.recovery)
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/40">
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{s.type}</div>
                    <div className="text-2xs text-muted-foreground">{s.date} · {s.dur} мин</div>
                  </div>
                  <div className="w-24 hidden sm:block">
                    <div className="flex justify-between text-2xs mb-1">
                      <span className="text-muted-foreground">Нагрузка</span>
                      <span className="font-bold text-foreground">{s.strain}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${(s.strain/20)*100}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-lg leading-none" style={{ color: r }}>{s.recovery}%</div>
                    <div className="text-[9px] text-muted-foreground">восстановление</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'diary' && (
          <div className="flex flex-col gap-3">
            {DEMO_DIARY.map((d,i) => {
              const rr = RISK_COLORS[d.risk as keyof typeof RISK_COLORS]
              return (
                <div key={i} className="p-3 rounded-xl border hover:border-orange-200 transition-colors" style={{ background: rr.bg + '40', borderColor: rr.border }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-2sm font-semibold text-foreground">{d.title}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0" style={{ background: rr.bg, color: rr.text, borderColor: rr.border }}>{d.risk}</span>
                  </div>
                  <p className="text-2xs text-foreground/70 leading-relaxed">{d.note}</p>
                  <div className="text-[9px] text-muted-foreground mt-1.5">{d.date}</div>
                </div>
              )
            })}
          </div>
        )}

        {tab === 'marks' && (
          <div className="flex flex-col gap-3">
            <div className="text-2xs text-muted-foreground">Метки тренера для тренировочных сессий</div>
            {Object.entries(COACH_MARKS).map(([key, mark]) => (
              <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl border" style={{ background: mark.bg, borderColor: mark.text + '30' }}>
                <div>
                  <div className="text-2sm font-semibold" style={{ color: mark.text }}>{mark.label}</div>
                  <div className="text-[9px] text-muted-foreground capitalize">{key.replace('_',' ')}</div>
                </div>
                <button className="px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all hover:opacity-80" style={{ background: mark.bg, color: mark.text, borderColor: mark.text + '40' }}>
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
  const [selected, setSelected] = useState(0)

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

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Панель тренера</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Мои атлеты</h2>
        </div>
        <button className="kt-btn kt-btn-primary gap-2">
          <i className="ki-filled ki-plus text-sm" />
          Добавить атлета
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Атлеты',           value: DEMO_ATHLETES.length, bg: 'bg-blue-50 text-blue-600', icon: 'ki-people' },
          { label: 'Ср. восстановление', value: `${Math.round(DEMO_ATHLETES.reduce((a,b) => a+b.recovery,0)/DEMO_ATHLETES.length)}%`, bg: 'bg-green-50 text-green-600', icon: 'ki-abstract-26' },
          { label: 'В зоне риска',      value: DEMO_ATHLETES.filter(a => a.risk !== 'low').length, bg: 'bg-orange-50 text-orange-500', icon: 'ki-warning-2' },
          { label: 'Активны сегодня',   value: 3, bg: 'bg-violet-50 text-violet-600', icon: 'ki-calendar' },
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

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        {/* Athlete list */}
        <div className="flex flex-col gap-3">
          {DEMO_ATHLETES.map((a, i) => (
            <AthleteCard key={a.id} athlete={a} onSelect={() => setSelected(i)} selected={selected === i} />
          ))}
        </div>

        {/* Detail panel */}
        <AthleteDetail athlete={DEMO_ATHLETES[selected]} />
      </div>
    </div>
  )
}
