import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/StatCard'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { recoveryColor, strainColor, strainLabel, fmtDate } from '@/lib/utils/recovery'
import StrainChart from './StrainChart'
import Link from 'next/link'
import AthleteProfileCard from '@/components/ui/AthleteProfileCard'

const TYPE_COLOR: Record<string, string> = {
  Running: '#2563EB', Cycling: '#16A34A', Swimming: '#7C3AED', HIIT: '#DC2626',
  'Weight Training': '#F97316', CrossFit: '#D97706', Yoga: '#0D9488', Walking: '#64748B',
}
const TYPE_ICON: Record<string, string> = {
  Running: 'ki-abstract-26', Cycling: 'ki-car', Swimming: 'ki-drop', HIIT: 'ki-abstract-40',
  'Weight Training': 'ki-barcode', CrossFit: 'ki-abstract-28', Yoga: 'ki-abstract-33', Walking: 'ki-footprint-2',
}

export default async function AthleteDashboard({ userId, name }: { userId: string; name: string }) {
  const supabase = await createClient()

  const [{ data: metrics }, { data: workouts }, { data: comments }] = await Promise.all([
    supabase.from('daily_metrics').select('*').eq('athlete_id', userId).order('date', { ascending: false }).limit(56),
    supabase.from('workouts').select('*').eq('athlete_id', userId).order('event_date', { ascending: false }).limit(8),
    supabase.from('workout_comments').select('body, created_at').order('created_at', { ascending: false }).limit(3),
  ])

  const latest = metrics?.[0]
  const avg = (key: keyof typeof metrics[0]) =>
    metrics?.length ? Math.round(metrics.reduce((s, m) => s + ((m[key] as number) ?? 0), 0) / metrics.length * 10) / 10 : null
  const recovery = latest?.recovery_score ?? 0

  // Build weekly strain buckets (last 8 weeks)
  const weeklyData = Array.from({ length: 8 }, (_, wi) => {
    const now = new Date()
    const weekStart = new Date(now.getTime() - (7 - wi) * 7 * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    const wMetrics = metrics?.filter(m => {
      const d = new Date(m.date)
      return d >= weekStart && d < weekEnd
    }) ?? []
    return { w: `W${String(wi + 1).padStart(2, '0')}`, strain: parseFloat((wMetrics.reduce((s, m) => s + (m.day_strain ?? 0), 0)).toFixed(1)) }
  })

  return (
    <div className="flex flex-col gap-6 pf-page-enter">

      {/* ── PROFILE CARD ── */}
      <AthleteProfileCard />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Дашборд атлета</p>
          <h2 className="pf-num text-3xl text-slate-900 mt-0.5">
            {name.split(' ')[0]} {recovery >= 67 ? '🏃' : recovery >= 34 ? '⚡' : '😴'}
          </h2>
        </div>
        {latest && (
          <div className="card border border-[#E2E8F0] rounded-2xl px-6 py-4 flex items-center gap-5 bg-white shadow-sm">
            <RecoveryRing score={Math.round(recovery)} size={90} />
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">HRV</span>
                <span className="font-bold text-slate-800">{latest.hrv?.toFixed(1)} ms</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">ЧСС покоя</span>
                <span className="font-bold text-slate-800">{latest.resting_heart_rate?.toFixed(1)} bpm</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">Нагрузка</span>
                <span className="font-bold" style={{ color: strainColor(latest.day_strain ?? 0) }}>
                  {latest.day_strain?.toFixed(1)} · {strainLabel(latest.day_strain ?? 0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">Сон</span>
                <span className="font-bold text-slate-800">{latest.sleep_hours?.toFixed(1)} ч</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Ср. ВСР" value={avg('hrv') ?? '—'} unit="ms" icon="ki-graph-up" iconColor="#2563EB" sub="WHOOP метрика" />
        <StatCard label="ЧСС покоя" value={avg('resting_heart_rate') ?? '—'} unit="bpm" icon="ki-heart" iconColor="#DC2626" />
        <StatCard label="Ср. сон" value={avg('sleep_hours') ?? '—'} unit="ч" icon="ki-moon" iconColor="#7C3AED" />
        <StatCard label="Калорий/день" value={avg('calories_burned') ? Math.round(avg('calories_burned')!).toLocaleString() : '—'} unit="ккал" icon="ki-abstract-26" iconColor="#F97316" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card bg-white border border-[#E2E8F0] rounded-2xl p-5">
          <p className="pf-num text-lg text-slate-900 mb-0.5">Недельная нагрузка</p>
          <p className="text-xs text-slate-400 mb-4">WHOOP day_strain · последние 8 недель</p>
          <StrainChart data={weeklyData} />
        </div>

        <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
          <p className="pf-num text-lg text-slate-900 mb-0.5">Зоны пульса</p>
          <p className="text-xs text-slate-400 mb-4">По последним тренировкам</p>
          {workouts?.length ? (() => {
            const totals = [1,2,3,4,5].map(z => workouts.reduce((s, w) => s + ((w as Record<string,number>)[`hr_zone_${z}_min`] ?? 0), 0))
            const grand = totals.reduce((a,b) => a+b, 0) || 1
            const pcts = totals.map(t => Math.round(t/grand*100))
            const COLORS = ['#60A5FA','#34D399','#FBBF24','#F97316','#EF4444']
            const LABELS = ['Z1 Восстановление','Z2 Аэробная','Z3 Темп','Z4 Порог','Z5 VO₂max']
            return (
              <div className="flex flex-col gap-3">
                {LABELS.map((lbl,i) => (
                  <div key={lbl}>
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[i] }} />{lbl}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{pcts[i]}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className="h-full rounded-full" style={{ width:`${pcts[i]}%`, background:COLORS[i] }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })() : <p className="text-sm text-slate-400">Нет данных о тренировках</p>}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="pf-num text-lg text-slate-900">Последние тренировки</p>
          <Link href="/diary" className="text-xs text-[#2563EB] hover:underline font-medium flex items-center gap-1">
            Показать все <i className="ki-filled ki-arrow-right text-[10px]" />
          </Link>
        </div>
        {!workouts?.length ? (
          <div className="text-center py-10 text-slate-400">
            <i className="ki-filled ki-book-open text-3xl mb-2 block" />
            <p className="text-sm">Тренировок пока нет. <Link href="/diary" className="text-[#2563EB] hover:underline">Добавить первую</Link></p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {workouts.slice(0,6).map(w => {
              const tc = TYPE_COLOR[w.activity_type??''] ?? '#64748B'
              const ti = TYPE_ICON[w.activity_type??''] ?? 'ki-abstract-26'
              const strain = w.activity_strain ?? 0
              const zones = [w.hr_zone_1_min,w.hr_zone_2_min,w.hr_zone_3_min,w.hr_zone_4_min,w.hr_zone_5_min]
              return (
                <div key={w.id} className="py-3.5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc+'18' }}>
                    <i className={`ki-filled ${ti} text-lg`} style={{ color: tc }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{w.activity_type ?? w.event_type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:strainColor(strain)+'18', color:strainColor(strain) }}>
                        {strainLabel(strain)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      <span>{fmtDate(w.event_date)}</span>
                      {w.activity_duration_min && <span>{w.activity_duration_min} мин</span>}
                      {w.avg_heart_rate && <span>{w.avg_heart_rate} bpm ср.</span>}
                      {w.activity_calories && <span>{w.activity_calories} ккал</span>}
                    </div>
                    {zones.some(v=>(v??0)>0) && <div className="mt-2 w-40"><ZoneBar zones={zones} height={4}/></div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-xl leading-none" style={{ color:strainColor(strain) }}>{strain.toFixed(1)}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">нагрузка</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {comments?.length ? (
        <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
          <p className="pf-num text-lg text-slate-900 mb-4">Заметки тренера</p>
          <div className="flex flex-col gap-3">
            {comments.map((c,i) => (
              <div key={i} className="p-3.5 rounded-xl text-sm text-slate-600 leading-relaxed" style={{ background:'#F8FAFC', borderLeft:'3px solid #F97316' }}>
                {c.body}
                <div className="text-[10px] text-slate-400 mt-1">{fmtDate(c.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
