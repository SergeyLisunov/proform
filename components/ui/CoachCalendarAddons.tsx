'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  listCoachPlans, createCoachPlan, updateCoachPlan, deleteCoachPlan,
  listAthletePasses, issuePass, updatePass, deletePass, createCoachSession,
  listCoachSessions, createCoachSession, updateCoachSession, deleteCoachSession,
  getAthletePassSummaries,
  type CoachPassPlan, type AthletePass, type CoachSession, type AthletePassSummary, type SessionStatus,
} from '@/services/coach.service'
import { createClient } from '@/lib/supabase/client'

type Athlete = { id: string; name: string }

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtMoney(cents: number, cur = 'RUB'): string {
  if (!cents) return 'бесплатно'
  const v = cents / 100
  return `${v.toLocaleString('ru-RU')} ${cur}`
}

// ─── useCoachAthletes: загружает связанных атлетов ──────────────────────
export function useCoachAthletes(coachId: string | null) {
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!coachId) return
    setLoading(true)
    const sb = createClient()
    const { data: linksRaw } = await sb
      .from('trainer_athletes').select('athlete_id')
      .eq('trainer_id', coachId).eq('status', 'accepted')
    const links = (linksRaw ?? []) as Array<{ athlete_id: string }>
    const ids = links.map(l => l.athlete_id)
    if (ids.length === 0) { setAthletes([]); setLoading(false); return }
    const { data: usersRaw } = await sb.from('users').select('id, name').in('id', ids)
    const users = (usersRaw ?? []) as Array<{ id: string; name: string | null }>
    setAthletes(users.map(u => ({ id: u.id, name: u.name ?? '—' })))
    setLoading(false)
  }, [coachId])

  useEffect(() => { refresh() }, [refresh])

  return { athletes, loading, refresh }
}

