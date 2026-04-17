'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

const ACTIVITY_TYPES = ['Бег','Велоспорт','Плавание','Силовые','HIIT','CrossFit','Йога','Ходьба','Другое']
const TIME_OF_DAY = ['Утро','День','Вечер','Ночь']
type WorkoutInsert = Database['public']['Tables']['workouts']['Insert']

interface Props { role: string; userId: string }

function DurationHMInput({ valueMin, onChange }: { valueMin: string; onChange: (v: string) => void }) {
  const totalN = Number(valueMin) || 0
  const h = Math.floor(totalN / 60)
  const m = totalN % 60
  const base = 'w-full border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition bg-white'
  function update(hNew: number, mNew: number) {
    const hv = Math.max(0, Number.isFinite(hNew) ? Math.floor(hNew) : 0)
    const mv = Math.max(0, Math.min(59, Number.isFinite(mNew) ? Math.floor(mNew) : 0))
    const total = hv * 60 + mv
    onChange(total > 0 ? String(total) : '')
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="relative">
        <input type="number" min={0} inputMode="numeric" aria-label="Часы"
          value={valueMin === '' ? '' : String(h)} placeholder="0"
          onChange={e => update(Number(e.target.value), m)}
          className={`${base} pr-9`} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">ч</span>
      </div>
      <div className="relative">
        <input type="number" min={0} max={59} inputMode="numeric" aria-label="Минуты"
          value={valueMin === '' ? '' : String(m)} placeholder="0"
          onChange={e => update(h, Number(e.target.value))}
          className={`${base} pr-11`} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">мин</span>
      </div>
    </div>
  )
}

export default function DiaryClient({ role, userId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    activity_type: 'Running',
    event_date: new Date().toISOString().split('T')[0],
    workout_time_of_day: 'Morning',
    activity_duration_min: '',
    avg_heart_rate: '',
    activity_calories: '',
    activity_strain: '',
    recovery_score: '',
    hrv: '',
    description: '',
    is_public: false,
  })

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const payload: WorkoutInsert = {
      athlete_id: userId,
      event_type: form.activity_type === 'Competition' ? 'competition' : 'training',
      activity_type: form.activity_type,
      event_date: form.event_date,
      workout_time_of_day: form.workout_time_of_day,
      activity_duration_min: form.activity_duration_min ? parseInt(form.activity_duration_min) : null,
      avg_heart_rate: form.avg_heart_rate ? parseFloat(form.avg_heart_rate) : null,
      activity_calories: form.activity_calories ? parseInt(form.activity_calories) : null,
      activity_strain: form.activity_strain ? parseFloat(form.activity_strain) : null,
      recovery_score: form.recovery_score ? parseFloat(form.recovery_score) : null,
      hrv: form.hrv ? parseFloat(form.hrv) : null,
      description: form.description || null,
      is_public: form.is_public,
      cycle_type: 'micro',
    }
    await (supabase.from('workouts') as any).insert(payload)
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  const lbl = (text: string) => <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{text}</label>
  const inp = (field: keyof typeof form, type = 'text', placeholder = '') => (
    <input type={type} placeholder={placeholder} value={String(form[field])}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      className="w-full border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition bg-white"
    />
  )

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
        style={{ background: '#F97316' }}>
        <i className="ki-filled ki-plus text-base" />
        {role === 'coach' ? 'Новое наблюдение' : 'Добавить тренировку'}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#F1F5F9]">
              <div>
                <h3 className="pf-num text-xl text-slate-900">Записать тренировку</h3>
                <p className="text-xs text-slate-400 mt-0.5">Все поля совместимы с WHOOP</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition">
                <i className="ki-filled ki-cross text-lg" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {lbl('Дата')}
                  {inp('event_date', 'date')}
                </div>
                <div>
                  {lbl('Время суток')}
                  <select value={form.workout_time_of_day} onChange={e => setForm(f => ({ ...f, workout_time_of_day: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#2563EB] bg-white">
                    {TIME_OF_DAY.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                {lbl('Тип активности')}
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setForm(f => ({ ...f, activity_type: t }))}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                      style={{ background: form.activity_type === t ? '#F97316' : '#F1F5F9', color: form.activity_type === t ? '#fff' : '#64748B' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {lbl('Длительность')}
                  <DurationHMInput
                    valueMin={form.activity_duration_min}
                    onChange={v => setForm(f => ({ ...f, activity_duration_min: v }))}
                  />
                </div>
                <div>{lbl('Ср. ЧСС (bpm)')}{inp('avg_heart_rate', 'number', '145')}</div>
                <div>{lbl('Калории')}{inp('activity_calories', 'number', '500')}</div>
                <div>{lbl('Нагрузка (0–21)')}{inp('activity_strain', 'number', '10.5')}</div>
                <div>{lbl('Восстановление %')}{inp('recovery_score', 'number', '75')}</div>
                <div>{lbl('ВСР (ms)')}{inp('hrv', 'number', '65')}</div>
              </div>
              <div>
                {lbl('Заметки')}
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Ощущения, наблюдения..."
                  className="w-full border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition resize-none" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
                  className="w-4 h-4 rounded border-[#E2E8F0] text-[#2563EB]" />
                <span className="text-sm text-slate-600">Сделать тренировку публичной</span>
              </label>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Отмена
              </button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: saving ? '#FDA96A' : '#F97316' }}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
