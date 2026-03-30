'use client'
import { useState } from 'react'
import { useUser } from '@/lib/hooks/useUser'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import ApexChart from '@/components/charts/ApexChart'
import { DEMO_WEEKLY, DEMO_DAILY, DEMO_HRZ, DEMO_GROUP, DEMO_ATHLETES, DEMO_COMPETITIONS, recoveryColor } from '@/lib/utils/data'

const ZC = ['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
const ZL = ['Z1','Z2','Z3','Z4','Z5']
const PERIOD_OPTS = ['7д','30д','90д','Сезон']

function CoachAnalytics() {
  const [period, setPeriod] = useState('30d')

  const groupBar = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 5 } },
    colors: ['#2563EB','#F97316','#16A34A','#7C3AED'],
    xaxis: { categories: DEMO_WEEKLY.map(w=>w.w), labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const loadCompare = {
    chart: { type: 'radar' as const, toolbar: { show: false }, animations: { enabled: false } },
    colors: ['#2563EB','#F97316','#16A34A','#7C3AED'],
    xaxis: { categories: ['Нагрузка','ВСР','Восстановление','Тренировки','Сон','Серия'] },
    yaxis: { show: false },
    grid: { padding: { top: 10, bottom: 10 } },
    legend: { position: 'bottom' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Аналитика команды</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Аналитика тренера</h2>
        </div>
        <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
          {PERIOD_OPTS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-2sm font-medium transition-all ${period===p?'bg-orange-50 text-orange-600':'text-muted-foreground hover:text-foreground'}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Ср. восстановление', value: `${Math.round(DEMO_ATHLETES.reduce((a,b)=>a+b.recovery,0)/DEMO_ATHLETES.length)}%`, bg: 'bg-green-50 text-green-600', icon: 'ki-abstract-26' },
          { label: 'Ср. ВСР',           value: `${(DEMO_ATHLETES.reduce((a,b)=>a+b.hrv,0)/DEMO_ATHLETES.length).toFixed(0)} ms`, bg: 'bg-blue-50 text-blue-600', icon: 'ki-heart-circle' },
          { label: 'В зоне риска',      value: DEMO_ATHLETES.filter(a=>a.risk!=='low').length, bg: 'bg-orange-50 text-orange-500', icon: 'ki-warning-2' },
          { label: 'Всего тренировок',  value: DEMO_ATHLETES.reduce((a,b)=>a+b.sessions,0), bg: 'bg-violet-50 text-violet-600', icon: 'ki-calendar' },
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

      {/* Team status grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {DEMO_ATHLETES.map(a => {
          const rc = recoveryColor(a.recovery)
          return (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex flex-col items-center gap-2 hover:border-orange-200 transition-all">
              <RecoveryRing score={a.recovery} size={72} />
              <div className="text-center">
                <div className="text-2sm font-semibold text-foreground">{a.name.split(' ')[0]}</div>
                <div className="text-2xs text-muted-foreground">{a.sport}</div>
              </div>
              <div className="flex gap-3 text-center w-full">
                <div className="flex-1">
                  <div className="text-2xs font-bold text-blue-600">{a.hrv}</div>
                  <div className="text-[9px] text-muted-foreground">HRV</div>
                </div>
                <div className="flex-1">
                  <div className="text-2xs font-bold text-foreground">{a.sessions}</div>
                  <div className="text-[9px] text-muted-foreground">тренировок</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">Недельная нагрузка по атлетам</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">Сравнение за 8 недель</p>
          </div>
          <ApexChart type="bar"
            series={[
              { name: 'Sara K.', data: DEMO_GROUP.map(g=>g.SK) },
              { name: 'Marcus W.', data: DEMO_GROUP.map(g=>g.MW) },
              { name: 'James T.', data: DEMO_GROUP.map(g=>g.JT) },
              { name: 'Linh N.', data: DEMO_GROUP.map(g=>g.LN) },
            ]}
            options={groupBar} height={220} />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-foreground">Сравнение нагрузок (радар)</h3>
            <p className="text-2xs text-muted-foreground mt-0.5">Нормализованные метрики атлетов</p>
          </div>
          <ApexChart type="radar"
            series={[
              { name: 'Sara K.',   data: [65, 47, 42, 72, 78, 50] },
              { name: 'Marcus W.', data: [82, 62, 82, 88, 84, 100] },
              { name: 'James T.', data: [72, 32, 63, 73, 76, 73] },
              { name: 'Linh N.', data: [78, 100, 80, 81, 87, 91] },
            ]}
            options={loadCompare} height={220} />
        </div>
      </div>
    </div>
  )
}

function AthleteAnalytics() {
  const [period, setPeriod] = useState('7d')

  const areaOpts = {
    chart: { type: 'area' as const, toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: 2.5 },
    colors: ['#F97316','#16A34A'],
    fill: { type: 'gradient', gradient: { opacityFrom: 0.12, opacityTo: 0.0 } },
    xaxis: { categories: DEMO_DAILY.map(d=>d.day), labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: [{ labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }, { opposite: true, labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } }],
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const sleepBar = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false }, stacked: true },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
    colors: ['#7C3AED','#C4B5FD','#EDE9FE'],
    xaxis: { categories: DEMO_DAILY.map(d=>d.day), labels: { style: { fontSize: '11px', colors: '#A1A1AA' } }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { labels: { style: { fontSize: '11px', colors: '#A1A1AA' } } },
    grid: { borderColor: '#F4F4F5', strokeDashArray: 3 },
    legend: { position: 'top' as const, fontFamily: 'DM Sans', fontSize: '12px' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  const donutOpts = {
    chart: { type: 'donut' as const, toolbar: { show: false }, animations: { enabled: false } },
    colors: ZC,
    labels: ['Z1 Восстановление','Z2 Аэробная','Z3 Темп','Z4 Порог','Z5 VO₂max'],
    legend: { position: 'bottom' as const, fontSize: '12px', fontFamily: 'DM Sans' },
    plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'Итого', fontSize: '13px', fontFamily: 'DM Sans', color: '#A1A1AA' } } } } },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' },
  }

  return (
    <div className="flex flex-col gap-5 pf-enter">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sara Kowalski · USER_00011</p>
          <h2 className="pf-num text-[36px] text-foreground leading-none">Аналитика</h2>
        </div>
        <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-lg">
          {PERIOD_OPTS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-2sm font-medium transition-all ${period===p?'bg-orange-50 text-orange-600':'text-muted-foreground hover:text-foreground'}`}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Ср. восстановление', value: '62%',   bg: 'bg-green-50 text-green-600',  icon: 'ki-abstract-26' },
          { label: 'Ср. ВСР',           value: '47 ms', bg: 'bg-blue-50 text-blue-600',    icon: 'ki-heart-circle' },
          { label: 'Ср. нагрузка',      value: '10.4',  bg: 'bg-orange-50 text-orange-500',icon: 'ki-chart-line-up' },
          { label: 'Ср. сон',           value: '7.8 ч', bg: 'bg-violet-50 text-violet-600',icon: 'ki-moon' },
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

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-3"><h3 className="text-sm font-semibold text-foreground">Восстановление и нагрузка</h3><p className="text-2xs text-muted-foreground mt-0.5">Дневной тренд за неделю</p></div>
          <ApexChart type="area"
            series={[
              { name: 'Восстановление %', data: DEMO_DAILY.map(d=>d.recovery) },
              { name: 'Нагрузка',         data: DEMO_DAILY.map(d=>d.strain) },
            ]}
            options={areaOpts} height={200} />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-3"><h3 className="text-sm font-semibold text-foreground">Структура сна</h3><p className="text-2xs text-muted-foreground mt-0.5">Глубокий / REM / Лёгкий</p></div>
          <ApexChart type="bar"
            series={[
              { name: 'Глубокий', data: [1.2,1.5,0.9,1.8,1.3,2.0,1.5] },
              { name: 'REM',      data: [1.8,2.1,1.5,2.2,1.9,2.3,2.0] },
              { name: 'Лёгкий',  data: [4.0,4.1,3.4,3.7,3.8,4.3,4.8] },
            ]}
            options={sleepBar} height={200} />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="mb-3"><h3 className="text-sm font-semibold text-foreground">Распределение по зонам пульса</h3><p className="text-2xs text-muted-foreground mt-0.5">Время в каждой зоне за неделю</p></div>
          <ZoneBar zones={DEMO_HRZ} height={28} showLabels />
          <ApexChart type="donut" series={DEMO_HRZ} options={donutOpts} height={200} />
        </div>

        {/* Competitions */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Результаты соревнований</h3>
          </div>
          <div className="divide-y divide-border">
            {DEMO_COMPETITIONS.map((c, i) => {
              const statusLabel = c.status === 'completed' ? 'завершено' : c.status === 'planned' ? 'запланировано' : 'активно'
              const statusBg = c.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : c.status === 'planned' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'
              return (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-base">{c.status === 'completed' ? '🏁' : '🎯'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-2sm font-semibold text-foreground truncate">{c.name}</div>
                    <div className="text-2xs text-muted-foreground">{c.date} · {c.location} · {c.distance}</div>
                  </div>
                  {c.result && (
                    <div className="text-right shrink-0">
                      <div className="pf-num text-base text-foreground">{c.result}</div>
                      {c.position && <div className="text-2xs text-muted-foreground">#{c.position}</div>}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-full text-2xs font-semibold border capitalize ${statusBg}`}>{statusLabel}</span>
                    {c.pb && <span className="px-1.5 py-0.5 rounded-full text-2xs font-bold bg-orange-500 text-white">PB</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { user } = useUser()
  return user?.role === 'coach' ? <CoachAnalytics /> : <AthleteAnalytics />
}
