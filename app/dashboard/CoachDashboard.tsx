import { createClient } from '@/lib/supabase/server'
import { StatCard } from '@/components/ui/StatCard'
import { RecoveryRing } from '@/components/ui/RecoveryRing'
import { recoveryColor, initials, fmtDate } from '@/lib/utils/recovery'
import Link from 'next/link'

export default async function CoachDashboard({ userId, name }: { userId: string; name: string }) {
  const supabase = await createClient()

  // Get coach's athletes
  const { data: links } = await supabase.from('trainer_athletes').select('athlete_id').eq('trainer_id', userId)
  const athleteIds = links?.map(l => l.athlete_id) ?? []

  const { data: athletes } = athleteIds.length ? await supabase.from('users').select('id, name').in('id', athleteIds) : { data: [] }

  // Get latest metrics for each athlete
  const metricsMap: Record<string, { recovery: number; hrv: number; rhr: number; strain: number; sleep: number }> = {}
  await Promise.all(
    (athletes ?? []).map(async a => {
      const { data } = await supabase.from('daily_metrics').select('recovery_score, hrv, resting_heart_rate, day_strain, sleep_hours').eq('athlete_id', a.id).order('date', { ascending: false }).limit(1).single()
      if (data) metricsMap[a.id] = { recovery: data.recovery_score ?? 0, hrv: data.hrv ?? 0, rhr: data.resting_heart_rate ?? 0, strain: data.day_strain ?? 0, sleep: data.sleep_hours ?? 0 }
    })
  )

  // Recent observation diary
  const { data: diary } = await supabase.from('observation_diary').select('*').eq('coach_id', userId).order('created_at', { ascending: false }).limit(4)

  const avgRecovery = Object.values(metricsMap).length ? Math.round(Object.values(metricsMap).reduce((s, m) => s + m.recovery, 0) / Object.values(metricsMap).length) : 0

  const AT_COLORS = ['#2563EB','#F97316','#16A34A','#7C3AED','#D97706','#DC2626']

  return (
    <div className="flex flex-col gap-6 pf-page-enter">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Coach Dashboard</p>
        <h2 className="pf-num text-3xl text-slate-900 mt-0.5">{name}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pf-stagger">
        <StatCard label="My Athletes" value={athletes?.length ?? 0} icon="ki-people" iconColor="#2563EB" />
        <StatCard label="Avg Recovery" value={avgRecovery + '%'} icon="ki-graph-up" iconColor={recoveryColor(avgRecovery)} />
        <StatCard label="Diary Entries" value={diary?.length ?? 0} icon="ki-notepad-edit" iconColor="#7C3AED" sub="this week" />
        <StatCard label="Athletes Connected" value={athleteIds.length} icon="ki-abstract-26" iconColor="#F97316" />
      </div>

      {/* Athlete cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="pf-num text-xl text-slate-900">My Athletes</p>
          <Link href="/athletes" className="text-xs text-[#2563EB] hover:underline font-medium">Manage athletes →</Link>
        </div>
        {!athletes?.length ? (
          <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-10 text-center text-slate-400">
            <i className="ki-filled ki-people text-4xl block mb-3" />
            <p className="text-sm">No athletes assigned yet.</p>
            <p className="text-xs mt-1">Contact your admin to link athletes to your account.</p>
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
                      <div className="text-xs text-slate-400">Athlete</div>
                    </div>
                    {m && <div className="ml-auto"><RecoveryRing score={Math.round(m.recovery)} size={60} /></div>}
                  </div>
                  {m ? (
                    <div className="grid grid-cols-4 gap-2">
                      {[{ v: m.hrv.toFixed(1), u:'HRV ms', c:'#2563EB' }, { v: m.rhr.toFixed(1), u:'RHR bpm', c:'#DC2626' }, { v: m.sleep.toFixed(1), u:'Sleep h', c:'#7C3AED' }, { v: m.strain.toFixed(1), u:'Strain', c:'#F97316' }]
                        .map(({ v, u, c }) => (
                          <div key={u} className="text-center py-2 px-1 rounded-lg" style={{ background:'#F8FAFC' }}>
                            <div className="pf-num text-lg leading-none" style={{ color: c }}>{v}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{u}</div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No metrics data yet</p>
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
          <p className="pf-num text-xl text-slate-900">Observation Diary</p>
          <Link href="/diary" className="text-xs text-[#2563EB] hover:underline font-medium">View all →</Link>
        </div>
        {!diary?.length ? (
          <p className="text-sm text-slate-400 py-4">No observations yet. <Link href="/diary" className="text-[#2563EB] hover:underline">Add your first note</Link></p>
        ) : (
          <div className="flex flex-col gap-3">
            {diary.map((d) => {
              const ath = athletes?.find(a => a.id === d.athlete_id)
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
