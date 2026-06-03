'use client'
/**
 * DailyWellnessCard — Sprint W1 Day 3 critical fix from product audit.
 *
 * Empty state (no checkin today): compact prompt "Заполни самочувствие за
 * 30 секунд" with subtle notification dot when shouldPromptToday().
 *
 * Filled state: inline summary (mood emoji + sleep hours + soreness color
 * + energy emoji), click to edit.
 *
 * Expanded state: 4 mini-pickers + optional notes. Save button upserts via
 * recordCheckin(). RLS guarantees the athlete only writes their own row.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  getTodayCheckin, recordCheckin, shouldPromptToday,
  MOOD_EMOJI, ENERGY_EMOJI, SLEEP_QUALITY_EMOJI, sorenessColor,
  type WellnessCheckin,
} from '@/services/wellness.service'

const MOOD_LABELS = ['', 'Ужасно', 'Плохо', 'Норм', 'Хорошо', 'Отлично']
const ENERGY_LABELS = ['', 'Разбит', 'Низкая', 'Средняя', 'Высокая', 'На пике']
const SLEEP_QUALITY_LABELS = ['', 'Не выспался', 'Плохо', 'Сносно', 'Хорошо', 'Глубокий']

export default function DailyWellnessCard({ athleteId }: { athleteId: string }) {
  const [today, setToday]     = useState<WellnessCheckin | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen]       = useState(false)
  const [saving, setSaving]   = useState(false)

  // Form state (mirrors WellnessCheckin shape)
  const [mood, setMood]                 = useState<number | ''>('')
  const [sleepHours, setSleepHours]     = useState<number | ''>('')
  const [sleepQuality, setSleepQuality] = useState<number | ''>('')
  const [soreness, setSoreness]         = useState<number | ''>('')
  const [energy, setEnergy]             = useState<number | ''>('')
  const [notes, setNotes]               = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    const row = await getTodayCheckin(athleteId)
    setToday(row)
    if (row) {
      setMood(row.mood ?? '')
      setSleepHours(row.sleep_hours ?? '')
      setSleepQuality(row.sleep_quality ?? '')
      setSoreness(row.soreness ?? '')
      setEnergy(row.energy ?? '')
      setNotes(row.notes ?? '')
    }
    setLoading(false)
  }, [athleteId])

  useEffect(() => { load() }, [load])

  const prompt = !today && !loading && shouldPromptToday(today)

  const save = async () => {
    setSaving(true)
    const saved = await recordCheckin({
      athlete_id:    athleteId,
      mood:          typeof mood === 'number' ? mood : null,
      sleep_hours:   typeof sleepHours === 'number' ? sleepHours : null,
      sleep_quality: typeof sleepQuality === 'number' ? sleepQuality : null,
      soreness:      typeof soreness === 'number' ? soreness : null,
      energy:        typeof energy === 'number' ? energy : null,
      notes:         notes.trim() || null,
    })
    setSaving(false)
    if (saved) {
      setToday(saved)
      setOpen(false)
    }
  }

  // ── EMPTY / SUMMARY HEADER ─────────────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full overflow-hidden rounded-[20px] border text-left transition-all hover:shadow-md"
        style={{
          background: 'linear-gradient(135deg,#ECFDF5 0%,#F0FDFA 60%,#FFFFFF 100%)',
          borderColor: '#A7F3D0',
        }}
      >
        <div className="relative flex items-center gap-3 px-4 py-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105"
            style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
          >
            <i className="ki-filled ki-heart text-white text-lg" />
          </div>
          <div className="min-w-0 flex-1">
            {today ? (
              <>
                <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                  Самочувствие сегодня
                </div>
                <div className="mt-1 flex items-center gap-3 text-base text-foreground">
                  {today.mood != null && (
                    <span className="flex items-center gap-1" title={`Настроение: ${MOOD_LABELS[today.mood]}`}>
                      <span className="text-lg">{MOOD_EMOJI[today.mood]}</span>
                    </span>
                  )}
                  {today.sleep_hours != null && (
                    <span className="flex items-center gap-1 text-sm font-semibold text-slate-700" title="Сон">
                      🌙 {today.sleep_hours} ч
                    </span>
                  )}
                  {today.soreness != null && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: sorenessColor(today.soreness) + '20', color: sorenessColor(today.soreness) }}
                      title="Болезненность">
                      Боль {today.soreness}/10
                    </span>
                  )}
                  {today.energy != null && (
                    <span className="text-lg" title={`Энергия: ${ENERGY_LABELS[today.energy]}`}>
                      {ENERGY_EMOJI[today.energy]}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-extrabold text-foreground truncate">
                  Заполни самочувствие
                </div>
                <div className="text-[11px] text-emerald-700/80 mt-0.5">
                  30 секунд утром · поможет тренеру и AI
                </div>
              </>
            )}
          </div>
          <div className="relative shrink-0">
            <i className={`ki-filled ${today ? 'ki-pencil' : 'ki-arrow-right'} text-emerald-600 text-base`} />
            {prompt && (
              <span className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  // ── EXPANDED FORM ──────────────────────────────────────────────────────
  return (
    <div
      className="rounded-[20px] border overflow-hidden"
      style={{
        background: 'linear-gradient(135deg,#ECFDF5 0%,#F0FDFA 60%,#FFFFFF 100%)',
        borderColor: '#A7F3D0',
      }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-100/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-emerald-100">
            <i className="ki-filled ki-heart text-base text-emerald-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-navy-500 leading-none">Самочувствие сегодня</h3>
            <div className="text-[10px] text-muted-foreground mt-1">Заполняй то, что хочешь — все поля опциональные</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)}
          className="kt-btn kt-btn-xs kt-btn-icon kt-btn-ghost"
          title="Свернуть">
          <i className="ki-filled ki-cross text-xs text-muted-foreground" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Mood picker */}
        <Picker label="Настроение" value={mood} onChange={setMood}
          options={[1, 2, 3, 4, 5]}
          renderOption={n => MOOD_EMOJI[n]}
          renderLabel={n => MOOD_LABELS[n]} />

        {/* Energy picker */}
        <Picker label="Энергия" value={energy} onChange={setEnergy}
          options={[1, 2, 3, 4, 5]}
          renderOption={n => ENERGY_EMOJI[n]}
          renderLabel={n => ENERGY_LABELS[n]} />

        {/* Sleep duration + quality */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Сон, часов</label>
            <input
              type="number" min={0} max={14} step={0.5}
              value={sleepHours}
              onChange={e => {
                const v = e.target.value
                setSleepHours(v === '' ? '' : parseFloat(v))
              }}
              placeholder="напр. 7.5"
              className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Качество сна</label>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button"
                  onClick={() => setSleepQuality(sleepQuality === n ? '' : n)}
                  className={`flex h-9 flex-1 items-center justify-center rounded-lg border text-base transition ${
                    sleepQuality === n
                      ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300'
                      : 'border-emerald-100 bg-white hover:border-emerald-200'
                  }`}
                  title={SLEEP_QUALITY_LABELS[n]}>
                  {SLEEP_QUALITY_EMOJI[n]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Soreness 0–10 slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Болезненность</label>
            <span className="text-xs font-bold pf-num"
              style={{ color: typeof soreness === 'number' ? sorenessColor(soreness) : '#94A3B8' }}>
              {typeof soreness === 'number' ? `${soreness}/10` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">0</span>
            <input
              type="range" min={0} max={10} step={1}
              value={soreness === '' ? 0 : soreness}
              onChange={e => setSoreness(parseInt(e.target.value, 10))}
              className="flex-1 accent-emerald-500" />
            <span className="text-[10px] text-muted-foreground">10</span>
            {soreness !== '' && (
              <button onClick={() => setSoreness('')}
                className="text-[10px] text-muted-foreground hover:underline">сброс</button>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Заметка (необязательно)</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="напр. ноет колено / простуда / отлично"
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 outline-none" />
        </div>

        {/* Save */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
            {saving ? 'Сохраняем…' : today ? 'Обновить' : 'Сохранить'}
          </button>
          <button
            onClick={() => setOpen(false)}
            disabled={saving}
            className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

function Picker({
  label, value, onChange, options, renderOption, renderLabel,
}: {
  label: string
  value: number | ''
  onChange: (v: number | '') => void
  options: number[]
  renderOption: (n: number) => string
  renderLabel: (n: number) => string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
        {value !== '' && (
          <span className="text-[11px] font-semibold text-emerald-700">{renderLabel(value)}</span>
        )}
      </div>
      <div className="flex gap-1.5">
        {options.map(n => {
          const selected = value === n
          return (
            <button key={n} type="button"
              onClick={() => onChange(selected ? '' : n)}
              title={renderLabel(n)}
              className={`flex h-11 flex-1 items-center justify-center rounded-xl border text-2xl transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-300 scale-105'
                  : 'border-emerald-100 bg-white hover:border-emerald-200'
              }`}>
              {renderOption(n)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
