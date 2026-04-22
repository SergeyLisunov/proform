'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  listDoctorPatients, getDoctorPatientSummaries,
  createCheckup, updateCheckup, deleteCheckup,
  CHECKUP_TYPE_LABELS,
  type MedicalCheckup, type CheckupStatus, type CheckupType, type DoctorPatient, type DoctorPatientSummary,
} from '@/services/doctor.service'

export function useDoctorPatients(doctorId: string | null) {
  const [patients, setPatients] = useState<DoctorPatient[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!doctorId) return
    setLoading(true)
    try { setPatients(await listDoctorPatients(doctorId)) }
    finally { setLoading(false) }
  }, [doctorId])

  useEffect(() => { refresh() }, [refresh])
  return { patients, loading, refresh }
}

export function DoctorPatientsPanel({
  doctorId, onPickPatient, refreshToken = 0,
}: {
  doctorId: string
  onPickPatient: (athleteId: string, athleteName: string) => void
  refreshToken?: number
}) {
  const [rows, setRows] = useState<DoctorPatientSummary[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await getDoctorPatientSummaries(doctorId)) }
    finally { setLoading(false) }
  }, [doctorId])

  useEffect(() => { load() }, [load, refreshToken])

  if (loading && rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">Мои пациенты</p>
        <div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Загрузка…</div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Мои пациенты</p>
        <span className="text-[10px] text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center">Нет связанных атлетов</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {rows.map(r => (
            <button
              key={r.athlete_id}
              onClick={() => onPickPatient(r.athlete_id, r.athlete_name)}
              className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm hover:border-red-200"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-semibold text-[11px]">
                  {r.athlete_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground truncate">{r.athlete_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {r.last_checkup_date
                      ? `${CHECKUP_TYPE_LABELS[r.last_checkup_type ?? 'general']} · ${r.last_checkup_date.slice(5)}`
                      : 'Осмотров ещё не было'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Запланировано: {r.upcoming_checkups}</span>
                {r.upcoming_checkups > 0 && (
                  <span className="rounded-full bg-red-50 text-red-600 px-1.5 py-0.5 text-[9px] font-semibold">ближайшие 60 дн</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MedicalCheckupDrawer({
  doctorId, initialDate, patients, initialPatientId, onClose, onSaved, initial,
}: {
  doctorId: string
  initialDate: string
  patients: DoctorPatient[]
  initialPatientId?: string | null
  onClose: () => void
  onSaved: (c: MedicalCheckup) => void
  initial?: MedicalCheckup | null
}) {
  const [athleteId, setAthleteId]     = useState<string>(initial?.athlete_id ?? initialPatientId ?? patients[0]?.id ?? '')
  const [checkupDate, setCheckupDate] = useState<string>(initial?.checkup_date ?? initialDate)
  const [startTime, setStartTime]     = useState<string>(initial?.start_time ?? '')
  const [endTime, setEndTime]         = useState<string>(initial?.end_time ?? '')
  const [checkupType, setCheckupType] = useState<CheckupType>(initial?.checkup_type ?? 'general')
  const [location, setLocation]       = useState<string>(initial?.location ?? '')
  const [findings, setFindings]       = useState<string>(initial?.findings ?? '')
  const [recs, setRecs]               = useState<string>(initial?.recommendations ?? '')
  const [followUp, setFollowUp]       = useState<string>(initial?.follow_up_date ?? '')
  const [status, setStatus]           = useState<CheckupStatus>(initial?.status ?? 'scheduled')
  const [saving, setSaving]           = useState(false)
  const [visible, setVisible]         = useState(false)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])

  const handleClose = useCallback(() => { setVisible(false); setTimeout(onClose, 200) }, [onClose])

  const handleSave = useCallback(async () => {
    if (!athleteId) return
    setSaving(true)
    const payload = {
      doctor_id: doctorId,
      athlete_id: athleteId,
      checkup_date: checkupDate,
      start_time: startTime || null,
      end_time:   endTime   || null,
      checkup_type: checkupType,
      location:   location  || null,
      findings:   findings  || null,
      recommendations: recs || null,
      follow_up_date: followUp || null,
      status,
    }
    const res = initial
      ? await updateCheckup(initial.id, payload)
      : await createCheckup(payload)
    setSaving(false)
    if (res) { onSaved(res); handleClose() }
  }, [athleteId, doctorId, checkupDate, startTime, endTime, checkupType, location, findings, recs, followUp, status, initial, onSaved, handleClose])

  const handleDelete = useCallback(async () => {
    if (!initial) return
    if (!confirm('Удалить осмотр?')) return
    await deleteCheckup(initial.id)
    onSaved({ ...initial, status: 'cancelled' })
    handleClose()
  }, [initial, onSaved, handleClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible?'opacity-100':'opacity-0'}`}/>
      <div onClick={e=>e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[460px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible?'translate-x-0':'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Медосмотр</p>
            <h3 className="text-lg font-semibold text-foreground">{initial ? 'Редактировать' : 'Новый осмотр'}</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Пациент</label>
            <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тип</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(Object.keys(CHECKUP_TYPE_LABELS) as CheckupType[]).map(t => (
                <button key={t} type="button" onClick={() => setCheckupType(t)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    checkupType === t
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-border bg-background text-muted-foreground hover:border-red-200'
                  }`}>
                  {CHECKUP_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Дата</label>
              <input type="date" value={checkupDate} onChange={e => setCheckupDate(e.target.value)}
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
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Клиника / кабинет"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Заключение</label>
            <textarea value={findings} onChange={e => setFindings(e.target.value)} rows={3}
              placeholder="Наблюдения, результаты, диагноз…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Рекомендации</label>
            <textarea value={recs} onChange={e => setRecs(e.target.value)} rows={2}
              placeholder="Препараты, нагрузка, режим…"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Повторный приём</label>
            <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Статус</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(['scheduled','completed','no_show','cancelled'] as CheckupStatus[]).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    status===s
                      ? s==='completed' ? 'border-green-400 bg-green-50 text-green-700'
                      : s==='no_show'   ? 'border-red-400 bg-red-50 text-red-700'
                      : s==='cancelled' ? 'border-slate-400 bg-slate-100 text-slate-600'
                                        : 'border-red-400 bg-red-50 text-red-700'
                      : 'border-border bg-background text-muted-foreground hover:border-red-200'
                  }`}>
                  {s==='scheduled'?'Запланирован':s==='completed'?'Проведён':s==='no_show'?'Не пришёл':'Отменён'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <button onClick={handleSave} disabled={saving || !athleteId}
            className="flex-1 rounded-xl bg-red-500 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 hover:bg-red-600 transition-colors">
            {saving?'Сохранение…':initial?'Сохранить':'Создать осмотр'}
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
