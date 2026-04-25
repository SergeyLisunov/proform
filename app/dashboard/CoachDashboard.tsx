import { createClient } from '@/lib/supabase/server'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { initials, fmtDate } from '@/lib/utils/recovery'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import CoachFeedbackFeed from '@/components/ui/CoachFeedbackFeed'
import ReferralPanel from '@/components/coach/ReferralPanel'
import type { Database } from '@/types/database'

const CoachHeroBar          = dynamic(() => import('@/components/coach/CoachHeroBar'),         { ssr: false })
const CoachQuickActions     = dynamic(() => import('@/components/coach/CoachQuickActions'),    { ssr: false })
const CoachTodaySchedule    = dynamic(() => import('@/components/coach/CoachTodaySchedule'),   { ssr: false })
const CoachAtRiskAthletes   = dynamic(() => import('@/components/coach/CoachAtRiskAthletes'),  { ssr: false })

type TrainerAthleteRow = Database['public']['Tables']['trainer_athletes']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type DailyMetricRow = Database['public']['Tables']['daily_metrics']['Row']
type ObservationDiaryRow = Database['public']['Tables']['observation_diary']['Row']

export default async function CoachDashboard({ userId, name }: { userId: string; name: string }) {
  const supabase = await createClient()

  const { data: linksData } = await supabase
    .from('trainer_athletes').select('athlete_id')
    .eq('trainer_id', userId).eq('status', 'accepted')
  const links = (linksData ?? []) as Pick<TrainerAthleteRow, 'athlete_id'>[]
  const athleteIds = links.map(l => l.athlete_id)

  const { data: athletesData } = athleteIds.length
    ? await supabase.from('users').select('id, name').in('id', athleteIds)
    : { data: [] }
  const athletes = (athletesData ?? []) as Pick<UserRow, 'id' | 'name'>[]

  // Latest metrics per athlete
  const metricsMap: Record<string, { recovery: number; hrv: number; rhr: number; strain: number; sleep: number }> = {}
  await Promise.all(
    athletes.map(async (a) => {
      const { data } = await supabase
        .from('daily_metrics')
        .select('recovery_score, hrv, resting_heart_rate, day_strain, sleep_hours')
        .eq('athlete_id', a.id)
        .order('date', { ascending: false }).limit(1).maybeSingle()
      const metric = data as Pick<DailyMetricRow, 'recovery_score' | 'hrv' | 'resting_heart_rate' | 'day_strain' | 'sleep_hours'> | null
      if (metric) {
        metricsMap[a.id] = {
          recovery: metric.recovery_score ?? 0, hrv: metric.hrv ?? 0,
          rhr: metric.resting_heart_rate ?? 0, strain: metric.day_strain ?? 0,
          sleep: metric.sleep_hours ?? 0,
        }
      }
    }),
  )

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const { data: diaryWeekData } = await supabase
    .from('observation_diary').select('id')
    .eq('coach_id', userId).gte('date', sevenDaysAgo)
  const diaryThisWeekCount = (diaryWeekData ?? []).length

  const { data: diaryData } = await supabase
    .from('observation_diary').select('*')
    .eq('coach_id', userId).order('created_at', { ascending: false }).limit(4)
  const diary = (diaryData ?? []) as ObservationDiaryRow[]

  const { data: pendingRaw } = await supabase
    .from('connections').select('id, initiator_id, created_at')
    .eq('recipient_id', userId).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(5)
  const pendingConnections = (pendingRaw ?? []) as Array<{ id: string; initiator_id: string; created_at: string }>
  const initiatorIds = pendingConnections.map(p => p.initiator_id)
  const { data: initiatorsData } = initiatorIds.length
    ? await supabase.from('users').select('id, name, avatar_url').in('id', initiatorIds)
    : { data: [] as Array<{ id: string; name: string | null; avatar_url: string | null }> }
  const initiatorsById = new Map((initiatorsData ?? []).map(u => [u.id, u]))
  const pending = pendingConnections.map(p => ({ ...p, user: initiatorsById.get(p.initiator_id) ?? null }))

  const recoveryValues = Object.values(metricsMap).map(m => m.recovery).filter(v => v > 0)
  const avgRecovery = recoveryValues.length
    ? Math.round(recoveryValues.reduce((s, v) => s + v, 0) / recoveryValues.length)
    : 0

  const firstName = name.split(' ')[0] || name
  const AT_COLORS = ['#2563EB', '#F97316', '#16A34A', '#7C3AED', '#D97706', '#DC2626']

  const athletesForActions = athletes.map(a => ({ id: a.id, name: a.name ?? '—' }))

  return (
    <div className="flex flex-col gap-5 pf-page-enter">

      {/* 1. HERO */}
      <CoachHeroBar
        firstName={firstName}
        stats={{
          athletesCount: athletes.length,
          avgRecovery,
          pendingRequests: pending.length,
          weekDiaryEntries: diaryThisWeekCount,
        }}
      />

      {/* 2. AT-RISK ATHLETES */}
      <CoachAtRiskAthletes coachId={userId} />

      {/* 3. QUICK ACTIONS */}
      <CoachQuickActions coachId={userId} athletes={athletesForActions} />

      {/* 4. TODAY'S SCHEDULE + PENDING REQUESTS / REFERRAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CoachTodaySchedule coachId={userId} />
        </div>

        {pending.length > 0 ? (
          <div className="rounded-2xl border border-[#FED7AA] bg-gradient-to-br from-[#FFF7ED] to-white p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-700">Заявки</p>
                <h3 className="text-base font-bold text-foreground">Новые — {pending.length}</h3>
              </div>
              <Link href="/connections" className="text-[11px] font-semibold text-orange-600 hover:underline">
                Все →
              </Link>
            </div>
            <div className="space-y-1.5">
              {pending.slice(0, 4).map(p => (
                <Link key={p.id} href="/connections"
                  className="flex items-center gap-2.5 rounded-xl bg-white/80 px-2.5 py-2 hover:bg-white border border-transparent hover:border-orange-200">
                  <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: '#F97316' }}>
                    {p.user?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initials(p.user?.name ?? '?')
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold text-slate-800 truncate">{p.user?.name ?? 'Атлет'}</div>
                    <div className="text-[10px] text-slate-400">{fmtDate(p.created_at)}</div>
                  </div>
                  <i className="ki-filled ki-right text-[10px] text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <ReferralPanel myRole="coach" />
        )}
      </div>

      {/* 5. ATHLETE GRID */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="pf-num text-xl text-slate-900">Мои атлеты</p>
          <Link href="/athletes" className="text-xs text-[#2563EB] hover:underline font-medium">
            Управление →
          </Link>
        </div>
        {!athletes.length ? (
          <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center text-slate-400">
            <i className="ki-filled ki-people text-4xl block mb-3" />
            <p className="text-sm">Атлеты ещё не назначены.</p>
            <p className="text-xs mt-1">Пригласите атлета через раздел «Сеть».</p>
            <Link href="/network" className="mt-4 inline-block rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold">
              Найти атлетов
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {athletes.map((a, i) => {
              const m = metricsMap[a.id]
              const color = AT_COLORS[i % AT_COLORS.length]
              return (
                <Link key={a.id} href={`/athletes/${a.id}`}
                  className="card bg-white border border-[#E2E8F0] rounded-2xl p-4 hover:border-[#2563EB] transition-colors block">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: color }}>
                      {initials(a.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{a.name}</div>
                      <div className="text-xs text-slate-400">Атлет</div>
                    </div>
                    {m && <RecoveryRing score={Math.round(m.recovery)} size={48} />}
                  </div>
                  {m ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { v: m.hrv.toFixed(1),    u: 'ВСР мс',     c: '#2563EB' },
                        { v: m.rhr.toFixed(0),    u: 'ЧСС покоя',  c: '#DC2626' },
                        { v: m.sleep.toFixed(1),  u: 'Сон ч',      c: '#7C3AED' },
                        { v: m.strain.toFixed(1), u: 'Strain',     c: '#F97316' },
                      ].map(({ v, u, c }) => (
                        <div key={u} className="text-center py-1.5 px-1 rounded-lg" style={{ background: '#F8FAFC' }}>
                          <div className="pf-num text-base leading-none" style={{ color: c }}>{v}</div>
                          <div className="text-[8px] text-slate-400 mt-0.5 uppercase tracking-wider truncate">{u}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Нет данных метрик. Атлет ещё не подключил устройство.</p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* 6. FEEDBACK FEED */}
      <CoachFeedbackFeed coachId={userId} />

      {/* 7. RECENT DIARY ENTRIES */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="pf-num text-xl text-slate-900">Дневник наблюдений</p>
          <Link href="/diary" className="text-xs text-[#2563EB] hover:underline font-medium">Все записи →</Link>
        </div>
        {!diary?.length ? (
          <div className="text-sm text-slate-400 py-6 text-center">
            <p>Наблюдений пока нет.</p>
            <Link href="/diary" className="text-[#2563EB] hover:underline text-xs">Добавить первое →</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {diary.map(d => {
              const ath = athletes.find(a => a.id === d.athlete_id)
              return (
                <div key={d.id} className="p-3.5 rounded-xl" style={{ background: '#F8FAFC', borderLeft: '3px solid #F97316' }}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ath && <span className="text-xs font-bold text-[#F97316]">{ath.name}</span>}
                      {d.tags?.length > 0 && d.tags.map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#FFEDD5', color: '#F97316' }}>{t}</span>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(d.date)}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">{d.note}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 8. REFERRAL — bottom когда заявки уже отрисованы выше */}
      {pending.length > 0 && <ReferralPanel myRole="coach" />}
    </div>
  )
}
