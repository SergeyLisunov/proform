import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/StatCard'
import { ZoneBar } from '@/components/ui/ZoneBar'
import { strainColor, strainLabel, fmtDate } from '@/lib/utils/recovery'
import StrainChart from './StrainChart'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, ChartCard } from '@/components/ui/metronic'
import type { Database } from '@/types/database'

const AthleteHeroBar          = dynamic(() => import('@/components/athlete/AthleteHeroBar'),       { ssr: false })
const DailyWellnessCard       = dynamic(() => import('@/components/athlete/DailyWellnessCard'),    { ssr: false })
const MyRecommendationsCard   = dynamic(() => import('@/components/athlete/MyRecommendationsCard'), { ssr: false })
const AthleteQuickActions     = dynamic(() => import('@/components/athlete/AthleteQuickActions'),  { ssr: false })
const AthleteActiveAlerts     = dynamic(() => import('@/components/athlete/AthleteActiveAlerts'),  { ssr: false })
const AthleteTodayPlan        = dynamic(() => import('@/components/athlete/AthleteTodayPlan'),     { ssr: false })
const AthletePersonalAcwr     = dynamic(() => import('@/components/athlete/AthletePersonalAcwr'),  { ssr: false })
const AthleteDeviceStatus     = dynamic(() => import('@/components/athlete/AthleteDeviceStatus'),  { ssr: false })
const AthleteConnectionsPanel = dynamic(
  () => import('@/components/ui/AthleteConnectionsPanel').then(m => m.AthleteConnectionsPanel),
  { ssr: false },
)
const AthleteFeedbackCard     = dynamic(() => import('@/components/ui/AthleteFeedbackCard'),       { ssr: false })
const AthletePassportPanel    = dynamic(() => import('@/components/athlete/AthletePassportPanel'), { ssr: false })
import AthleteDiscoverCTA from '@/components/athlete/AthleteDiscoverCTA'
import AthleteAdherenceCard, { type AdherenceNudgeRow } from '@/components/athlete/AthleteAdherenceCard'

