'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  listMySessionsAsAthlete, listMyPassesAsAthlete,
  type CoachSession, type AthletePass,
} from '@/services/coach.service'
import {
  listMyCheckupsAsAthlete, CHECKUP_TYPE_LABELS, type MedicalCheckup,
} from '@/services/doctor.service'
import {
  listMyGroupSessionsAsMember, getMyOrganization, SESSION_TYPE_LABELS,
  type GroupSession, type AttendanceStatus,
} from '@/services/org-sessions.service'

function today(): string { return new Date().toISOString().slice(0, 10) }
function in30(): string { return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }
function in90back(): string { return new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) }

interface DoctorBrief { id: string; name: string }
interface CoachBrief  { id: string; name: string }

export function AthleteConnectionsPanel({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)

  // Doctor
  const [doctor, setDoctor]               = useState<DoctorBrief | null>(null)
  const [lastCheckup, setLastCheckup]     = useState<MedicalCheckup | null>(null)
  const [nextCheckup, setNextCheckup]     = useState<MedicalCheckup | null>(null)

  // Team
  const [org, setOrg]                     = useState<{ id: string; name: string } | null>(null)
  const [nextGroup, setNextGroup]         = useState<(GroupSession & { my_attendance: AttendanceStatus }) | null>(null)

  // Passes
  const [passes, setPasses]               = useState<AthletePass[]>([])
  const [nextCoachSession, setNextCoachSession] = useState<CoachSession | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const sb = createClient()
      const from = today(); const to = in30(); const histFrom = in90back()
      const [myPasses, myCheckups, histCheckups, myGroups, myOrgInfo, mySessions] = await Promise.all([
        listMyPassesAsAthlete(userId),
        listMyCheckupsAsAthlete(userId, from, to),
        listMyCheckupsAsAthlete(userId, histFrom, from),
        listMyGroupSessionsAsMember(userId, from, to),
        getMyOrganization(userId),
        listMySessionsAsAthlete(userId, from, to),
      ])

      // Doctor: берём из ближайшего или последнего осмотра
      const nextC = myCheckups.find(c => c.status !== 'cancelled') ?? null
      const sortedHist = [...histCheckups].sort((a, b) => b.checkup_date.localeCompare(a.checkup_date))
      const lastC = sortedHist.find(c => c.status === 'completed') ?? sortedHist[0] ?? null
      const doctorId = nextC?.doctor_id ?? lastC?.doctor_id ?? null
      let doctorInfo: DoctorBrief | null = null
      if (doctorId) {
        const { data } = await sb.from('users').select('id, name').eq('id', doctorId).single()
        const row = data as { id: string; name: string | null } | null
        if (row) doctorInfo = { id: row.id, name: row.name ?? 'Врач' }
      }

      // Next coach session
      const nextSess = mySessions.find(s => s.status === 'planned') ?? null

      // Next group session
      const nextG = myGroups.find(g => g.status === 'planned') ?? null

      if (!mounted) return
      setLastCheckup(lastC)
      setNextCheckup(nextC)
      setDoctor(doctorInfo)
      setOrg(myOrgInfo)
      setNextGroup(nextG)
      setPasses(myPasses.filter(p => p.status === 'active' || p.status === 'paused').slice(0, 3))
      setNextCoachSession(nextSess)
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [userId])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-32 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] animate-pulse" />
        ))}
      </div>
    )
  }

  const attLabel: Record<AttendanceStatus, { node: React.ReactNode; cls: string }> = {
    pending:   { node: '?',                                                                                 cls: 'bg-slate-100 text-slate-500' },
    confirmed: { node: <><i className="ki-filled ki-check" /> буду</>,                                       cls: 'bg-blue-100 text-blue-700' },
    attended:  { node: <i className="ki-filled ki-double-check" />,                                          cls: 'bg-green-100 text-green-700' },
    absent:    { node: <i className="ki-filled ki-cross" />,                                                 cls: 'bg-red-100 text-red-700' },
    declined:  { node: '—',                                                                                 cls: 'bg-slate-200 text-slate-600' },
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ─── Мой врач ─── */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Мой врач</p>
          {!doctor && (
            <Link href="/network?tab=find&type=doctor" className="text-[11px] font-semibold text-red-500 hover:underline">
              Найти →
            </Link>
          )}
        </div>
        {doctor ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 font-bold text-xs">
                {doctor.name.slice(0, 1)}
              </div>
              <Link href={`/profile/${doctor.id}`} className="text-sm font-semibold text-slate-800 truncate hover:text-red-600">
                {doctor.name}
              </Link>
            </div>
            <div className="space-y-1 mt-auto">
              {nextCheckup && (
                <div className="text-[11px] text-slate-600">
                  <span className="text-slate-400">Ближайший:</span> {CHECKUP_TYPE_LABELS[nextCheckup.checkup_type]} · {nextCheckup.checkup_date}
                </div>
              )}
              {lastCheckup && (
                <div className="text-[11px] text-slate-500">
                  <span className="text-slate-400">Последний:</span> {CHECKUP_TYPE_LABELS[lastCheckup.checkup_type]} · {lastCheckup.checkup_date}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 my-2">Связи с врачом нет. Найдите специалиста в каталоге.</p>
        )}
      </div>

      {/* ─── Моя команда ─── */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-400">Моя команда</p>
          {!org && (
            <Link href="/network?tab=find&type=organization" className="text-[11px] font-semibold text-purple-500 hover:underline">
              Найти →
            </Link>
          )}
        </div>
        {org ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs">
                {org.name.slice(0, 1)}
              </div>
              <Link href={`/profile/${org.id}`} className="text-sm font-semibold text-slate-800 truncate hover:text-purple-600">
                {org.name}
              </Link>
            </div>
            {nextGroup ? (
              <div className="mt-auto space-y-1">
                <div className="text-[11px] text-slate-600 line-clamp-1">
                  <span className="text-slate-400">Ближайшее:</span> {nextGroup.title}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span>{SESSION_TYPE_LABELS[nextGroup.session_type]} · {nextGroup.session_date}</span>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold ${attLabel[nextGroup.my_attendance].cls}`}>
                    {attLabel[nextGroup.my_attendance].node}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-auto">Ближайших событий нет</p>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-400 my-2">В команде не состоите.</p>
        )}
      </div>

      {/* ─── Мои абонементы ─── */}
      <div className="card bg-white border border-[#E2E8F0] rounded-2xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400">Мои абонементы</p>
          <Link href="/calendar" className="text-[11px] font-semibold text-orange-500 hover:underline">
            Все →
          </Link>
        </div>
        {passes.length > 0 ? (
          <div className="space-y-2">
            {passes.map(p => {
              const total = p.total_sessions || 1
              const used  = p.used_sessions ?? 0
              const pct   = Math.min(100, Math.round((used / total) * 100))
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold text-slate-700 truncate pr-2">{p.title}</span>
                    <span className="text-slate-500 shrink-0">{used}/{total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${p.status === 'paused' ? 'bg-slate-400' : 'bg-orange-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
            {nextCoachSession && (
              <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                <span className="text-slate-400">Ближайшая тренировка:</span> {nextCoachSession.session_date}
                {nextCoachSession.start_time && ` · ${nextCoachSession.start_time.slice(0,5)}`}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400 my-2">Активных абонементов нет.</p>
        )}
      </div>
    </div>
  )
}
