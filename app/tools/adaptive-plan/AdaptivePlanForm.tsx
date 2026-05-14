'use client'
/**
 * Adaptive Plan Preview — Sprint W4 Day 19 (PR #35).
 *
 * Public lead-magnet UI для атлетов. Mirror стиля /tools/team-risk
 * (Day 18) с blue accent чтобы визуально отличаться (team-risk = orange
 * для тренеров; adaptive-plan = blue для атлетов).
 *
 * State machine: idle → analyzing → result → submitted
 *
 * Email gate pattern: показываем 3 первых дня плана + overview, скрываем
 * за blur 4 оставшихся дня + rationale + red_flags до email submit.
 */
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

// ── Types (mirror server-side AdaptivePlanInput / Preview) ───────────

type Felt      = 'great' | 'ok' | 'tired' | 'exhausted'
type Level     = 'beginner' | 'intermediate' | 'advanced' | 'pro' | 'recreational'
type Intensity = 'easy' | 'moderate' | 'hard' | 'rest'

interface WorkoutRow {
  id:              string
  date:            string  // YYYY-MM-DD
  activity_type:   string
  duration_min:    string
  perceived_load:  string
  recovery_score:  string
  felt:            '' | Felt
}

interface Plan {
  overview:                string
  weekly_load_assessment:  'low' | 'moderate' | 'high' | 'overtraining'
  days: Array<{
    day:           number
    weekday:       string
    activity_type: string
    duration_min:  number
    intensity:     Intensity
    notes:         string
  }>
  rationale:   string
  red_flags:   string[]
}

