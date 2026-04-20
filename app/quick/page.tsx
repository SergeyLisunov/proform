'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useToast } from '@/lib/hooks/useToast'

type Draft = {
  event_date: string
  activity_type: string
  name: string
  description: string
  activity_duration_min: number | null
  activity_strain: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  activity_calories: number | null
  mood: number | null
  workout_time_of_day: 'morning' | 'day' | 'evening' | 'night' | null
}

const TIME_OPTIONS: { value: Draft['workout_time_of_day']; label: string }[] = [
  { value: null,      label: '—' },
  { value: 'morning', label: 'Утро' },
  { value: 'day',     label: 'День' },
  { value: 'evening', label: 'Вечер' },
  { value: 'night',   label: 'Ночь' },
]

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function emptyDraft(): Draft {
  return {
    event_date: todayISO(),
    activity_type: '',
    name: '',
    description: '',
    activity_duration_min: null,
    activity_strain: null,
    avg_heart_rate: null,
    max_heart_rate: null,
    activity_calories: null,
    mood: null,
    workout_time_of_day: null,
  }
}

export default function QuickPage() {
  const router = useRouter()
  const { success, error } = useToast()
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)

  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const voice = useVoiceRecorder({
    onTranscript: (t) => setText(prev => (prev ? prev + ' ' + t : t)),
    onError: (m) => error(m),
  })

  const parse = useCallback(async () => {
    const t = text.trim()
    if (!t) { error('Скажите или впишите описание тренировки'); return }
    setParsing(true)
    try {
      const res = await fetch('/api/workouts/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'PARSE_ERROR')
      const d = json.draft as Draft
      if (!d.event_date) d.event_date = todayISO()
      setDraft(d)
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка разбора')
    } finally {
      setParsing(false)
    }
  }, [text, error])

  const save = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
      if (!me) throw new Error('Профиль не найден')

      const payload: Record<string, unknown> = {
        athlete_id: me.id,
        event_date: draft.event_date || todayISO(),
        event_type: 'training',
        activity_type: draft.activity_type || null,
        name: draft.name || null,
        description: draft.description || null,
        activity_duration_min: draft.activity_duration_min,
        activity_strain: draft.activity_strain,
        avg_heart_rate: draft.avg_heart_rate,
        max_heart_rate: draft.max_heart_rate,
        activity_calories: draft.activity_calories,
        mood: draft.mood,
        workout_time_of_day: draft.workout_time_of_day,
      }

      const { error: insErr } = await (supabase as any).from('workouts').insert(payload)
      if (insErr) throw new Error(insErr.message)
      success('Тренировка сохранена')
      setDraft(null)
      setText('')
      router.push('/diary')
    } catch (e) {
      error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [draft, supabase, success, error, router])

  const setDraftField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const parseNumber = (v: string): number | null => {
    const x = parseFloat(v.replace(',', '.'))
    return Number.isFinite(x) ? x : null
  }

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.15),_transparent_42%)]" />
        <div className="relative flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-600">
            Быстрый ввод
          </div>
          <h1 className="pf-num text-[28px] leading-tight text-foreground">
            Скажите или опишите — мы распарсим
          </h1>
          <p className="max-w-[680px] text-sm text-muted-foreground">
            Пример: «сегодня утром лёгкий бег 5 км, 28 минут, пульс средний 140, настроение 4».
            Claude вытащит поля, вы проверите и сохраните.
          </p>
        </div>
      </section>

      {/* Input */}
      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50">
            <i className="ki-filled ki-microphone-2 text-base text-violet-600" />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Описание
          </div>
          {voice.isSupported && (
            <button
              type="button"
              onClick={voice.state === 'recording' ? voice.stop : voice.start}
              disabled={voice.state === 'processing'}
              className={`ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                voice.state === 'recording'
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'border border-border bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              <i className={`ki-filled ${voice.state === 'recording' ? 'ki-microphone-2' : 'ki-microphone-2'}`} />
              {voice.state === 'idle' && 'Записать'}
              {voice.state === 'recording' && 'Стоп'}
              {voice.state === 'processing' && 'Распознаём…'}
              {voice.state === 'success' && 'Готово'}
              {voice.state === 'error' && 'Ошибка'}
            </button>
          )}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          placeholder="Например: вчера вечером силовая в зале, присед 5×5 на 100кг, жим 80, самочувствие 4, настроение норм, ~60 минут"
          className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{text.length} симв.</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setText(''); setDraft(null) }}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent"
            >
              Очистить
            </button>
            <button
              type="button"
              onClick={parse}
              disabled={parsing || !text.trim()}
              className="rounded-full bg-violet-500 px-5 py-2 text-xs font-bold text-white hover:bg-violet-600 disabled:opacity-50"
            >
              <i className="ki-filled ki-magic-stick mr-1" />
              {parsing ? 'Разбираем…' : 'Распарсить в тренировку'}
            </button>
          </div>
        </div>
      </section>

      {/* Draft form */}
      {draft && (
        <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
              <i className="ki-filled ki-check-circle text-base text-emerald-600" />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Проверьте и сохраните
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Дата">
              <input
                type="date"
                value={draft.event_date}
                onChange={e => setDraftField('event_date', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Тип активности">
              <input
                value={draft.activity_type}
                onChange={e => setDraftField('activity_type', e.target.value)}
                placeholder="run / strength / yoga…"
                className={inputCls}
              />
            </Field>
            <Field label="Название" full>
              <input
                value={draft.name}
                onChange={e => setDraftField('name', e.target.value)}
                placeholder="Короткое название"
                className={inputCls}
              />
            </Field>
            <Field label="Длительность (мин)">
              <input
                type="number"
                value={draft.activity_duration_min ?? ''}
                onChange={e => setDraftField('activity_duration_min', parseNumber(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Strain (0..21)">
              <input
                type="number"
                step="0.1"
                value={draft.activity_strain ?? ''}
                onChange={e => setDraftField('activity_strain', parseNumber(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Ср. пульс">
              <input
                type="number"
                value={draft.avg_heart_rate ?? ''}
                onChange={e => setDraftField('avg_heart_rate', parseNumber(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Макс. пульс">
              <input
                type="number"
                value={draft.max_heart_rate ?? ''}
                onChange={e => setDraftField('max_heart_rate', parseNumber(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Калории">
              <input
                type="number"
                value={draft.activity_calories ?? ''}
                onChange={e => setDraftField('activity_calories', parseNumber(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Настроение (1..5)">
              <input
                type="number"
                min={1}
                max={5}
                value={draft.mood ?? ''}
                onChange={e => {
                  const x = parseNumber(e.target.value)
                  setDraftField('mood', x === null ? null : Math.max(1, Math.min(5, Math.round(x))))
                }}
                className={inputCls}
              />
            </Field>
            <Field label="Время суток">
              <select
                value={draft.workout_time_of_day ?? ''}
                onChange={e => setDraftField('workout_time_of_day', (e.target.value || null) as Draft['workout_time_of_day'])}
                className={inputCls}
              >
                {TIME_OPTIONS.map(o => (
                  <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Описание" full>
              <textarea
                rows={3}
                value={draft.description}
                onChange={e => setDraftField('description', e.target.value)}
                className={`${inputCls} resize-none`}
              />
            </Field>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saving}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить тренировку'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : undefined}>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