type DailyMetricRow = Database['public']['Tables']['daily_metrics']['Row']
type WorkoutRow = Database['public']['Tables']['workouts']['Row']
type WorkoutCommentRow = Database['public']['Tables']['workout_comments']['Row']
type AverageMetricKey = 'hrv' | 'resting_heart_rate' | 'sleep_hours' | 'calories_burned'

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

  // W11 Day 56: workout_nudges from W8 Day 40 — gate the adherence card
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const [
    { data: metricsData },
    { data: workoutsData },
    { data: commentsData },
    { count: connectionsCount },
    { data: nudgesData },
  ] = await Promise.all([
    supabase.from('daily_metrics').select('*').eq('athlete_id', userId).order('date', { ascending: false }).limit(56),
    supabase.from('workouts').select('*').eq('athlete_id', userId).order('event_date', { ascending: false }).limit(8),
    supabase.from('workout_comments').select('body, created_at').order('created_at', { ascending: false }).limit(3),
    // W9 Day 47: count accepted coach-athlete connections to gate the discover CTA
    supabase.from('trainer_athletes')
      .select('id', { count: 'exact', head: true })
      .eq('athlete_id', userId).eq('status', 'accepted'),
    // W11 Day 56: recent adherence nudges (W8 Day 40 log) — last 30 days, newest-first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('workout_nudges')
      .select('id, nudge_type, sent_at, payload')
      .eq('athlete_id', userId)
      .gte('sent_at', thirtyDaysAgo)
      .order('sent_at', { ascending: false })
      .limit(5),
  ])
  const hasNoConnections = (connectionsCount ?? 0) === 0
  const nudges = (nudgesData ?? []) as AdherenceNudgeRow[]
  const metrics = (metricsData ?? []) as DailyMetricRow[]
  const workouts = (workoutsData ?? []) as WorkoutRow[]
  const comments = (commentsData ?? []) as Pick<WorkoutCommentRow, 'body' | 'created_at'>[]

  const latest = metrics[0]
  const avg = (key: AverageMetricKey): number | null =>
    metrics.length
      ? Math.round(metrics.reduce((s, m) => s + (m[key] ?? 0), 0) / metrics.length * 10) / 10
      : null

  // Build weekly strain buckets (last 8 weeks)
  const weeklyData = Array.from({ length: 8 }, (_, wi) => {
    const now = new Date()
    const weekStart = new Date(now.getTime() - (7 - wi) * 7 * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    const wMetrics = metrics.filter(m => {
      const d = new Date(m.date)
      return d >= weekStart && d < weekEnd
    })
    return {
      w: `W${String(wi + 1).padStart(2, '0')}`,
      strain: parseFloat((wMetrics.reduce((s, m) => s + (m.day_strain ?? 0), 0)).toFixed(1)),
    }
  })

  const firstName = name.split(' ')[0] || name

  return (
    <div className="flex flex-col gap-5 pf-page-enter">

      {/* 1. HERO — приветствие + recovery + ключевые метрики */}
      <AthleteHeroBar
        firstName={firstName}
        metrics={latest ? {
          recovery_score: latest.recovery_score ?? null,
          hrv: latest.hrv ?? null,
          resting_heart_rate: latest.resting_heart_rate ?? null,
          day_strain: latest.day_strain ?? null,
          sleep_hours: latest.sleep_hours ?? null,
        } : null}
      />

      {/* W9 Day 47: discover CTA — only when athlete has zero coach connections */}
      <AthleteDiscoverCTA hasNoConnections={hasNoConnections} />

      {/* W11 Day 56: adherence widget — only renders if athlete has nudges in last 30d */}
      <AthleteAdherenceCard nudges={nudges} />

      {/* 1.5. DAILY WELLNESS CHECK-IN — Sprint W1 Day 3, ритуал утра */}
      <DailyWellnessCard athleteId={userId} />

      {/* 1.6. MY RECOMMENDATIONS — Sprint W2 Day 9, structured recs from doctor */}
      <MyRecommendationsCard athleteId={userId} />

      {/* 2. ACTIVE ALERTS — рендерится только при наличии травм/истекающих абонементов */}
      <AthleteActiveAlerts athleteId={userId} />

      {/* 3. QUICK ACTIONS — 5 крупных кнопок самых частых сценариев */}
      <AthleteQuickActions />

      {/* 4. PLAN + PERSONAL ACWR — двухколоночный приоритетный блок */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AthleteTodayPlan athleteId={userId} />
        </div>
        <AthletePersonalAcwr athleteId={userId} />
      </div>

      {/* 5. CARE TEAM — тренер, врач, команда, абонементы */}
      <AthleteConnectionsPanel userId={userId} />

      {/* 6. DEVICE STATUS — компактная полоса */}
      <AthleteDeviceStatus athleteId={userId} />

      {/* 7. STATS — средние за период */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pf-stagger">
        <StatCard label="Ср. ВСР"   value={avg('hrv') ?? '—'}                                                                                    unit="мс"        icon="ki-graph-up"    iconColor="#2563EB" sub="WHOOP метрика" />
        <StatCard label="ЧСС покоя" value={avg('resting_heart_rate') ?? '—'}                                                                     unit="bpm"       icon="ki-heart"       iconColor="#DC2626" />
        <StatCard label="Ср. сон"   value={avg('sleep_hours') ?? '—'}                                                                            unit="ч"         icon="ki-moon"        iconColor="#7C3AED" />
        <StatCard label="Калории"   value={avg('calories_burned') ? Math.round(avg('calories_burned')!).toLocaleString() : '—'}                  unit="ккал/день" icon="ki-abstract-26" iconColor="#F97316" />
      </div>

      {/* 8. CHARTS — нагрузка и пульсовые зоны */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard className="lg:col-span-2" title="Недельная нагрузка" subtitle="Суммарный day_strain · последние 8 недель">
          <StrainChart data={weeklyData} />
        </ChartCard>

        <Card className="p-5">
          <p className="pf-num text-lg text-slate-900 mb-0.5">Пульсовые зоны</p>
          <p className="text-xs text-slate-400 mb-4">По последним тренировкам</p>
          {workouts.length ? (() => {
            const totals = [1, 2, 3, 4, 5].map(z => workouts.reduce((s, w) => s + ((w as unknown as Record<string, number>)[`hr_zone_${z}_min`] ?? 0), 0))
            const grand = totals.reduce((a, b) => a + b, 0) || 1
            const pcts = totals.map(t => Math.round(t / grand * 100))
            const COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F97316', '#EF4444']
            const LABELS = ['Z1 Восстановление', 'Z2 Аэробная', 'Z3 Темп', 'Z4 Порог', 'Z5 VO₂max']
            return (
              <div className="flex flex-col gap-3">
                {LABELS.map((lbl, i) => (
                  <div key={lbl}>
                    <div className="flex justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="w-2 h-2 rounded-sm" style={{ background: COLORS[i] }} />{lbl}
                      </span>
                      <span className="text-xs font-bold text-slate-700">{pcts[i]}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div className="h-full rounded-full" style={{ width: `${pcts[i]}%`, background: COLORS[i] }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })() : <p className="text-sm text-slate-400">Нет данных о тренировках</p>}
        </Card>
      </div>

      {/* 9. RECENT SESSIONS */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="pf-num text-lg text-slate-900">Последние тренировки</p>
          <Link href="/diary" className="text-xs text-[#2563EB] hover:underline font-medium flex items-center gap-1">
            Показать все <i className="ki-filled ki-arrow-right text-[10px]" />
          </Link>
        </div>
        {!workouts.length ? (
          <div className="text-center py-10 text-slate-400">
            <i className="ki-filled ki-book-open text-3xl mb-2 block" />
            <p className="text-sm">Тренировок пока нет. <Link href="/diary" className="text-[#2563EB] hover:underline">Добавить первую</Link></p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {workouts.slice(0, 6).map(w => {
              const tc = TYPE_COLOR[w.activity_type ?? ''] ?? '#64748B'
              const ti = TYPE_ICON[w.activity_type ?? ''] ?? 'ki-abstract-26'
              const strain = w.activity_strain ?? 0
              const zones = [w.hr_zone_1_min, w.hr_zone_2_min, w.hr_zone_3_min, w.hr_zone_4_min, w.hr_zone_5_min]
              return (
                <div key={w.id} className="py-3.5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc + '18' }}>
                    <i className={`ki-filled ${ti} text-lg`} style={{ color: tc }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{w.activity_type ?? w.event_type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: strainColor(strain) + '18', color: strainColor(strain) }}>
                        {strainLabel(strain)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                      <span>{fmtDate(w.event_date)}</span>
                      {w.activity_duration_min && <span>{w.activity_duration_min} мин</span>}
                      {w.avg_heart_rate && <span>{w.avg_heart_rate} bpm ср.</span>}
                      {w.activity_calories && <span>{w.activity_calories} ккал</span>}
                    </div>
                    {zones.some(v => (v ?? 0) > 0) && <div className="mt-2 w-40"><ZoneBar zones={zones} height={4} /></div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pf-num text-xl leading-none" style={{ color: strainColor(strain) }}>{strain.toFixed(1)}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">нагрузка</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* 10. COACH FEEDBACK — последние комментарии тренера к тренировкам */}
      <AthleteFeedbackCard userId={userId} />

      {/* 11. COACH NOTES — отдельные текстовые заметки */}
      {comments.length ? (
        <Card className="p-5">
          <p className="pf-num text-lg text-slate-900 mb-4">Заметки тренера</p>
          <div className="flex flex-col gap-3">
            {comments.map((c, i) => (
              <div key={i} className="p-3.5 rounded-xl text-sm text-slate-600 leading-relaxed" style={{ background: '#F8FAFC', borderLeft: '3px solid #F97316' }}>
                {c.body}
                <div className="text-[10px] text-slate-400 mt-1">{fmtDate(c.created_at ?? '')}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* 12. PASSPORT — utility-блок, в самом низу */}
      <AthletePassportPanel userId={userId} />
    </div>
  )
}