const INTENSITY_META: Record<Intensity, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  rest:     { label: 'Отдых',  color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', emoji: '🛌' },
  easy:     { label: 'Easy',   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', emoji: '🟢' },
  moderate: { label: 'Mod',    color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', emoji: '🟦' },
  hard:     { label: 'Hard',   color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', emoji: '🔥' },
}

const ASSESSMENT_META: Record<Plan['weekly_load_assessment'], { label: string; color: string; bg: string; border: string }> = {
  low:           { label: 'Низкая нагрузка',     color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  moderate:      { label: 'Сбалансированная',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  high:          { label: 'Высокая',             color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A' },
  overtraining:  { label: 'Перетренированность', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

const SPORT_OPTIONS = [
  'Бег', 'Велоспорт', 'Плавание', 'Триатлон',
  'Силовые', 'CrossFit', 'HIIT', 'Йога',
  'Футбол', 'Баскетбол', 'Хоккей', 'Другое',
]

const LEVEL_OPTIONS: Array<{ value: Level; label: string }> = [
  { value: 'beginner',     label: 'Новичок' },
  { value: 'recreational', label: 'Любитель' },
  { value: 'intermediate', label: 'Средний' },
  { value: 'advanced',     label: 'Продвинутый' },
  { value: 'pro',          label: 'Профи' },
]

// ── Sample data (4 weeks worth, sport=Бег) ────────────────────────────

function generateSample(): WorkoutRow[] {
  const today = new Date()
  const out: WorkoutRow[] = []
  // 14 workouts over last 28 days, varying load
  const presets = [
    { activity_type: 'Бег',       duration_min: '45', perceived_load: '6', recovery_score: '70', felt: 'ok' as Felt },
    { activity_type: 'Силовые',   duration_min: '50', perceived_load: '7', recovery_score: '65', felt: 'ok' as Felt },
    { activity_type: 'Бег',       duration_min: '60', perceived_load: '8', recovery_score: '55', felt: 'tired' as Felt },
    { activity_type: 'Бег',       duration_min: '30', perceived_load: '4', recovery_score: '80', felt: 'great' as Felt },
    { activity_type: 'Велоспорт', duration_min: '90', perceived_load: '5', recovery_score: '72', felt: 'ok' as Felt },
    { activity_type: 'Бег',       duration_min: '75', perceived_load: '8', recovery_score: '50', felt: 'tired' as Felt },
    { activity_type: 'Силовые',   duration_min: '45', perceived_load: '7', recovery_score: '60', felt: 'ok' as Felt },
    { activity_type: 'Бег',       duration_min: '50', perceived_load: '6', recovery_score: '68', felt: 'ok' as Felt },
    { activity_type: 'Йога',      duration_min: '40', perceived_load: '3', recovery_score: '85', felt: 'great' as Felt },
    { activity_type: 'Бег',       duration_min: '90', perceived_load: '9', recovery_score: '45', felt: 'exhausted' as Felt },
    { activity_type: 'Силовые',   duration_min: '55', perceived_load: '7', recovery_score: '62', felt: 'ok' as Felt },
    { activity_type: 'Бег',       duration_min: '40', perceived_load: '5', recovery_score: '75', felt: 'ok' as Felt },
    { activity_type: 'Велоспорт', duration_min: '60', perceived_load: '6', recovery_score: '70', felt: 'ok' as Felt },
    { activity_type: 'Бег',       duration_min: '35', perceived_load: '5', recovery_score: '78', felt: 'great' as Felt },
  ]
  presets.forEach((p, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (i * 2 + 1))
    out.push({ id: String(i + 1), date: d.toISOString().slice(0, 10), ...p })
  })
  return out
}

// ── Main component ───────────────────────────────────────────────────

export default function AdaptivePlanForm() {
  const [sport, setSport]   = useState('Бег')
  const [goal, setGoal]     = useState('')
  const [level, setLevel]   = useState<Level>('intermediate')
  const [rows, setRows]     = useState<WorkoutRow[]>([emptyRow('1'), emptyRow('2'), emptyRow('3')])

  const [phase, setPhase]   = useState<'idle' | 'analyzing' | 'result' | 'submitted'>('idle')
  const [plan, setPlan]     = useState<Plan | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // Email gate
  const [email, setEmail]       = useState('')
  const [consent, setConsent]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Validation ─────────────────────────────────────────────────────
  const validRows = useMemo(() => {
    return rows.filter(r => {
      if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return false
      if (!r.activity_type.trim()) return false
      const d = parseFloat(r.duration_min)
      return Number.isFinite(d) && d >= 0 && d <= 600
    })
  }, [rows])

  const canSubmit = validRows.length >= 1

  function emptyRow(id: string): WorkoutRow {
    return { id, date: '', activity_type: 'Бег', duration_min: '', perceived_load: '', recovery_score: '', felt: '' }
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(String(prev.length + 1))])
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  function updateRow(id: string, patch: Partial<WorkoutRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function fillSample() {
    setRows(generateSample())
    setSport('Бег')
    setGoal('Подготовка к полумарафону за 4 месяца')
    setLevel('intermediate')
  }

  function clearAll() {
    setRows([emptyRow('1'), emptyRow('2'), emptyRow('3')])
    setSport('Бег')
    setGoal('')
    setLevel('intermediate')
    setPhase('idle')
    setPlan(null)
    setAnalyzeError(null)
  }

  // ── CSV upload (inline parser, формат: date,activity,duration,rpe,recovery,felt) ─
  function handleCsvUpload(file: File | null | undefined) {
    if (!file) return
    if (file.size > 64 * 1024) { setAnalyzeError('Файл слишком большой (макс 64 KB)'); return }
    file.text().then(text => {
      const cleaned = text.replace(/^﻿/, '')
      const lines = cleaned.split(/\r?\n/).filter(l => l.trim())
      if (lines.length === 0) { setAnalyzeError('Пустой файл'); return }

      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
      const split = (line: string) => line.split(sep).map(s => s.trim())

      const firstCols = split(lines[0]).map(s => s.toLowerCase())
      const hasHeader = firstCols.includes('date') || firstCols.includes('дата')
      const dataLines = hasHeader ? lines.slice(1) : lines

      const parsed: WorkoutRow[] = []
      for (let i = 0; i < dataLines.length; i++) {
        const cols = split(dataLines[i])
        const date = cols[0]
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
        parsed.push({
          id:              String(i + 1),
          date,
          activity_type:   cols[1] ?? 'Тренировка',
          duration_min:    cols[2] ?? '',
          perceived_load:  cols[3] ?? '',
          recovery_score:  cols[4] ?? '',
          felt:            normalizeFelt(cols[5]),
        })
      }

      if (parsed.length === 0) {
        setAnalyzeError('CSV не содержит валидных строк. Формат: date(YYYY-MM-DD),activity,duration,rpe,recovery,felt')
        return
      }
      if (parsed.length > 30) {
        setAnalyzeError(`Максимум 30 тренировок за раз. В CSV найдено ${parsed.length}`)
        return
      }
      setRows(parsed)
      setAnalyzeError(null)
    }).catch(() => setAnalyzeError('Не удалось прочитать файл'))
  }

  function normalizeFelt(raw: string | undefined): '' | Felt {
    if (!raw) return ''
    const v = raw.trim().toLowerCase()
    if (v === 'great' || v === 'отлично')    return 'great'
    if (v === 'ok' || v === 'норма')          return 'ok'
    if (v === 'tired' || v === 'уставший')    return 'tired'
    if (v === 'exhausted' || v === 'истощён') return 'exhausted'
    return ''
  }

  // ── Submit analyze ─────────────────────────────────────────────────
  async function handleAnalyze() {
    if (validRows.length === 0) { setAnalyzeError('Заполните минимум одну тренировку'); return }
    setPhase('analyzing')
    setAnalyzeError(null)
    setPlan(null)
    try {
      const payload = {
        sport,
        goal: goal.trim() || undefined,
        level,
        weeks_history: validRows.map(r => ({
          date:           r.date,
          activity_type:  r.activity_type.trim(),
          duration_min:   parseFloat(r.duration_min),
          perceived_load: r.perceived_load ? parseInt(r.perceived_load, 10) : undefined,
          recovery_score: r.recovery_score ? parseInt(r.recovery_score, 10) : undefined,
          felt:           r.felt || undefined,
        })),
      }
      const res = await fetch('/api/tools/adaptive-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        if (data.error === 'RATE_LIMITED') {
          setAnalyzeError('Слишком много запросов. Попробуйте через час.')
        } else if (data.error === 'INVALID_INPUT') {
          setAnalyzeError('Проверьте формат данных. Дата в YYYY-MM-DD, длительность 0-600.')
        } else {
          setAnalyzeError('Не удалось сгенерировать план. Попробуйте ещё раз.')
        }
        setPhase('idle')
        return
      }
      setPlan(data.data as Plan)
      setPhase('result')
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setAnalyzeError('Сеть недоступна. Попробуйте ещё раз.')
      setPhase('idle')
    }
  }

  // ── Email submit ───────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    if (!email.trim()) { setEmailError('Введите email'); return }
    if (!consent) { setEmailError('Нужно подтвердить согласие'); return }
    setSending(true)
    try {
      const res = await fetch('/api/tools/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'adaptive-plan',
          consent: true,
          payload: {
            sport,
            level,
            workouts_count: validRows.length,
            weekly_load_assessment: plan?.weekly_load_assessment,
          },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEmailError(data.error === 'rate_limited' ? 'Превышен лимит. Попробуйте через час.' : 'Не удалось отправить.')
        return
      }
      setPhase('submitted')
    } finally {
      setSending(false)
    }
  }

  const showAllDays = phase === 'submitted'

  useEffect(() => {
    if (phase === 'idle' || phase === 'analyzing') return
    setAnalyzeError(null)
  }, [phase])

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-cyan-50 border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-4">
            🎯 Бесплатный AI-инструмент
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
            Free 7-day Adaptive Plan — <span className="text-blue-600">персональный план</span> за 60 секунд
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl">
            Опишите цель + последние 4 недели тренировок (3-30 записей).
            AI учтёт вашу нагрузку, recovery и mood — и выдаст 7-дневный план с конкретными действиями по дням.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1">Без регистрации</span>
            <span className="rounded-full bg-green-100 text-green-700 px-3 py-1">CSV-импорт</span>
            <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1">Claude Haiku 4.5</span>
            <span className="rounded-full bg-orange-100 text-orange-700 px-3 py-1">Под уровень / цель</span>
          </div>
        </div>
      </section>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold">История тренировок</h2>
              <p className="text-xs text-slate-500 mt-0.5">Минимум 1 запись, рекомендуем 8-14 за последние 4 недели</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={fillSample} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Пример (бегун, 14 тренировок)
              </button>
              <button onClick={() => fileRef.current?.click()} type="button"
                className="rounded-md border border-blue-200 bg-blue-50 text-blue-700 px-2.5 py-1 text-[11px] font-semibold hover:bg-blue-100">
                CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
                onChange={e => handleCsvUpload(e.target.files?.[0])} />
              <button onClick={clearAll} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Очистить
              </button>
            </div>
          </div>

          {/* Sport + goal + level */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Спорт</label>
              <select value={sport} onChange={e => setSport(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
                {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Уровень</label>
              <select value={level} onChange={e => setLevel(e.target.value as Level)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400">
                {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Цель (опц.)</label>
              <input value={goal} onChange={e => setGoal(e.target.value)} maxLength={400}
                placeholder="Полумарафон за 4 месяца"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>

          {/* Workout rows */}
          <div className="space-y-2 mb-3">
            {rows.map((r, idx) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">#{idx + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(r.id)} type="button"
                      className="text-[11px] font-semibold text-red-600 hover:underline">
                      Удалить
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <input value={r.date} onChange={e => updateRow(r.id, { date: e.target.value })}
                    type="date"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
                  <input value={r.activity_type} onChange={e => updateRow(r.id, { activity_type: e.target.value })} maxLength={40}
                    placeholder="Бег"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
                  <input value={r.duration_min} onChange={e => updateRow(r.id, { duration_min: e.target.value })}
                    type="number" min={0} max={600} placeholder="Мин"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
                  <input value={r.perceived_load} onChange={e => updateRow(r.id, { perceived_load: e.target.value })}
                    type="number" min={0} max={10} placeholder="RPE 0-10"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
                  <input value={r.recovery_score} onChange={e => updateRow(r.id, { recovery_score: e.target.value })}
                    type="number" min={0} max={100} placeholder="Recovery"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400" />
                  <select value={r.felt} onChange={e => updateRow(r.id, { felt: e.target.value as '' | Felt })}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400">
                    <option value="">Felt</option>
                    <option value="great">Great</option>
                    <option value="ok">OK</option>
                    <option value="tired">Tired</option>
                    <option value="exhausted">Exhausted</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={addRow} type="button" disabled={rows.length >= 30}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              + Тренировка ({rows.length}/30)
            </button>
            <button onClick={handleAnalyze} disabled={!canSubmit || phase !== 'idle'}
              className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
              {phase === 'analyzing' ? 'Генерируем план…' : `Получить план (${validRows.length})`}
            </button>
          </div>

          {analyzeError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {analyzeError}
            </div>
          )}

          <p className="mt-2 text-[10px] text-slate-400">
            CSV-формат: <code>date,activity,duration,rpe,recovery,felt</code> · разделитель определяется автоматически
          </p>
        </div>
      </section>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {plan && (
        <section id="result-section" className="mx-auto max-w-5xl px-5 pb-10">
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/40 to-white p-5 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-3">📅 Ваш 7-дневный план</h2>

            {/* Overview + assessment */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Обзор</div>
                <p className="text-sm text-slate-800">{plan.overview}</p>
              </div>
              <div className="rounded-xl border p-4 text-center"
                style={{ background: ASSESSMENT_META[plan.weekly_load_assessment].bg, borderColor: ASSESSMENT_META[plan.weekly_load_assessment].border }}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: ASSESSMENT_META[plan.weekly_load_assessment].color }}>
                  Нагрузка
                </div>
                <div className="text-sm font-bold"
                  style={{ color: ASSESSMENT_META[plan.weekly_load_assessment].color }}>
                  {ASSESSMENT_META[plan.weekly_load_assessment].label}
                </div>
              </div>
            </div>

            {/* Days */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-5">
              {plan.days.map((d, i) => {
                const meta = INTENSITY_META[d.intensity]
                const blurred = !showAllDays && i >= 3
                return (
                  <div key={i} className="rounded-xl border p-3 transition-all relative overflow-hidden"
                    style={{ background: meta.bg, borderColor: meta.border }}>
                    <div className={blurred ? 'blur-[5px] select-none pointer-events-none' : ''}>
                      <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: meta.color }}>
                        День {d.day} · {d.weekday.slice(0, 3)}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mb-1">{d.activity_type}</div>
                      <div className="text-[10px] text-slate-700 mb-1.5">
                        {d.duration_min > 0 ? `${d.duration_min} мин` : '—'}
                      </div>
                      <span className="inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ background: 'white', color: meta.color, border: `1px solid ${meta.border}` }}>
                        {meta.emoji} {meta.label}
                      </span>
                      <p className="mt-1.5 text-[10px] text-slate-700 leading-snug">{d.notes}</p>
                    </div>
                    {blurred && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                          🔒
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Rationale + red flags */}
            {showAllDays && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Логика плана</div>
                  <p className="text-sm text-slate-800">{plan.rationale}</p>
                </div>

                {plan.red_flags.length > 0 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700 mb-2">
                      ⚠️ На что обратить внимание
                    </div>
                    <ul className="space-y-1 text-sm text-slate-800">
                      {plan.red_flags.map((rf, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-orange-600">•</span>
                          <span>{rf}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Email gate */}
            {phase === 'result' && (
              <form onSubmit={handleEmailSubmit} className="mt-5 p-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/40">
                <p className="text-sm font-bold text-slate-800 mb-2.5">
                  🔒 Открыть полный план (все 7 дней + логика + red flags)
                </p>
                <input type="email" required placeholder="athlete@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 accent-blue-500" />
                  <span>Согласен получать еженедельные планы тренировок и советы по адаптации. Отписка в 1 клик.</span>
                </label>
                {emailError && <p className="mt-1.5 text-[11px] text-red-600">{emailError}</p>}
                <button type="submit" disabled={sending || !email}
                  className="mt-3 w-full rounded-lg bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Открыть полный план →'}
                </button>
              </form>
            )}

            {phase === 'submitted' && (
              <div className="mt-5 p-4 rounded-xl border border-green-200 bg-green-50">
                <p className="text-sm font-bold text-green-800">
                  ✅ Готово! Полный план открыт выше.
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Хотите чтобы план обновлялся каждую неделю автоматически?
                  В ProForm ваши тренировки логируются + Garmin / Whoop —
                  AI-план каждую неделю с учётом фактической нагрузки и recovery.
                </p>
                <Link href="/auth/register?utm_source=tools&utm_medium=adaptive-plan"
                  className="mt-3 inline-block rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-bold">
                  Начать бесплатно →
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Science section ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Как работает Adaptive Plan</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <div>
              <div className="font-bold mb-1">📊 ACWR + recovery</div>
              План учитывает соотношение острой к хронической нагрузке (Gabbett, 2016)
              и среднее восстановление за 4 недели.
            </div>
            <div>
              <div className="font-bold mb-1">⚖️ Принцип балансa</div>
              Sweet-spot структура: 1-2 hard + 2-3 moderate + 1-2 easy + 1-2 rest
              в неделю. Минимум 1 день полного отдыха.
            </div>
            <div>
              <div className="font-bold mb-1">🤖 Claude Haiku</div>
              AI читает историю, применяет правила (deload / ramp-up / sweet-spot)
              и формулирует action items по каждому дню.
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-10">
        <div className="rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold">Хотите свежий план каждую неделю автоматически?</h3>
          <p className="mt-1 text-sm md:text-base opacity-90">
            ProForm логирует ваши тренировки + Garmin / Whoop / Apple Health.
            Каждую неделю AI обновляет план на основе фактической нагрузки и recovery.
          </p>
          <Link href="/auth/register?utm_source=tools&utm_medium=adaptive-plan&utm_campaign=cta"
            className="mt-4 inline-block rounded-xl bg-white text-blue-600 px-5 py-2.5 text-sm font-bold hover:bg-blue-50">
            Начать бесплатно →
          </Link>
        </div>
      </section>

      {/* ── Cross-link ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-5 pb-10 text-center text-sm text-slate-500">
        Ещё для атлетов:{' '}
        <Link href="/tools/acwr" className="text-blue-600 hover:underline font-semibold">
          калькулятор ACWR
        </Link>
        {' · '}
        <Link href="/tools/overtraining" className="text-blue-600 hover:underline font-semibold">
          тест на перетренированность
        </Link>
        {' · '}
        <Link href="/tools/team-risk" className="text-blue-600 hover:underline font-semibold">
          Team Risk (для тренеров)
        </Link>
      </div>
    </div>
  )
}
