'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  listOrgMembers, listGroupSessions, listParticipants,
  createGroupSession, updateGroupSession, deleteGroupSession,
  createRecurringGroupSessions,
  setParticipants, setAttendance,
  SESSION_TYPE_LABELS,
  type GroupSession, type SessionType, type GroupStatus,
  type SessionParticipant, type AttendanceStatus, type OrgMember,
} from '@/services/org-sessions.service'
import { findAthleteConflicts, type Conflict } from '@/services/calendar-conflicts.service'
import { GroupConflictWarning } from '@/components/ui/ConflictWarning'

export function useOrgMembers(orgId: string | null) {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try { setMembers(await listOrgMembers(orgId)) }
    finally { setLoading(false) }
  }, [orgId])

  useEffect(() => { refresh() }, [refresh])
  return { members, loading, refresh }
}

export function OrgSessionsPanel({
  orgId, onCreateClick, refreshToken = 0,
}: {
  orgId: string
  onCreateClick: () => void
  refreshToken?: number
}) {
  const [upcoming, setUpcoming] = useState<GroupSession[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [memberCount, setMemberCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const in60  = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
    const [sessions, members] = await Promise.all([
      listGroupSessions(orgId, today, in60),
      listOrgMembers(orgId),
    ])
    setMemberCount(members.length)
    const upc = sessions.filter(s => s.status === 'planned').slice(0, 6)
    setUpcoming(upc)
    const parts = await listParticipants(upc.map(s => s.id))
    const c: Record<string, number> = {}
    for (const p of parts) c[p.session_id] = (c[p.session_id] ?? 0) + 1
    setCounts(c)
    setLoading(false)
  }, [orgId])

  useEffect(() => { load() }, [load, refreshToken])

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Групповые события · команда: {memberCount}
        </p>
        <button onClick={onCreateClick}
          className="text-[11px] font-semibold text-purple-600 hover:text-purple-700">
          + Новое
        </button>
      </div>
      {loading && upcoming.length === 0 && (
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      )}
      {!loading && upcoming.length === 0 && (
        <div className="text-xs text-muted-foreground py-6 text-center">Ближайших событий нет</div>
      )}
      {upcoming.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {upcoming.map(s => (
            <div key={s.id} className="rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {s.session_date.slice(8, 10)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground truncate">{s.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {SESSION_TYPE_LABELS[s.session_type]} · {counts[s.id] ?? 0} чел.
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function OrgSessionDrawer({
  orgId, initialDate, members, onClose, onSaved, initial,
}: {
  orgId: string
  initialDate: string
  members: OrgMember[]
  onClose: () => void
  onSaved: (s: GroupSession) => void
  initial?: GroupSession | null
}) {
  const [sessionDate, setSessionDate] = useState<string>(initial?.session_date ?? initialDate)
  const [startTime, setStartTime]     = useState<string>(initial?.start_time ?? '')
  const [endTime, setEndTime]         = useState<string>(initial?.end_time ?? '')
  const [title, setTitle]             = useState<string>(initial?.title ?? '')
  const [description, setDescription] = useState<string>(initial?.description ?? '')
  const [location, setLocation]       = useState<string>(initial?.location ?? '')
  const [sessionType, setSessionType] = useState<SessionType>(initial?.session_type ?? 'team_practice')
  const [status, setStatus]           = useState<GroupStatus>(initial?.status ?? 'planned')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [attendance, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [saving, setSaving]           = useState(false)
  const [visible, setVisible]         = useState(false)
  const [recurring, setRecurring] = useState(false)
  const [recurDays, setRecurDays] = useState<number[]>([1, 3, 5]) // Mon/Wed/Fri default
  const [recurEndDate, setRecurEndDate] = useState<string>(() => {
    const d = new Date(initial?.session_date ?? initialDate); d.setDate(d.getDate() + 28)
    return d.toISOString().slice(0, 10)
  })
  const [conflictsByUser, setConflictsByUser] = useState<Array<{ athleteId: string; athleteName: string; conflicts: Conflict[] }>>([])
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [ackConflicts, setAckConflicts] = useState(false)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  // Пересечения у каждого выбранного участника (только для атлетов)
  useEffect(() => {
    if (status === 'cancelled' || participantIds.length === 0) {
      setConflictsByUser([]); return
    }
    let aborted = false
    setCheckingConflicts(true)
    const athleteMembers = members.filter(m => m.role === 'athlete' && participantIds.includes(m.id))
    Promise.all(
      athleteMembers.map(async m => {
        const list = await findAthleteConflicts({
          athlete_id: m.id,
          date: sessionDate,
          start_time: startTime || null,
          end_time: endTime || null,
          exclude: initial ? [{ kind: 'group_session', id: initial.id }] : [],
        })
        return { athleteId: m.id, athleteName: m.name, conflicts: list }
      }),
    )
      .then(rows => { if (!aborted) { setConflictsByUser(rows); setAckConflicts(false) } })
      .finally(() => { if (!aborted) setCheckingConflicts(false) })
    return () => { aborted = true }
  }, [members, participantIds, sessionDate, startTime, endTime, status, initial])

  const hasAnyConflict = conflictsByUser.some(r => r.conflicts.length > 0)

  useEffect(() => {
    if (initial) {
      listParticipants([initial.id]).then(parts => {
        setParticipantIds(parts.map(p => p.user_id))
        const m: Record<string, AttendanceStatus> = {}
        for (const p of parts) m[p.user_id] = p.attendance_status
        setAttendanceMap(m)
      })
    }
  }, [initial])

  const toggleParticipant = (uid: string) => {
    setParticipantIds(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid])
  }

  const handleClose = useCallback(() => { setVisible(false); setTimeout(onClose, 200) }, [onClose])

  const handleSave = useCallback(async () => {
    if (!title.trim()) return
    setSaving(true)

    if (!initial && recurring && recurDays.length > 0 && recurEndDate >= sessionDate) {
      // Bulk-create a series. Each occurrence is independent (no parent link).
      const { created } = await createRecurringGroupSessions({
        organization_id: orgId,
        start_date: sessionDate,
        end_date:   recurEndDate,
        days_of_week: recurDays,
        title: title.trim(),
        session_type: sessionType,
        start_time: startTime || null,
        end_time:   endTime   || null,
        location:   location  || null,
        description: description || null,
        participant_ids: participantIds,
      })
      setSaving(false)
      if (created.length > 0) {
        onSaved(created[0])
        handleClose()
      }
      return
    }

    const payload = {
      session_date: sessionDate,
      title: title.trim(),
      session_type: sessionType,
      start_time: startTime || null,
      end_time:   endTime   || null,
      location:   location  || null,
      description: description || null,
      status,
    }
    const res = initial
      ? await updateGroupSession(initial.id, payload)
      : await createGroupSession({ ...payload, organization_id: orgId, participant_ids: participantIds })
    if (res && initial) {
      await setParticipants(res.id, participantIds)
    }
    setSaving(false)
    if (res) { onSaved(res); handleClose() }
  }, [orgId, sessionDate, title, sessionType, startTime, endTime, location, description, status, participantIds, initial, onSaved, handleClose, recurring, recurDays, recurEndDate])

  const handleDelete = useCallback(async () => {
    if (!initial) return
    if (!confirm('Удалить событие?')) return
    await deleteGroupSession(initial.id)
    onSaved({ ...initial, status: 'cancelled' })
    handleClose()
  }, [initial, onSaved, handleClose])

  const cycleAttendance = useCallback(async (uid: string) => {
    if (!initial) return
    const cur = attendance[uid] ?? 'pending'
    const next: AttendanceStatus =
      cur === 'pending'   ? 'confirmed' :
      cur === 'confirmed' ? 'attended'  :
      cur === 'attended'  ? 'absent'    :
      cur === 'absent'    ? 'declined'  : 'pending'
    await setAttendance(initial.id, uid, next)
    setAttendanceMap(m => ({ ...m, [uid]: next }))
  }, [initial, attendance])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible?'opacity-100':'opacity-0'}`}/>
      <div onClick={e=>e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[480px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible?'translate-x-0':'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Групповое событие</p>
            <h3 className="text-lg font-semibold text-navy-500">{initial ? 'Редактировать' : 'Новое событие'}</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тип</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(Object.keys(SESSION_TYPE_LABELS) as SessionType[]).map(t => (
                <button key={t} type="button" onClick={() => setSessionType(t)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    sessionType === t
                      ? 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-border bg-background text-muted-foreground hover:border-purple-200'
                  }`}>
                  {SESSION_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Название</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Напр. «Командная тренировка»"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Дата</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Начало</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Конец</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Место</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Описание</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Участники ({participantIds.length}/{members.length})
            </label>
            <div className="mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-background p-2 space-y-1">
              {members.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">Нет участников в команде</div>}
              {members.map(m => {
                const on = participantIds.includes(m.id)
                const att = attendance[m.id] ?? 'pending'
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleParticipant(m.id)}
                      className={`flex-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        on ? 'bg-purple-50 border border-purple-200' : 'bg-muted/30 border border-transparent hover:bg-muted/50'
                      }`}>
                      <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center bg-background">
                        {on && <i className="ki-filled ki-check text-[10px] text-purple-600"/>}
                      </div>
                      <span className="text-xs font-medium text-foreground flex-1 truncate">{m.name}</span>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        {m.role === 'coach' ? 'тренер' : 'атлет'}
                      </span>
                    </button>
                    {initial && on && (
                      <button type="button" onClick={() => cycleAttendance(m.id)}
                        className={`text-[9px] px-1.5 py-1 rounded-md font-semibold shrink-0 ${
                          att === 'attended'  ? 'bg-green-100 text-green-700' :
                          att === 'confirmed' ? 'bg-blue-100 text-blue-700'   :
                          att === 'absent'    ? 'bg-red-100 text-red-700'     :
                          att === 'declined'  ? 'bg-slate-200 text-slate-600' :
                                                'bg-muted text-muted-foreground'
                        }`}>
                        {att === 'pending'   ? '?'    :
                         att === 'confirmed' ? '✓ да' :
                         att === 'attended'  ? '✓✓'   :
                         att === 'absent'    ? '✗'    : '—'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {hasAnyConflict && status !== 'cancelled' && (
            <div className="space-y-2">
              <GroupConflictWarning items={conflictsByUser} color="purple" />
              <label className="flex items-center gap-2 cursor-pointer text-[11px] text-purple-700">
                <input type="checkbox" checked={ackConflicts} onChange={e => setAckConflicts(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-purple-300"/>
                <span>Всё равно назначить (я согласовал с участниками)</span>
              </label>
            </div>
          )}

          {!initial && (
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-border"/>
                <span className="text-xs font-semibold text-foreground">Повторяющееся событие</span>
              </label>
              {recurring && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Дни недели</label>
                    <div className="mt-1 grid grid-cols-7 gap-1">
                      {['Вс','Пн','Вт','Ср','Чт','Пт','Сб'].map((lbl, i) => {
                        const on = recurDays.includes(i)
                        return (
                          <button key={i} type="button"
                            onClick={() => setRecurDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                            className={`py-1.5 text-[11px] font-semibold rounded-md border transition-all ${
                              on ? 'border-purple-400 bg-purple-50 text-purple-700'
                                 : 'border-border bg-background text-muted-foreground hover:border-purple-200'
                            }`}>
                            {lbl}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Повторять до</label>
                    <input type="date" value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)}
                      min={sessionDate}
                      className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Будут созданы отдельные события на выбранных днях с {sessionDate} по {recurEndDate}. Каждое можно редактировать индивидуально.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Статус</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {(['planned','completed','cancelled'] as GroupStatus[]).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    status === s
                      ? s === 'completed' ? 'border-green-400 bg-green-50 text-green-700'
                      : s === 'cancelled' ? 'border-slate-400 bg-slate-100 text-slate-600'
                                          : 'border-purple-400 bg-purple-50 text-purple-700'
                      : 'border-border bg-background text-muted-foreground hover:border-purple-200'
                  }`}>
                  {s === 'planned' ? 'Запланировано' : s === 'completed' ? 'Проведено' : 'Отменено'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || checkingConflicts || (hasAnyConflict && status !== 'cancelled' && !ackConflicts)}
            className="flex-1 rounded-xl bg-purple-500 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-purple-600 transition-colors">
            {saving?'Сохранение…':initial?'Сохранить':'Создать событие'}
          </button>
          {initial && (
            <button onClick={handleDelete} className="px-3 py-2.5 rounded-xl border border-border text-red-500 text-sm hover:bg-red-50 transition-colors">
              <i className="ki-filled ki-trash text-xs"/>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
