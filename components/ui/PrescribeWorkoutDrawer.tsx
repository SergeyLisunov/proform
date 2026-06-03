'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { prescribeWorkout } from '@/services/prescribed-workouts.service'

type Athlete = { id: string; name: string }

const ACTIVITY_PRESETS = [
  'running', 'strength', 'cycling', 'swimming', 'mobility', 'interval',
  'recovery', 'tempo', 'long_run', 'other',
]
const ACTIVITY_LABELS: Record<string, string> = {
  running:    'Бег',
  strength:   'Силовая',
  cycling:    'Велосипед',
  swimming:   'Плавание',
  mobility:   'Мобильность',
  interval:   'Интервальная',
  recovery:   'Восстановление',
  tempo:      'Темповая',
  long_run:   'Длительная',
  other:      'Другое',
}

export function PrescribeWorkoutDrawer({
  coachId, athletes, initialAthleteId, initialDate, onClose, onSaved,
}: {
  coachId: string
  athletes: Athlete[]
  initialAthleteId?: string | null
  initialDate?: string
  onClose: () => void
  onSaved?: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [athleteId, setAthleteId] = useState<string>(initialAthleteId ?? athletes[0]?.id ?? '')
  const [eventDate, setEventDate] = useState<string>(initialDate ?? today)
  const [activityType, setActivityType] = useState<string>('running')
  const [name, setName] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [durationMin, setDurationMin] = useState<number | ''>(60)
  const [note, setNote] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])
  const handleClose = useCallback(() => { setVisible(false); setTimeout(onClose, 200) }, [onClose])

  const handleSave = useCallback(async () => {
    if (!athleteId || !eventDate) return
    setSaving(true)
    const res = await prescribeWorkout({
      coach_id: coachId,
      athlete_id: athleteId,
      event_date: eventDate,
      activity_type: activityType,
      name: name.trim() || null,
      description: description.trim() || null,
      activity_duration_min: typeof durationMin === 'number' ? durationMin : null,
      prescribed_note: note.trim() || null,
    })
    setSaving(false)
    if (res) { onSaved?.(); handleClose() }
  }, [athleteId, eventDate, activityType, name, description, durationMin, note, coachId, onSaved, handleClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end" onClick={handleClose}>
      <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${visible ? 'opacity-100' : 'opacity-0'}`}/>
      <div onClick={e => e.stopPropagation()}
        className={`relative z-10 h-full w-full max-w-[440px] bg-background shadow-2xl flex flex-col transition-transform duration-200 ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Тренировка для атлета</p>
            <h3 className="text-lg font-semibold text-navy-500">Назначить</h3>
          </div>
          <button onClick={handleClose} className="kt-btn kt-btn-sm kt-btn-icon kt-btn-ghost">
            <i className="ki-filled ki-cross text-xs"/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Атлет</label>
            <select value={athleteId} onChange={e => setAthleteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Дата</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Длительность, мин</label>
              <input type="number" min={0} value={durationMin}
                onChange={e => setDurationMin(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"/>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Тип активности</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {ACTIVITY_PRESETS.map(a => (
                <button key={a} type="button" onClick={() => setActivityType(a)}
                  className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                    activityType === a
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-border bg-background text-muted-foreground hover:border-orange-200'
                  }`}>
                  {ACTIVITY_LABELS[a] ?? a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Название</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Напр. «Интервалы 5×1000»"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Описание плана</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder="Что атлет должен сделать. Например: разминка 15 мин, 5×1000м @темп, заминка 10 мин."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Примечание тренеру</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Видно только вам и атлету."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"/>
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <button onClick={handleSave} disabled={saving || !athleteId || !eventDate}
            className="w-full rounded-xl bg-orange-500 text-white px-4 py-2.5 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
            {saving ? 'Назначаем…' : 'Назначить тренировку'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
