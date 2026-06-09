'use client'
/**
 * Medical Summary Demo — Sprint W4 Day 21 (PR #37).
 *
 * Public lead-magnet UI для doctor / sports physician acquisition.
 * Mirror стиля Day 18-20, но purple/violet accent (4-я target persona —
 * клинический контекст, цвет «medical/clinical»).
 *
 * State machine: idle → analyzing → result → submitted
 *
 * Email gate: показываем triage + первый differential, скрываем за blur
 * остальные differentials + next steps + patient education до email.
 *
 * ⚠️ Persistent disclaimer ВЕЗДЕ: hero, form, result, footer:
 *   "AI-generated draft. NOT a diagnosis. Clinical review required."
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Types (mirror server) ────────────────────────────────────────────

type Sex     = 'male' | 'female' | 'other' | 'unspecified'
type Level   = 'recreational' | 'club' | 'national' | 'elite'
type Onset   = 'acute' | 'sub_acute' | 'chronic'
type LoadCh  = 'none' | 'increased' | 'decreased'
type Triage  = 'red_flag' | 'urgent_referral' | 'restricted_activity' | 'monitor' | 'return_to_play'

interface Summary {
  triage:                Triage
  triage_explanation:    string
  red_flags:             string[]
  differential: Array<{
    condition:  string
    likelihood: 'low' | 'medium' | 'high'
    notes:      string
  }>
  recommended_next_steps: {
    imaging_suggested:      string | null
    specialist_referral:    string | null
    activity_modifications: string
    follow_up_timeline:     string
  }
  patient_education:     string[]
  confidence:            'low' | 'medium' | 'high'
}

const TRIAGE_META: Record<Triage, { label: string; color: string; bg: string; border: string; icon: string; tone: string }> = {
  red_flag:            { label: 'Red Flag — immediate evaluation', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', icon: 'ki-notification-bing', tone: 'Direct emergency referral' },
  urgent_referral:     { label: 'Urgent Referral 24-72h',          color: '#B03D04', bg: '#FEF0E7', border: '#FBC1A0', icon: 'ki-information-4', tone: 'Specialist within 24-72h' },
  restricted_activity: { label: 'Restricted Activity',              color: '#A16207', bg: '#FEFCE8', border: '#FDE68A', icon: 'ki-shield-cross', tone: 'Modified training, follow-up 1-2w' },
  monitor:             { label: 'Monitor / Reassess',               color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', icon: 'ki-information-2', tone: 'Watch + reassess 2-4w' },
  return_to_play:      { label: 'Return to Play (with monitoring)', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', icon: 'ki-check-circle', tone: 'Cleared with caveats' },
}

const LIKELIHOOD_META: Record<'low' | 'medium' | 'high', { color: string; bg: string }> = {
  low:    { color: '#64748B', bg: '#F8FAFC' },
  medium: { color: '#0E7490', bg: '#ECFEFF' },
  high:   { color: '#702A0C', bg: '#FEF0E7' },
}

const SPORT_OPTIONS = [
  'Бег', 'Велоспорт', 'Плавание', 'Триатлон',
  'Силовые', 'CrossFit', 'HIIT', 'Йога',
  'Футбол', 'Баскетбол', 'Хоккей', 'Волейбол',
  'Лёгкая атлетика', 'Гимнастика', 'Теннис',
  'Боевые искусства', 'Танцы', 'Другое',
]

// ── Sample data ───────────────────────────────────────────────────────

const SAMPLE_INPUT = {
  age: 24,
  sex: 'male' as Sex,
  sport: 'Бег',
  level: 'club' as Level,
  primary_symptom: 'Боль в передней части голени, усиливается на 2-3 км дистанции, утром стартовая скованность',
  onset: 'sub_acute' as Onset,
  duration_days: 14,
  pain_scale: 5,
  location: 'Передняя поверхность правой голени (medial tibial border)',
  hours_current_week: 8,
  hours_avg_4w: 5,
  recent_load_change: 'increased' as LoadCh,
  activity_type: 'Бег по асфальту',
  previous_similar: false,
  chronic_conditions: '',
  medications: '',
  visible_swelling: false,
  rom_limited: false,
  tenderness: true,
  exam_notes: 'Локальная болезненность при пальпации medial tibial border ~10 см от tibial plateau',
}

// ── Main component ───────────────────────────────────────────────────

export default function MedicalSummaryForm() {
  // Patient demographics
  const [age, setAge]           = useState<number | ''>('')
  const [sex, setSex]           = useState<Sex>('unspecified')
  const [sport, setSport]       = useState('Бег')
  const [level, setLevel]       = useState<Level>('recreational')

  // Presenting complaint
  const [primarySymptom, setPrimarySymptom] = useState('')
  const [onset, setOnset]                   = useState<Onset>('sub_acute')
  const [durationDays, setDurationDays]     = useState<number | ''>('')
  const [painScale, setPainScale]           = useState(5)
  const [location, setLocation]             = useState('')

  // Training load
  const [hoursCurrent, setHoursCurrent]   = useState<number | ''>('')
  const [hoursAvg4w, setHoursAvg4w]       = useState<number | ''>('')
  const [loadChange, setLoadChange]       = useState<LoadCh | ''>('')
  const [activityType, setActivityType]   = useState('')

  // Medical history
  const [previousSimilar, setPreviousSimilar] = useState(false)
  const [chronicConditions, setChronicConditions] = useState('')
  const [medications, setMedications]             = useState('')

  // Examination
  const [visibleSwelling, setVisibleSwelling] = useState(false)
  const [romLimited, setRomLimited]           = useState(false)
  const [tenderness, setTenderness]           = useState(false)
  const [examNotes, setExamNotes]             = useState('')

  // Phase
  const [phase, setPhase]   = useState<'idle' | 'analyzing' | 'result' | 'submitted'>('idle')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // Email gate
  const [email, setEmail]       = useState('')
  const [consent, setConsent]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const canSubmit =
    typeof age === 'number' && age > 0 &&
    primarySymptom.trim().length >= 5 &&
    location.trim().length >= 3 &&
    typeof durationDays === 'number' && durationDays >= 0

  function fillSample() {
    setAge(SAMPLE_INPUT.age); setSex(SAMPLE_INPUT.sex); setSport(SAMPLE_INPUT.sport); setLevel(SAMPLE_INPUT.level)
    setPrimarySymptom(SAMPLE_INPUT.primary_symptom); setOnset(SAMPLE_INPUT.onset)
    setDurationDays(SAMPLE_INPUT.duration_days); setPainScale(SAMPLE_INPUT.pain_scale); setLocation(SAMPLE_INPUT.location)
    setHoursCurrent(SAMPLE_INPUT.hours_current_week); setHoursAvg4w(SAMPLE_INPUT.hours_avg_4w)
    setLoadChange(SAMPLE_INPUT.recent_load_change); setActivityType(SAMPLE_INPUT.activity_type)
    setPreviousSimilar(SAMPLE_INPUT.previous_similar); setChronicConditions(SAMPLE_INPUT.chronic_conditions)
    setMedications(SAMPLE_INPUT.medications)
    setVisibleSwelling(SAMPLE_INPUT.visible_swelling); setRomLimited(SAMPLE_INPUT.rom_limited)
    setTenderness(SAMPLE_INPUT.tenderness); setExamNotes(SAMPLE_INPUT.exam_notes)
  }

  function clearAll() {
    setAge(''); setSex('unspecified'); setSport('Бег'); setLevel('recreational')
    setPrimarySymptom(''); setOnset('sub_acute'); setDurationDays(''); setPainScale(5); setLocation('')
    setHoursCurrent(''); setHoursAvg4w(''); setLoadChange(''); setActivityType('')
    setPreviousSimilar(false); setChronicConditions(''); setMedications('')
    setVisibleSwelling(false); setRomLimited(false); setTenderness(false); setExamNotes('')
    setPhase('idle'); setSummary(null); setAnalyzeError(null)
  }

  async function handleAnalyze() {
    if (!canSubmit) { setAnalyzeError('Заполните обязательные поля: возраст / симптом / локализация / длительность'); return }
    setPhase('analyzing'); setAnalyzeError(null); setSummary(null)
    try {
      const payload = {
        age, sex, sport, level,
        primary_symptom: primarySymptom.trim(),
        onset,
        duration_days: durationDays,
        pain_scale: painScale,
        location: location.trim(),
        hours_current_week: typeof hoursCurrent === 'number' ? hoursCurrent : undefined,
        hours_avg_4w:       typeof hoursAvg4w === 'number' ? hoursAvg4w : undefined,
        recent_load_change: loadChange || undefined,
        activity_type:      activityType.trim() || undefined,
        previous_similar:   previousSimilar,
        chronic_conditions: chronicConditions.trim() || undefined,
        medications:        medications.trim() || undefined,
        visible_swelling:   visibleSwelling,
        rom_limited:        romLimited,
        tenderness:         tenderness,
        exam_notes:         examNotes.trim() || undefined,
      }
      const res = await fetch('/api/tools/medical-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        if (data.error === 'RATE_LIMITED') setAnalyzeError('Слишком много запросов. Попробуйте через час.')
        else if (data.error === 'INVALID_INPUT') setAnalyzeError('Проверьте корректность данных.')
        else setAnalyzeError('Не удалось выполнить assessment. Попробуйте ещё раз.')
        setPhase('idle')
        return
      }
      setSummary(data.data as Summary)
      setPhase('result')
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setAnalyzeError('Сеть недоступна. Попробуйте ещё раз.')
      setPhase('idle')
    }
  }

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
          source: 'medical-summary',
          consent: true,
          payload: {
            sport, level, age, sex,
            triage: summary?.triage,
            confidence: summary?.confidence,
            red_flags_count: summary?.red_flags.length ?? 0,
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

  const showFullReport = phase === 'submitted'

  useEffect(() => {
    if (phase === 'idle' || phase === 'analyzing') return
    setAnalyzeError(null)
  }, [phase])

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 mb-4">
            <i className="ki-filled ki-pulse text-[11px]" />
            Бесплатный инструмент для sport medicine
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
            Free Medical Summary Demo — <span className="text-violet-600">структурированный assessment</span> за 5 минут
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl">
            Введите athlete case data (демография + complaint + training load + history + exam findings).
            AI выдаст triage, red flags, 3-5 differential considerations и план next steps.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1">Без регистрации</span>
            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1">~5 минут</span>
            <span className="rounded-full bg-pink-100 text-pink-700 px-3 py-1">Claude Sonnet 4.5</span>
            <span className="rounded-full bg-green-100 text-green-700 px-3 py-1">152-ФЗ совместимо</span>
          </div>

          {/* Persistent disclaimer */}
          <div className="mt-6 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed">
            <strong className="inline-flex items-center gap-1.5"><i className="ki-filled ki-information-4 text-xs" /> AI-сгенерированный draft, НЕ диагноз.</strong> Этот инструмент создаёт structured template для clinical reference только.
            Все clinical decisions должны быть приняты licensed practitioner после полной evaluation.
            Не используйте автономно для acute / emergency situations — direct medical attention.
          </div>
        </div>
      </section>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold">Athlete case</h2>
              <p className="text-xs text-slate-500 mt-0.5">Все поля приватны — не сохраняются без email confirmation</p>
            </div>
            <div className="flex gap-1.5">
              <button onClick={fillSample} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Пример (бегун, 24, MTSS-like)
              </button>
              <button onClick={clearAll} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Очистить
              </button>
            </div>
          </div>

          {/* Section 1: Patient demographics */}
          <FormSection title="1. Patient demographics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Возраст *">
                <input value={age} onChange={e => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={8} max={99} required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
              <Field label="Пол">
                <select value={sex} onChange={e => setSex(e.target.value as Sex)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400">
                  <option value="unspecified">Не указано</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="other">Иное</option>
                </select>
              </Field>
              <Field label="Спорт">
                <select value={sport} onChange={e => setSport(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400">
                  {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Уровень">
                <select value={level} onChange={e => setLevel(e.target.value as Level)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400">
                  <option value="recreational">Любитель</option>
                  <option value="club">Клубный</option>
                  <option value="national">Национальный</option>
                  <option value="elite">Элита</option>
                </select>
              </Field>
            </div>
          </FormSection>

          {/* Section 2: Presenting complaint */}
          <FormSection title="2. Presenting complaint">
            <div className="space-y-3">
              <Field label="Primary symptom *">
                <textarea value={primarySymptom} onChange={e => setPrimarySymptom(e.target.value)}
                  rows={2} maxLength={400} required
                  placeholder="Боль в передней части голени, усиливается на 2-3 км"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Локализация *">
                  <input value={location} onChange={e => setLocation(e.target.value)} maxLength={120} required
                    placeholder="Правая голень, medial tibial border"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                </Field>
                <Field label="Onset">
                  <select value={onset} onChange={e => setOnset(e.target.value as Onset)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400">
                    <option value="acute">Acute (&lt; 1 нед)</option>
                    <option value="sub_acute">Sub-acute (1-6 нед)</option>
                    <option value="chronic">Chronic (&gt; 6 нед)</option>
                  </select>
                </Field>
                <Field label="Длительность (дни) *">
                  <input value={durationDays} onChange={e => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
                    type="number" min={0} max={3650} required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                </Field>
              </div>
              <Field label={`Pain scale (VAS): ${painScale}/10`}>
                <input type="range" min={0} max={10} step={1} value={painScale}
                  onChange={e => setPainScale(Number(e.target.value))}
                  className="mt-1 w-full accent-violet-500" />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>0 нет</span><span>5 средняя</span><span>10 невыносимая</span>
                </div>
              </Field>
            </div>
          </FormSection>

          {/* Section 3: Training load */}
          <FormSection title="3. Recent training load (опц.)">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Часы тек. неделя">
                <input value={hoursCurrent} onChange={e => setHoursCurrent(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} max={60} step={0.5}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
              <Field label="Avg 4 нед">
                <input value={hoursAvg4w} onChange={e => setHoursAvg4w(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} max={60} step={0.5}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
              <Field label="Изм. нагрузки">
                <select value={loadChange} onChange={e => setLoadChange(e.target.value as '' | LoadCh)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400">
                  <option value="">—</option>
                  <option value="none">Стабильна</option>
                  <option value="increased">Выросла</option>
                  <option value="decreased">Снизилась</option>
                </select>
              </Field>
              <Field label="Тип активности">
                <input value={activityType} onChange={e => setActivityType(e.target.value)} maxLength={60}
                  placeholder="Бег по асфальту"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
            </div>
          </FormSection>

          {/* Section 4: Medical history */}
          <FormSection title="4. Medical history (опц.)">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={previousSimilar} onChange={e => setPreviousSimilar(e.target.checked)}
                  className="accent-violet-500" />
                Был похожий эпизод ранее
              </label>
              <Field label="Хронические состояния">
                <textarea value={chronicConditions} onChange={e => setChronicConditions(e.target.value)}
                  rows={2} maxLength={400}
                  placeholder="Диабет, гипертония, известная травма колена 2 года назад…"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
              <Field label="Текущие препараты">
                <textarea value={medications} onChange={e => setMedications(e.target.value)}
                  rows={2} maxLength={400}
                  placeholder="NSAIDs prn, мультивитамины, …"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
            </div>
          </FormSection>

          {/* Section 5: Examination */}
          <FormSection title="5. Examination findings (опц.)">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={visibleSwelling} onChange={e => setVisibleSwelling(e.target.checked)}
                    className="accent-violet-500" />
                  Visible swelling
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={romLimited} onChange={e => setRomLimited(e.target.checked)}
                    className="accent-violet-500" />
                  Range of motion limited
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={tenderness} onChange={e => setTenderness(e.target.checked)}
                    className="accent-violet-500" />
                  Tenderness on palpation
                </label>
              </div>
              <Field label="Дополнительные exam notes">
                <textarea value={examNotes} onChange={e => setExamNotes(e.target.value)}
                  rows={3} maxLength={400}
                  placeholder="Локальная болезненность medial tibial border ~10 см от tibial plateau, без неврологического дефицита…"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
              </Field>
            </div>
          </FormSection>

          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-200">
            <button onClick={handleAnalyze} disabled={!canSubmit || phase !== 'idle'}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
              {phase === 'analyzing' ? 'Анализируем case…' : 'Получить assessment template →'}
            </button>
          </div>

          {analyzeError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{analyzeError}</div>
          )}
        </div>
      </section>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {summary && (
        <section id="result-section" className="mx-auto max-w-5xl px-5 pb-10">
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/40 to-white p-5 md:p-6">
            {/* Disclaimer at top */}
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 mb-5 text-xs text-amber-900 leading-relaxed">
              <strong className="inline-flex items-center gap-1.5"><i className="ki-filled ki-information-4 text-xs" /> AI-generated draft. NOT a diagnosis.</strong> Все clinical decisions требуют review licensed practitioner.
              Confidence level отчёта: <strong>{summary.confidence.toUpperCase()}</strong>
              {summary.confidence === 'low' && ' — низкая уверенность из-за ограниченной info; рассмотрите дополнительные findings.'}
            </div>

            <h2 className="text-xl md:text-2xl font-bold mb-4 inline-flex items-center gap-2"><i className="ki-filled ki-clipboard text-xl" /> Assessment Template</h2>

            {/* Triage hero */}
            <div className="rounded-2xl border-2 p-5 mb-5"
              style={{ background: TRIAGE_META[summary.triage].bg, borderColor: TRIAGE_META[summary.triage].color }}>
              <div className="flex items-start gap-4">
                <div className="text-4xl" style={{ color: TRIAGE_META[summary.triage].color }}>
                  <i className={`ki-filled ${TRIAGE_META[summary.triage].icon}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: TRIAGE_META[summary.triage].color }}>
                    Triage classification
                  </div>
                  <div className="text-lg font-bold" style={{ color: TRIAGE_META[summary.triage].color }}>
                    {TRIAGE_META[summary.triage].label}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{TRIAGE_META[summary.triage].tone}</div>
                  <p className="mt-3 text-sm text-slate-800 leading-relaxed">{summary.triage_explanation}</p>
                </div>
              </div>
            </div>

            {/* Red flags (if any) */}
            {summary.red_flags.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-800 mb-2 inline-flex items-center gap-1.5"><i className="ki-filled ki-notification-bing text-xs" /> Red flags identified</h3>
                <ul className="space-y-1.5 text-sm text-red-900">
                  {summary.red_flags.map((rf, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-bold">•</span>
                      <span>{rf}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Differential */}
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 inline-flex items-center gap-1.5"><i className="ki-filled ki-message-programming text-sm" /> Differential considerations</h3>
            <div className="space-y-2 mb-5">
              {summary.differential.map((d, i) => {
                const meta = LIKELIHOOD_META[d.likelihood]
                const blurred = !showFullReport && i >= 1
                return (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 transition-all relative overflow-hidden">
                    <div className={blurred ? 'blur-[5px] select-none pointer-events-none' : ''}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <h4 className="text-sm font-bold text-slate-900">{d.condition}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
                          {d.likelihood}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">{d.notes}</p>
                    </div>
                    {blurred && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <span className="text-[11px] font-bold text-slate-700 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm inline-flex items-center gap-1.5">
                          <i className="ki-filled ki-lock-2 text-[11px]" />
                          email откроет
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Recommended next steps */}
            {showFullReport && (
              <>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 inline-flex items-center gap-1.5"><i className="ki-filled ki-pulse text-sm" /> Recommended next steps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  {summary.recommended_next_steps.imaging_suggested && (
                    <NextStepCard label="Imaging" value={summary.recommended_next_steps.imaging_suggested} />
                  )}
                  {summary.recommended_next_steps.specialist_referral && (
                    <NextStepCard label="Specialist referral" value={summary.recommended_next_steps.specialist_referral} />
                  )}
                  <NextStepCard label="Activity modifications" value={summary.recommended_next_steps.activity_modifications} />
                  <NextStepCard label="Follow-up timeline" value={summary.recommended_next_steps.follow_up_timeline} />
                </div>

                {/* Patient education */}
                {summary.patient_education.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 mb-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2 inline-flex items-center gap-1.5"><i className="ki-filled ki-book text-xs" /> Patient education points</h3>
                    <ul className="space-y-1.5 text-sm text-slate-800">
                      {summary.patient_education.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-bold text-blue-700">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer disclaimer */}
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed">
                  <strong>Disclaimer:</strong> Этот summary создан AI на основе предоставленных данных. Он НЕ заменяет clinical examination,
                  imaging studies, lab work или judgment licensed practitioner. Если есть signs of acute distress —
                  refer to emergency services. Confidence level: <strong>{summary.confidence}</strong>.
                </div>
              </>
            )}

            {/* Email gate */}
            {phase === 'result' && (
              <form onSubmit={handleEmailSubmit} className="mt-5 p-4 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/40">
                <p className="text-sm font-bold text-slate-800 mb-2.5 inline-flex items-center gap-1.5">
                  <i className="ki-filled ki-lock-2 text-sm" />
                  Открыть полный assessment ({summary.differential.length} differential + next steps + patient education)
                </p>
                <input type="email" required placeholder="doctor@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400" />
                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 accent-violet-500" />
                  <span>Согласен получать ежемесячный sport medicine digest и кейсы. Отписка в 1 клик.</span>
                </label>
                {emailError && <p className="mt-1.5 text-[11px] text-red-600">{emailError}</p>}
                <button type="submit" disabled={sending || !email}
                  className="mt-3 w-full rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Открыть полный отчёт →'}
                </button>
              </form>
            )}

            {phase === 'submitted' && (
              <div className="mt-5 p-4 rounded-xl border border-green-200 bg-green-50">
                <p className="text-sm font-bold text-green-800 inline-flex items-center gap-1.5"><i className="ki-filled ki-check text-sm" /> Полный assessment template открыт выше.</p>
                <p className="mt-1 text-xs text-green-700">
                  Хотите вести медицинскую документацию атлетов в одной системе?
                  Sporteo для врачей: structured recommendations с visibility levels (athlete only / coach only / org_full),
                  автоматический notification dispatch, история восстановления через wearables.
                </p>
                <Link href="/auth/register?utm_source=tools&utm_medium=medical-summary"
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
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Как работает Medical Summary Demo</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <div>
              <div className="font-bold mb-1 inline-flex items-center gap-1.5"><i className="ki-filled ki-notification-bing text-sm" /> Triage cascading rules</div>
              Pain ≥9 OR red-flag keywords (chest pain, syncope) → red_flag.
              Triple-positive exam → urgent_referral. Acute load increase → restricted.
            </div>
            <div>
              <div className="font-bold mb-1 inline-flex items-center gap-1.5"><i className="ki-filled ki-message-programming text-sm" /> Differential weighting</div>
              Onset (acute / sub-acute / chronic) определяет likely categories: strain → tendinopathy → overuse pathology.
            </div>
            <div>
              <div className="font-bold mb-1 inline-flex items-center gap-1.5"><i className="ki-filled ki-chart-simple text-sm" /> Confidence scoring</div>
              Уровень уверенности зависит от полноты exam findings. Низкая уверенность = recommend дополнительные tests.
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-10">
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold">Документируйте medical findings правильно</h3>
          <p className="mt-1 text-sm md:text-base opacity-90">
            Sporteo для врачей: structured recommendations с privacy levels (athlete only / coach + athlete / org_full),
            integration с тренировочными данными атлета, автоматический dispatch уведомлений тренеру и атлету.
          </p>
          <Link href="/auth/register?utm_source=tools&utm_medium=medical-summary&utm_campaign=cta"
            className="mt-4 inline-block rounded-xl bg-white text-violet-700 px-5 py-2.5 text-sm font-bold hover:bg-violet-50">
            Начать бесплатно →
          </Link>
        </div>
      </section>

      {/* ── Cross-link ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-5 pb-10 text-center text-sm text-slate-500">
        Ещё для медицины:{' '}
        <Link href="/tools/team-risk" className="text-violet-700 hover:underline font-semibold">
          Team Risk (тренеры)
        </Link>
        {' · '}
        <Link href="/tools/club-audit" className="text-violet-700 hover:underline font-semibold">
          Club Audit (директора)
        </Link>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  )
}

function NextStepCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  )
}