// ═══════════════════════════════════════════════════════════════════════
// CoachAthletesPanel — карточки атлетов со счётчиком занятий
// ═══════════════════════════════════════════════════════════════════════
export function CoachAthletesPanel({
  coachId, onPickAthlete, refreshToken = 0,
}: {
  coachId: string
  onPickAthlete: (athleteId: string, athleteName: string) => void
  refreshToken?: number
}) {
  const [rows, setRows] = useState<AthletePassSummary[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await getAthletePassSummaries(coachId)) }
    finally { setLoading(false) }
  }, [coachId])

  useEffect(() => { load() }, [load, refreshToken])

  if (loading && rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">Мои атлеты</p>
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Мои атлеты</p>
        <span className="text-[10px] text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Нет связанных атлетов</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(r => {
            const remaining = Math.max(0, r.total_sessions - r.used_sessions)
            const pct = r.total_sessions > 0 ? Math.min(100, (r.used_sessions / r.total_sessions) * 100) : 0
            const noPass = r.total_sessions === 0
            return (
              <button
                key={r.athlete_id}
                onClick={() => onPickAthlete(r.athlete_id, r.athlete_name)}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm hover:border-orange-200"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-semibold text-[11px]">
                    {r.athlete_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate">{r.athlete_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {noPass ? 'Нет абонемента' : `Осталось ${remaining} из ${r.total_sessions}`}
                    </div>
                  </div>
                </div>
                {!noPass && (
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Запланировано: {r.upcoming_sessions}</span>
                  {r.expires_at && (
                    <span className="text-muted-foreground">до {r.expires_at.slice(5)}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// CoachSessionDrawer — назначение/отметка занятия
// ═══════════════════════════════════════════════════════════════════════
export function CoachSessionDrawer({
  coachId, initialDate, athletes, initialAthleteId, onClose, onSaved, initial,
}: {
  coachId: string
  initialDate: string
  athletes: Athlete[]
  initialAthleteId?: string | null
  onClose: () => void
  onSaved: (s: CoachSession) => void
  initial?: CoachSession | null
}) {
  const [athleteId, setAthleteId]   = useState<string>(initial?.athlete_id ?? initialAthleteId ?? athletes[0]?.id ?? '')
  const [sessionDate, setSessionDate] = useState<string>(initial?.session_date ?? initialDate)
  const [startTime, setStartTime]   = useState<string>(initial?.start_time ?? '')
  const [endTime,   setEndTime]     = useState<string>(initial?.end_time ?? '')
  const [location,  setLocation]    = useState<string>(initial?.location ?? '')
  const [title,     setTitle]       = useState<string>(initial?.title ?? '')
  const [notes,     setNotes]       = useState<string>(initial?.notes ?? '')
  const [status,    setStatus]      = useState<SessionStatus>(initial?.status ?? 'planned')
  const [passId,    setPassId]      = useState<string | null>(initial?.pass_id ?? null)
  const [activePasses, setActivePasses] = useState<AthletePass[]>([])
  const [saving, setSaving]         = useState(false)
  const [visible, setVisible]       = useState(false)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  // Загрузка активных абонементов для выбранного атлета
  useEffect(() => {
    if (!athleteId) return
    listAthletePasses(coachId).then(all => {
      const list = all.filter(p => p.athlete_id === athleteId && p.status === 'active')
      setActivePasses(list)
      if (!initial && list.length > 0) setPassId(list[0].id)
    })
  }, [coachId, athleteId, initial])

  const handleClose = useCallback(() => { setVisible(false); setTimeout(onClose, 200) }, [onClose])

  const handleSave = useCallback(async () => {
    if (!athleteId) return
    setSaving(true)
    const payload = {
      coach_id: coachId,
      athlete_id: athleteId,
      pass_id: passId,
      session_date: sessionDate,
      start_time: startTime || null,
      end_time:   endTime   || null,
      location:   location  || null,
      title:      title     || null,
      notes:      notes     || null,
      status,
    }
    const res = initial
      ? await updateCoachSession(initial.id, payload)
      : await createCoachSession(payload)
    setSaving(false)
    if (res) { onSaved(res); handleClose() }
  }, [athleteId, coachId, passId, sessionDate, startTime, endTime, location, title, notes, status, initial, onSaved, handleClose])

  const handleDelete = useCallback(async () => {
    if (!initial) return
    if (!confirm('Удалить занятие?')) return
    await deleteCoachSession(initial.id)
    onSaved({ ...initial, status: 'cancelled' })
    handleClose()
  }, [initial, onSaved, handleClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible?'opacity-100':'opacity-0'}`}/>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[440px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible?'translate-x-0':'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Тренерское занятие</p>
            <h3 className="text-lg font-semibold text-foreground">{initial ? 'Редактировать' : 'Новое занятие'}</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Атлет</label>
            <select
              value={athleteId}
              onChange={e => setAthleteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Дата</label>
              <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Начало</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Конец</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Место</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Зал / локация"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тема/название</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Техника / скорость / выносливость…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Абонемент</label>
            <select value={passId ?? ''} onChange={e => setPassId(e.target.value || null)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">— Без абонемента —</option>
              {activePasses.map(p => <option key={p.id} value={p.id}>{p.title} ({p.total_sessions - p.used_sessions} осталось)</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Заметки</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Статус</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['planned','completed','no_show','cancelled'] as SessionStatus[]).map(s => (
                <button key={s} onClick={() => setStatus(s)} type="button"
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    status===s
                      ? s==='completed' ? 'border-green-400 bg-green-50 text-green-700'
                      : s==='no_show'   ? 'border-red-400 bg-red-50 text-red-700'
                      : s==='cancelled' ? 'border-slate-400 bg-slate-100 text-slate-600'
                                        : 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-border bg-background text-muted-foreground hover:border-orange-200'
                  }`}>
                  {s==='planned'?'Запланировано':s==='completed'?'Проведено':s==='no_show'?'Не пришёл':'Отменено'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || !athleteId}
            className="flex-1 rounded-xl bg-orange-500 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-orange-600 transition-colors">
            {saving?'Сохранение…':initial?'Сохранить':'Создать занятие'}
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

// ═══════════════════════════════════════════════════════════════════════
// PassPlansManager — тарифы тренера
// ═══════════════════════════════════════════════════════════════════════
export function PassPlansManager({ coachId, onClose }: { coachId: string; onClose: () => void }) {
  const [plans, setPlans] = useState<CoachPassPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [editing, setEditing] = useState<Partial<CoachPassPlan> | null>(null)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { setPlans(await listCoachPlans(coachId)) } finally { setLoading(false) }
  }, [coachId])

  useEffect(() => { load() }, [load])

  const handleClose = useCallback(() => { setVisible(false); setTimeout(onClose, 200) }, [onClose])

  const savePlan = useCallback(async () => {
    if (!editing) return
    const title = (editing.title ?? '').trim()
    if (!title) return
    const total = Number(editing.total_sessions) || 0
    const period = Number(editing.period_days) || 30
    const price = Math.round((Number(editing.price_cents) || 0))
    if (editing.id) {
      await updateCoachPlan(editing.id, {
        title, description: editing.description ?? null,
        total_sessions: total, period_days: period, price_cents: price,
        currency: editing.currency ?? 'RUB', is_active: editing.is_active ?? true,
      })
    } else {
      await createCoachPlan({
        coach_id: coachId, title, description: editing.description ?? null,
        total_sessions: total, period_days: period, price_cents: price,
        currency: editing.currency ?? 'RUB',
      })
    }
    setEditing(null); await load()
  }, [editing, coachId, load])

  const removePlan = useCallback(async (id: string) => {
    if (!confirm('Удалить тариф?')) return
    await deleteCoachPlan(id); await load()
  }, [load])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible?'opacity-100':'opacity-0'}`}/>
      <div onClick={e=>e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[480px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible?'translate-x-0':'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Тарифы</p>
            <h3 className="text-lg font-semibold text-foreground">Абонементы (шаблоны)</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && plans.length === 0 && <div className="text-xs text-muted-foreground">Загрузка…</div>}
          {plans.length === 0 && !loading && (
            <div className="text-xs text-muted-foreground py-6 text-center">Пока нет тарифов. Создайте первый.</div>
          )}
          {plans.map(p => (
            <div key={p.id} className={`rounded-xl border p-3 ${p.is_active?'border-border bg-background':'border-border bg-muted/30'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {p.total_sessions} занятий · {p.period_days} дн · {fmtMoney(p.price_cents, p.currency)}
                  </div>
                  {p.description && <div className="text-[11px] text-muted-foreground mt-1">{p.description}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={()=>setEditing(p)} className="w-7 h-7 rounded-lg border border-border hover:bg-muted flex items-center justify-center">
                    <i className="ki-filled ki-pencil text-[11px]"/>
                  </button>
                  <button onClick={()=>removePlan(p.id)} className="w-7 h-7 rounded-lg border border-border hover:bg-red-50 text-red-500 flex items-center justify-center">
                    <i className="ki-filled ki-trash text-[11px]"/>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {editing && (
            <div className="rounded-xl border-2 border-orange-200 bg-orange-50/40 p-3 space-y-2 mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600">
                {editing.id ? 'Редактировать тариф' : 'Новый тариф'}
              </div>
              <input placeholder="Название (напр. «8 тренировок / месяц»)"
                value={editing.title ?? ''} onChange={e=>setEditing(v=>({...v,title:e.target.value}))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
              <textarea placeholder="Описание (опц.)" rows={2}
                value={editing.description ?? ''} onChange={e=>setEditing(v=>({...v,description:e.target.value}))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Занятий</label>
                  <input type="number" min={1} value={editing.total_sessions ?? 8}
                    onChange={e=>setEditing(v=>({...v,total_sessions:Number(e.target.value)}))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Период (дн)</label>
                  <input type="number" min={1} value={editing.period_days ?? 30}
                    onChange={e=>setEditing(v=>({...v,period_days:Number(e.target.value)}))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Цена (коп)</label>
                  <input type="number" min={0} value={editing.price_cents ?? 0}
                    onChange={e=>setEditing(v=>({...v,price_cents:Number(e.target.value)}))}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={savePlan} className="flex-1 rounded-lg bg-orange-500 text-white px-3 py-2 text-xs font-semibold hover:bg-orange-600">
                  {editing.id?'Сохранить':'Создать'}
                </button>
                <button onClick={()=>setEditing(null)} className="px-3 py-2 rounded-lg border border-border text-xs">Отмена</button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <button onClick={()=>setEditing({ title:'', total_sessions:8, period_days:30, price_cents:0, currency:'RUB', is_active:true })}
            disabled={!!editing}
            className="w-full rounded-xl bg-orange-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
            <i className="ki-filled ki-plus text-xs mr-1"/>
            Создать тариф
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ═══════════════════════════════════════════════════════════════════════
// IssuePassDrawer — выдача абонемента атлету (из шаблона или вручную)
// ═══════════════════════════════════════════════════════════════════════
export function IssuePassDrawer({
  coachId, athletes, initialAthleteId, onClose, onIssued,
}: {
  coachId: string
  athletes: Athlete[]
  initialAthleteId?: string | null
  onClose: () => void
  onIssued: (p: AthletePass) => void
}) {
  const [athleteId, setAthleteId] = useState<string>(initialAthleteId ?? athletes[0]?.id ?? '')
  const [plans, setPlans] = useState<CoachPassPlan[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [totalSessions, setTotalSessions] = useState(8)
  const [periodDays, setPeriodDays] = useState(30)
  const [priceCents, setPriceCents] = useState(0)
  const [startsAt, setStartsAt] = useState<string>(todayISO())
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const [existing, setExisting] = useState<AthletePass[]>([])
  const [autoSchedule, setAutoSchedule] = useState(false)
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 3, 5])
  const [scheduleTime, setScheduleTime] = useState<string>('19:00')

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  useEffect(() => {
    listCoachPlans(coachId).then(setPlans)
  }, [coachId])

  // Load existing passes for this athlete
  useEffect(() => {
    if (!athleteId) { setExisting([]); return }
    listAthletePasses(coachId).then(all => {
      setExisting(all.filter(p => p.athlete_id === athleteId))
    })
  }, [coachId, athleteId, saving])

  const applyPlan = useCallback((pid: string) => {
    setPlanId(pid)
    const p = plans.find(x => x.id === pid)
    if (p) {
      setTitle(p.title); setTotalSessions(p.total_sessions)
      setPeriodDays(p.period_days); setPriceCents(p.price_cents)
    }
  }, [plans])

  const expiresAt = useMemo(() => addDaysISO(startsAt, Math.max(0, periodDays - 1)), [startsAt, periodDays])

  const handleClose = useCallback(() => { setVisible(false); setTimeout(onClose, 200) }, [onClose])

  const handleIssue = useCallback(async () => {
    if (!athleteId || !title.trim()) return
    setSaving(true)
    const res = await issuePass({
      coach_id: coachId, athlete_id: athleteId, plan_id: planId,
      title: title.trim(), total_sessions: totalSessions,
      starts_at: startsAt, expires_at: expiresAt,
      price_cents: priceCents, currency: 'RUB',
    })
    if (res && autoSchedule && scheduleDays.length > 0) {
      const [hh, mm] = scheduleTime.split(':')
      const endH = String(Math.min(23, Number(hh) + 1)).padStart(2, '0')
      const start = new Date(startsAt + 'T00:00:00')
      const end   = new Date(expiresAt + 'T00:00:00')
      let generated = 0
      const cur = new Date(start)
      while (generated < totalSessions && cur <= end) {
        if (scheduleDays.includes(cur.getDay())) {
          const y = cur.getFullYear(), m = String(cur.getMonth()+1).padStart(2,'0'), d = String(cur.getDate()).padStart(2,'0')
          await createCoachSession({
            coach_id: coachId, athlete_id: athleteId, pass_id: res.id,
            session_date: `${y}-${m}-${d}`,
            start_time: `${hh}:${mm}:00`, end_time: `${endH}:${mm}:00`,
            title: title.trim(), status: 'planned',
          })
          generated++
        }
        cur.setDate(cur.getDate() + 1)
      }
    }
    setSaving(false)
    if (res) { onIssued(res); handleClose() }
  }, [athleteId, coachId, planId, title, totalSessions, startsAt, expiresAt, priceCents, autoSchedule, scheduleDays, scheduleTime, onIssued, handleClose])

  const handleStatusChange = useCallback(async (id: string, status: AthletePass['status']) => {
    await updatePass(id, { status })
    setExisting(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }, [])

  const handleRemovePass = useCallback(async (id: string) => {
    if (!confirm('Удалить абонемент?')) return
    await deletePass(id)
    setExisting(prev => prev.filter(p => p.id !== id))
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible?'opacity-100':'opacity-0'}`}/>
      <div onClick={e=>e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[480px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible?'translate-x-0':'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Абонемент</p>
            <h3 className="text-lg font-semibold text-foreground">Выдать атлету</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Атлет</label>
            <select value={athleteId} onChange={e=>setAthleteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {plans.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Из тарифа</label>
              <select value={planId ?? ''} onChange={e=>{
                const v = e.target.value
                if (v) applyPlan(v); else setPlanId(null)
              }}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="">— Свой вариант —</option>
                {plans.filter(p=>p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.title} · {p.total_sessions} зан/{p.period_days}дн · {fmtMoney(p.price_cents,p.currency)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Название</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Напр. «Январь — 8 тренировок»"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Занятий</label>
              <input type="number" min={1} value={totalSessions} onChange={e=>setTotalSessions(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Период (дн)</label>
              <input type="number" min={1} value={periodDays} onChange={e=>setPeriodDays(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Цена (коп)</label>
              <input type="number" min={0} value={priceCents} onChange={e=>setPriceCents(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Начинается</label>
              <input type="date" value={startsAt} onChange={e=>setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Истекает</label>
              <input type="date" value={expiresAt} readOnly
                className="w-full rounded-lg border border-border bg-muted/40 px-2 py-2 text-sm text-muted-foreground"/>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoSchedule} onChange={e => setAutoSchedule(e.target.checked)}
                className="w-4 h-4 rounded border-border"/>
              <span className="text-xs font-semibold text-foreground">Сразу создать занятия в календаре</span>
            </label>
            {autoSchedule && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Дни недели</label>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {['Вс','Пн','Вт','Ср','Чт','Пт','Сб'].map((lbl, i) => {
                      const on = scheduleDays.includes(i)
                      return (
                        <button key={i} type="button"
                          onClick={() => setScheduleDays(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i].sort())}
                          className={`py-1.5 text-[11px] font-semibold rounded-md border transition-all ${
                            on ? 'border-orange-400 bg-orange-50 text-orange-700'
                               : 'border-border bg-background text-muted-foreground hover:border-orange-200'
                          }`}>
                          {lbl}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Время начала</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Будет создано до {totalSessions} занятий на выбранных днях недели до истечения абонемента.
                </p>
              </div>
            )}
          </div>

          {existing.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">Текущие абонементы</div>
              <div className="space-y-1.5">
                {existing.map(p => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{p.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.used_sessions}/{p.total_sessions} · {p.starts_at} → {p.expires_at}
                      </div>
                    </div>
                    <select value={p.status} onChange={e=>handleStatusChange(p.id, e.target.value as AthletePass['status'])}
                      className="text-[10px] rounded-md border border-border bg-background px-1.5 py-1">
                      <option value="active">активен</option>
                      <option value="paused">пауза</option>
                      <option value="expired">истёк</option>
                      <option value="finished">использован</option>
                      <option value="cancelled">отменён</option>
                    </select>
                    <button onClick={()=>handleRemovePass(p.id)} className="w-6 h-6 rounded-md border border-border text-red-500 hover:bg-red-50 flex items-center justify-center">
                      <i className="ki-filled ki-trash text-[10px]"/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <button onClick={handleIssue} disabled={saving || !athleteId || !title.trim()}
            className="w-full rounded-xl bg-orange-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
            {saving?'Выдача…':'Выдать абонемент'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
