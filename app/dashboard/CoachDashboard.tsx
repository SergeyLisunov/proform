import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/StatCard'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { recoveryColor, initials, fmtDate } from '@/lib/utils/recovery'
import Link from 'next/link'
import CoachFeedbackFeed from '@/components/ui/CoachFeedbackFeed'
import PrescribeWorkoutButton from '@/components/ui/PrescribeWorkoutButton'
import ReferralPanel from '@/components/coach/ReferralPanel'
import type { Database } from '@/types/database'

type TrainerAthleteRow = Database['public']['Tables']['trainer_athletes']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type DailyMetricRow = Database['public']['Tables']['daily_metrics']['Row']
type ObservationDiaryRow = Database['public']['Tables']['observation_diary']['Row']

export default async function CoachDashboard({ userId, name }: { userId: string; name: string }) {
  const supabase = await createClient()

  // Get coach's athletes
  const { data: linksData } = await supabase.from('trainer_athletes').select('athlete_id').eq('trainer_id', userId)
  const links = (linksData ?? []) as Pick<TrainerAthleteRow, 'athlete_id'>[]
  const athleteIds = links.map((link) => link.athlete_id)

  const { data: athletesData } = athleteIds.length
    ? await supabase.from('users').select('id, name').in('id', athleteIds)
    : { data: [] }
  const athletes = (athletesData ?? []) as Pick<UserRow, 'id' | 'name'>[]

  // Get latest metrics for each athlete
  const metricsMap: Record<string, { recovery: number; hrv: number; rhr: number; strain: number; sleep: number }> = {}
  await Promise.all(
    athletes.map(async (a) => {
      const { data } = await supabase.from('daily_metrics').select('recovery_score, hrv, resting_heart_rate, day_strain, sleep_hours').eq('athlete_id', a.id).order('date', { ascending: false }).limit(1).single()
      const metric = data as Pick<DailyMetricRow, 'recovery_score' | 'hrv' | 'resting_heart_rate' | 'day_strain' | 'sleep_hours'> | null
      if (metric) metricsMap[a.id] = { recovery: metric.recovery_score ?? 0, hrv: metric.hrv ?? 0, rhr: metric.resting_heart_rate ?? 0, strain: metric.day_strain ?? 0, sleep: metric.sleep_hours ?? 0 }
    })
  )

  // Recent observation diary
  const { data: diaryData } = await supabase.from('observation_diary').select('*').eq('coach_id', userId).order('created_at', { ascending: false }).limit(4)
  const diary = (diaryData ?? []) as ObservationDiaryRow[]

  // Pending connection requests (athletes asking to join)
  const { data: pendingRaw } = await supabase
    .from('connections')
    .select('id, initiator_id, created_at')
    .eq('recipient_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)
  const pendingConnections = (pendingRaw ?? []) as Array<{ id: string; initiator_id: string; created_at: string }>
  const initiatorIds = pendingConnections.map(p => p.initiator_id)
  const { data: initiatorsData } = initiatorIds.length
    ? await supabase.from('users').select('id, name, avatar_url').in('id', initiatorIds)
    : { data: [] as Array<{ id: string; name: string | null; avatar_url: string | null }> }
  const initiatorsById = new Map((initiatorsData ?? []).map(u => [u.id, u]))
  const pending = pendingConnections.map(p => ({ ...p, user: initiatorsById.get(p.initiator_id) ?? null }))

  const avgRecovery = Object.values(metricsMap).length ? Math.round(Object.values(metricsMap).reduce((s, m) => s + m.recovery, 0) / Object.values(metricsMap).length) : 0

  const AT_COLORS = ['#2563EB','#F97316','#16A34A','#7C3AED','#D97706','#DC2626']

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Дашборд тренера</p>
        <h2 className="pf-num text-3xl text-slate-900 mt-0.5">{name}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="Мои атлеты" value={athletes?.length ?? 0} icon="ki-people" iconColor="#2563EB" />
        <StatCard label="Ср. восстановление" value={avgRecovery + '%'} icon="ki-graph-up" iconColor={recoveryColor(avgRecovery)} />
        <StatCard label="Записей в дневнике" value={diary?.length ?? 0} icon="ki-notepad-edit" iconColor="#7C3AED" sub="эта неделя" />
        <StatCard label="Заявки в связи" value={pending.length} icon="ki-message-question" iconColor="#F97316" sub={pending.length > 0 ? 'ждут ответа' : 'новых нет'} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/athletes/load"
          className="inline-flex items-center gap-2 rounded-xl border border-[#FECACA] bg-gradient-to-r from-[#FEF2F2] to-white px-4 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]">
          <i className="ki-filled ki-shield-cross text-xs"/>
          ACWR атлетов — риск травмы →
        </Link>
      </div>

      {pending.length > 0 && (
        <div className="rounded-2xl border border-[#FED7AA] bg-gradient-to-r from-[#FFF7ED] to-white p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ki-filled ki-message-question text-sm" style={{ color: '#EA580C' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Новые заявки от атлетов</p>
                <p className="text-[11px] text-slate-500">Примите или отклоните в разделе &laquo;Мои связи&raquo;</p>
              </div>
            </div>
            <Link href="/connections" className="text-xs font-semibold text-[#EA580C] hover:underline">Открыть →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {pending.slice(0, 3).map(p => (
              <Link key={p.id} href="/connections" className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2 hover:bg-white">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden" style={{ background: '#F97316' }}>
                  {p.user?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials(p.user?.name ?? '?')
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 truncate">{p.user?.name ?? 'Атлет'}</div>
                  <div className="text-[11px] text-slate-400">{fmtDate(p.created_at)}</div>
                </div>
                <i className="ki-filled ki-right text-xs text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <ReferralPanel myRole="coach" />

      <CoachFeedbackFeed coachId={userId} />

      {/* Athlete cards */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="pf-num text-xl text-slate-900">Мои атлеты</p>
          <div className="flex items-center gap-3">
            <PrescribeWorkoutButton
              coachId={userId}
              athletes={athletes.map(a => ({ id: a.id, name: a.name ?? '—' }))}
            />
            <Link href="/athletes" className="text-xs text-[#2563EB] hover:underline font-medium">Управление атлетами →</Link>
          </div>
        </div>
        {!athletes.length ? (
          <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center text-slate-400">
            <i className="ki-filled ki-people text-4xl block mb-3" />
            <p className="text-sm">Атлеты ещё не назначены.</p>
            <p className="text-xs mt-1">Обратитесь к администратору для привязки атлетов.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {athletes.map((a, i) => {
              const m = metricsMap[a.id]
              const color = AT_COLORS[i % AT_COLORS.length]
              return (
                <Link key={a.id} href={`/athletes/${a.id}`} className="card bg-white border border-[#E2E8F0] rounded-2xl p-5 hover:border-[#2563EB] transition-colors block">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: color }}>
                      {initials(a.name)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{a.name}</div>
                      <div className="text-xs text-slate-400">Атлет</div>
                    </div>
                    {m && <div className="ml-auto"><RecoveryRing score={Math.round(m.recovery)} size={60} /></div>}
                  </div>
                  {m ? (
                    <div className="grid grid-cols-4 gap-2">
                      {[{ v: m.hrv.toFixed(1), u:'ВСР мс', c:'#2563EB' }, { v: m.rhr.toFixed(1), u:'ЧСС покоя', c:'#DC2626' }, { v: m.sleep.toFixed(1), u:'Сон ч', c:'#7C3AED' }, { v: m.strain.toFixed(1), u:'Нагрузка', c:'#F97316' }]
                        .map(({ v, u, c }) => (
                          <div key={u} className="text-center py-2 px-1 rounded-lg" style={{ background:'#F8FAFC' }}>
                            <div className="pf-num text-lg leading-none" style={{ color: c }}>{v}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{u}</div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Нет данных метрик</p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Observation diary */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="pf-num text-xl text-slate-900">Дневник наблюдений</p>
          <Link href="/diary" className="text-xs text-[#2563EB] hover:underline font-medium">Показать все →</Link>
        </div>
        {!diary?.length ? (
          <p className="text-sm text-slate-400 py-4">Наблюдений пока нет. <Link href="/diary" className="text-[#2563EB] hover:underline">Добавить первое</Link></p>
        ) : (
          <div className="flex flex-col gap-3">
            {diary.map((d) => {
              const ath = athletes.find((a) => a.id === d.athlete_id)
              return (
                <div key={d.id} className="p-4 rounded-xl" style={{ background:'#F8FAFC', borderLeft:'3px solid #F97316' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {ath && <span className="text-xs font-bold text-[#F97316]">{ath.name}</span>}
                      {d.tags?.length > 0 && d.tags.map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background:'#FFEDD5', color:'#F97316' }}>{t}</span>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(d.date)}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{d.note}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
