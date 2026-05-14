'use client'
/**
 * Club Audit — Sprint W4 Day 20 (PR #36).
 *
 * Public lead-magnet UI для org-admin / club managers. Mirror стиля
 * Day 18 team-risk + Day 19 adaptive-plan, но с emerald/green accent
 * (третий target persona — управленческий, цвет «зрелого роста»).
 *
 * State machine: idle → analyzing → result → submitted
 *
 * Email gate: показываем health score + summary + первый risk area, скрываем
 * за blur оставшиеся risk areas + priorities + next steps.
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

// ── Types (mirror server) ────────────────────────────────────────────

type TrackingMethod = 'app' | 'excel' | 'whatsapp' | 'paper' | 'none' | 'other'
type PainPoint =
  | 'retention' | 'coach_overload' | 'data_visibility' | 'schedule_chaos'
  | 'parent_communication' | 'medical_tracking' | 'billing_chaos' | 'no_growth'

interface AuditReport {
  health_score:               number
  health_label:               'critical' | 'at-risk' | 'stable' | 'healthy'
  summary:                    string
  risk_areas: Array<{
    name:                string
    severity:            'low' | 'medium' | 'high'
    current_state:       string
    recommended_action:  string
    proform_helps_with?: string
  }>
  top_3_priorities:           string[]
  estimated_revenue_at_risk?: string
  next_steps:                 string
}

const HEALTH_META: Record<AuditReport['health_label'], { label: string; color: string; bg: string; border: string; emoji: string }> = {
  critical: { label: 'Критическое',  color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', emoji: '🚨' },
  'at-risk':{ label: 'В зоне риска',  color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', emoji: '⚠️' },
  stable:   { label: 'Стабильное',    color: '#A16207', bg: '#FEFCE8', border: '#FDE68A', emoji: '🟡' },
  healthy:  { label: 'Здоровое',      color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', emoji: '🟢' },
}

const SEVERITY_META: Record<'low' | 'medium' | 'high', { color: string; bg: string; border: string; emoji: string }> = {
  low:    { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', emoji: '🟢' },
  medium: { color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', emoji: '🟡' },
  high:   { color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', emoji: '🔴' },
}

const SPORT_OPTIONS = [
  'Футбол', 'Баскетбол', 'Хоккей', 'Бег', 'Триатлон',
  'Силовые', 'CrossFit', 'Плавание', 'Волейбол', 'Лёгкая атлетика',
  'Гимнастика', 'Теннис', 'Боевые искусства', 'Танцы', 'Другое',
]

const TRACKING_OPTIONS: Array<{ value: TrackingMethod; label: string }> = [
  { value: 'app',      label: '📱 Специализированное приложение' },
  { value: 'excel',    label: '📊 Excel / Google Sheets' },
  { value: 'whatsapp', label: '💬 Чаты / WhatsApp' },
  { value: 'paper',    label: '📝 Бумага / тетради' },
  { value: 'none',     label: '🚫 Никак не отслеживаем' },
  { value: 'other',    label: '🔀 Смешанные / другое' },
]

const PAIN_POINTS: Array<{ value: PainPoint; label: string; emoji: string }> = [
  { value: 'retention',            label: 'Атлеты уходят без предупреждения', emoji: '🚪' },
  { value: 'coach_overload',       label: 'Тренеры перегружены',              emoji: '😓' },
  { value: 'data_visibility',      label: 'Не видно качества тренировок',     emoji: '🔍' },
  { value: 'schedule_chaos',       label: 'Хаос в расписании',                emoji: '📅' },
  { value: 'parent_communication', label: 'Сложно общаться с родителями',     emoji: '👨‍👩‍👧' },
  { value: 'medical_tracking',     label: 'Мед.допуски не отслеживаются',     emoji: '🏥' },
  { value: 'billing_chaos',        label: 'Хаос в биллинге',                  emoji: '💰' },
  { value: 'no_growth',            label: 'Клуб не растёт',                   emoji: '📉' },
]

// ── Sample data ───────────────────────────────────────────────────────

const SAMPLE_INPUT = {
  club_name:           'Demo Athletic',
  primary_sport:       'Футбол',
  total_athletes:      120,
  active_athletes:     95,
  coaches_count:       6,
  departed_90d:        18,
  avg_sessions_target: 3,
  avg_sessions_actual: 2.2,
  training_tracking:   'whatsapp' as TrackingMethod,
  billing_tracking:    'excel' as TrackingMethod,
  medical_tracking:    'paper' as TrackingMethod,
  pain_points:         ['retention', 'data_visibility', 'medical_tracking'] as PainPoint[],
  monthly_revenue_rub: 850_000,
}

// ── Main component ───────────────────────────────────────────────────

export default function ClubAuditForm() {
  // Club info
  const [clubName, setClubName]         = useState('')
  const [primarySport, setPrimarySport] = useState('Футбол')
  const [revenue, setRevenue]           = useState<number | ''>('')

  // Structure
  const [totalAthletes, setTotalAthletes]   = useState<number | ''>('')
  const [activeAthletes, setActiveAthletes] = useState<number | ''>('')
  const [coachesCount, setCoachesCount]     = useState<number | ''>('')

  // Operations
  const [departed90d, setDeparted90d]       = useState<number | ''>('')
  const [sessionsTarget, setSessionsTarget] = useState<number | ''>('')
  const [sessionsActual, setSessionsActual] = useState<number | ''>('')

  // Tracking
  const [trainingTracking, setTrainingTracking] = useState<TrackingMethod>('excel')
  const [billingTracking,  setBillingTracking]  = useState<TrackingMethod>('excel')
  const [medicalTracking,  setMedicalTracking]  = useState<TrackingMethod>('paper')

  // Pain points
  const [painPoints, setPainPoints] = useState<PainPoint[]>([])

  // Phase + result
  const [phase, setPhase]                 = useState<'idle' | 'analyzing' | 'result' | 'submitted'>('idle')
  const [report, setReport]               = useState<AuditReport | null>(null)
  const [analyzeError, setAnalyzeError]   = useState<string | null>(null)

  // Email gate
  const [email, setEmail]       = useState('')
  const [consent, setConsent]   = useState(false)
  const [sending, setSending]   = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // ── Validation ────────────────────────────────────────────────────
  const canSubmit =
    typeof totalAthletes === 'number' && totalAthletes > 0 &&
    typeof activeAthletes === 'number' && activeAthletes >= 0 && activeAthletes <= totalAthletes &&
    typeof coachesCount === 'number' && coachesCount > 0

  function togglePain(p: PainPoint) {
    setPainPoints(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function fillSample() {
    setClubName(SAMPLE_INPUT.club_name)
    setPrimarySport(SAMPLE_INPUT.primary_sport)
    setRevenue(SAMPLE_INPUT.monthly_revenue_rub)
    setTotalAthletes(SAMPLE_INPUT.total_athletes)
    setActiveAthletes(SAMPLE_INPUT.active_athletes)
    setCoachesCount(SAMPLE_INPUT.coaches_count)
    setDeparted90d(SAMPLE_INPUT.departed_90d)
    setSessionsTarget(SAMPLE_INPUT.avg_sessions_target)
    setSessionsActual(SAMPLE_INPUT.avg_sessions_actual)
    setTrainingTracking(SAMPLE_INPUT.training_tracking)
    setBillingTracking(SAMPLE_INPUT.billing_tracking)
    setMedicalTracking(SAMPLE_INPUT.medical_tracking)
    setPainPoints(SAMPLE_INPUT.pain_points)
  }

  function clearAll() {
    setClubName(''); setPrimarySport('Футбол'); setRevenue('')
    setTotalAthletes(''); setActiveAthletes(''); setCoachesCount('')
    setDeparted90d(''); setSessionsTarget(''); setSessionsActual('')
    setTrainingTracking('excel'); setBillingTracking('excel'); setMedicalTracking('paper')
    setPainPoints([])
    setPhase('idle'); setReport(null); setAnalyzeError(null)
  }

  // ── Submit analyze ────────────────────────────────────────────────
  async function handleAnalyze() {
    if (!canSubmit) { setAnalyzeError('Заполните обязательные поля (атлеты + тренеры).'); return }
    setPhase('analyzing')
    setAnalyzeError(null)
    setReport(null)
    try {
      const payload = {
        club_name:               clubName.trim() || undefined,
        primary_sport:           primarySport,
        total_athletes:          totalAthletes,
        active_athletes:         activeAthletes,
        coaches_count:           coachesCount,
        departed_90d:            typeof departed90d === 'number' ? departed90d : undefined,
        avg_sessions_target:     typeof sessionsTarget === 'number' ? sessionsTarget : undefined,
        avg_sessions_actual:     typeof sessionsActual === 'number' ? sessionsActual : undefined,
        training_tracking:       trainingTracking,
        billing_tracking:        billingTracking,
        medical_tracking:        medicalTracking,
        pain_points:             painPoints,
        monthly_revenue_rub:     typeof revenue === 'number' ? revenue : undefined,
      }
      const res = await fetch('/api/tools/club-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        if (data.error === 'RATE_LIMITED') {
          setAnalyzeError('Слишком много запросов. Попробуйте через час.')
        } else if (data.error === 'INVALID_INPUT') {
          setAnalyzeError('Проверьте корректность данных (active <= total, departed <= total).')
        } else {
          setAnalyzeError('Не удалось выполнить аудит. Попробуйте ещё раз.')
        }
        setPhase('idle')
        return
      }
      setReport(data.data as AuditReport)
      setPhase('result')
      setTimeout(() => {
        document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setAnalyzeError('Сеть недоступна. Попробуйте ещё раз.')
      setPhase('idle')
    }
  }

  // ── Email submit ──────────────────────────────────────────────────
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
          source: 'club-audit',
          consent: true,
          payload: {
            primary_sport:       primarySport,
            total_athletes:      totalAthletes,
            active_athletes:     activeAthletes,
            coaches_count:       coachesCount,
            health_score:        report?.health_score,
            health_label:        report?.health_label,
            risk_area_count:     report?.risk_areas.length,
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

  const showAllRisks = phase === 'submitted'
  const showFullReport = phase === 'submitted'

  useEffect(() => {
    if (phase === 'idle' || phase === 'analyzing') return
    setAnalyzeError(null)
  }, [phase])

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-4">
            🎯 Бесплатный аудит для директоров клубов
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
            Где теряете <span className="text-emerald-600">управляемость</span> в клубе
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl">
            Ответьте на 8-10 вопросов о структуре клуба и текущих процессах.
            AI выдаст health score, top-5 областей риска с цифрами и план действий на 30 дней.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1">Без регистрации</span>
            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1">~3 минуты</span>
            <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1">Claude Sonnet 4.5</span>
            <span className="rounded-full bg-orange-100 text-orange-700 px-3 py-1">Конкретные числа, не общие фразы</span>
          </div>
        </div>
      </section>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold">Ваш клуб</h2>
              <p className="text-xs text-slate-500 mt-0.5">Все поля приватны — не сохраняются без email confirmation</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={fillSample} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Пример (Demo Athletic, 120 атлетов)
              </button>
              <button onClick={clearAll} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Очистить
              </button>
            </div>
          </div>

          {/* Section 1: Club info */}
          <div className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">1. О клубе</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Название (опц.)</label>
                <input value={clubName} onChange={e => setClubName(e.target.value)} maxLength={120}
                  placeholder="Demo Athletic"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Основной спорт</label>
                <select value={primarySport} onChange={e => setPrimarySport(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400">
                  {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Месячный доход (опц., руб)</label>
                <input value={revenue} onChange={e => setRevenue(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} step={10000} placeholder="850000"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>

          {/* Section 2: Structure */}
          <div className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">2. Структура (обязательно)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Атлетов всего *</label>
                <input value={totalAthletes} onChange={e => setTotalAthletes(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={1} max={10000} required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Активных (платящих) *</label>
                <input value={activeAthletes} onChange={e => setActiveAthletes(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} max={10000} required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Тренеров *</label>
                <input value={coachesCount} onChange={e => setCoachesCount(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={1} max={500} required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>

          {/* Section 3: Operations */}
          <div className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">3. Операционные метрики (опц.)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Ушло за 90 дней</label>
                <input value={departed90d} onChange={e => setDeparted90d(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} max={10000} placeholder="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Целевых сессий/неделю</label>
                <input value={sessionsTarget} onChange={e => setSessionsTarget(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} max={20} step={0.5} placeholder="3"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Фактических сессий/неделю</label>
                <input value={sessionsActual} onChange={e => setSessionsActual(e.target.value === '' ? '' : Number(e.target.value))}
                  type="number" min={0} max={20} step={0.5} placeholder="2.5"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>

          {/* Section 4: Tracking methods */}
          <div className="mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">4. Текущие методы учёта</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Тренировки</label>
                <select value={trainingTracking} onChange={e => setTrainingTracking(e.target.value as TrackingMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400">
                  {TRACKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Биллинг</label>
                <select value={billingTracking} onChange={e => setBillingTracking(e.target.value as TrackingMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400">
                  {TRACKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600">Мед.допуски</label>
                <select value={medicalTracking} onChange={e => setMedicalTracking(e.target.value as TrackingMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400">
                  {TRACKING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Pain points */}
          <div className="mb-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">5. Болевые точки (выберите все, что применимо)</h3>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_POINTS.map(p => {
                const sel = painPoints.includes(p.value)
                return (
                  <button key={p.value} type="button" onClick={() => togglePain(p.value)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                      sel
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                    }`}>
                    {p.emoji} {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-200">
            <button onClick={handleAnalyze} disabled={!canSubmit || phase !== 'idle'}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
              {phase === 'analyzing' ? 'Анализируем клуб…' : 'Получить audit-отчёт →'}
            </button>
          </div>

          {analyzeError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {analyzeError}
            </div>
          )}
        </div>
      </section>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {report && (
        <section id="result-section" className="mx-auto max-w-5xl px-5 pb-10">
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-white p-5 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-4">📋 Audit-отчёт</h2>

            {/* Health score hero */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="md:col-span-1 flex flex-col items-center justify-center rounded-2xl border-2 p-5"
                style={{ background: HEALTH_META[report.health_label].bg, borderColor: HEALTH_META[report.health_label].border }}>
                <div className="pf-num text-5xl font-bold mb-1" style={{ color: HEALTH_META[report.health_label].color }}>
                  {report.health_score}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: HEALTH_META[report.health_label].color }}>
                  Health Score / 100
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{ background: 'white', color: HEALTH_META[report.health_label].color, border: `1px solid ${HEALTH_META[report.health_label].border}` }}>
                  {HEALTH_META[report.health_label].emoji} {HEALTH_META[report.health_label].label}
                </span>
              </div>
              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Резюме</div>
                <p className="text-sm text-slate-800 leading-relaxed">{report.summary}</p>
                {report.estimated_revenue_at_risk && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    💸 {report.estimated_revenue_at_risk}
                  </div>
                )}
              </div>
            </div>

            {/* Risk areas */}
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Области риска</h3>
            <div className="space-y-3 mb-5">
              {report.risk_areas.map((r, i) => {
                const meta = SEVERITY_META[r.severity]
                const blurred = !showAllRisks && i >= 1
                return (
                  <div key={i} className="rounded-xl border-2 p-4 transition-all relative overflow-hidden"
                    style={{ background: meta.bg, borderColor: meta.border }}>
                    <div className={blurred ? 'blur-[5px] select-none pointer-events-none' : ''}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h4 className="text-base font-bold text-slate-900">{r.name}</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{ background: 'white', color: meta.color, border: `1px solid ${meta.border}` }}>
                          {meta.emoji} {r.severity}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-700 mb-2"><strong className="text-slate-900">Сейчас:</strong> {r.current_state}</p>
                      <p className="text-[13px] text-slate-700"><strong className="text-slate-900">Действие:</strong> {r.recommended_action}</p>
                      {r.proform_helps_with && (
                        <p className="mt-2 text-[12px] text-emerald-700 italic">💡 {r.proform_helps_with}</p>
                      )}
                    </div>
                    {blurred && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                          🔒 email откроет полный отчёт
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Top 3 priorities + next steps (gated) */}
            {showFullReport && (
              <>
                {report.top_3_priorities.length > 0 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 mb-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-2">
                      🎯 Top-3 приоритеты на 30 дней
                    </div>
                    <ol className="space-y-1.5 text-sm text-slate-800">
                      {report.top_3_priorities.map((p, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-bold text-blue-700">{i + 1}.</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Next steps на 7-14 дней</div>
                  <p className="text-sm text-slate-800 leading-relaxed">{report.next_steps}</p>
                </div>
              </>
            )}

            {/* Email gate */}
            {phase === 'result' && (
              <form onSubmit={handleEmailSubmit} className="mt-5 p-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40">
                <p className="text-sm font-bold text-slate-800 mb-2.5">
                  🔒 Открыть полный audit-отчёт ({report.risk_areas.length} risk areas + Top-3 приоритеты + Next Steps)
                </p>
                <input type="email" required placeholder="director@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 accent-emerald-500" />
                  <span>Согласен получать ежемесячный benchmark спортивных клубов и кейсы по управлению. Отписка в 1 клик.</span>
                </label>
                {emailError && <p className="mt-1.5 text-[11px] text-red-600">{emailError}</p>}
                <button type="submit" disabled={sending || !email}
                  className="mt-3 w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Открыть полный отчёт →'}
                </button>
              </form>
            )}

            {phase === 'submitted' && (
              <div className="mt-5 p-4 rounded-xl border border-green-200 bg-green-50">
                <p className="text-sm font-bold text-green-800">
                  ✅ Полный отчёт открыт выше.
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Хотите видеть эти метрики автоматически в реальном времени?
                  ProForm Org Dashboard показывает at-risk атлетов, coach load, retention trends — всё одной таблицей.
                </p>
                <Link href="/auth/register?utm_source=tools&utm_medium=club-audit"
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
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Как считается health score</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <div>
              <div className="font-bold mb-1">📊 Churn rate</div>
              Если &gt;15% за 90 дней → -18 points. &gt;30% → -30. Retention — главный driver.
            </div>
            <div>
              <div className="font-bold mb-1">⚖️ Coach load</div>
              Sweet-spot 12-15 атлетов на тренера. Перегруз (&gt;25) и недозагрузка (&lt;5) одинаково плохи.
            </div>
            <div>
              <div className="font-bold mb-1">🛠️ Tracking methods</div>
              Paper / WhatsApp / none = высокий риск потери данных. Single источник истины снимает 70% хаоса.
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-10">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold">Все эти метрики автоматически в Org Dashboard</h3>
          <p className="mt-1 text-sm md:text-base opacity-90">
            ProForm для клубов: KPI tiles, roster matrix с overload highlighting, recommendations stream от спортивных врачей,
            автоматизированный биллинг, единая база медданных. Подключение — 30 минут с CSV-импорта.
          </p>
          <Link href="/auth/register?utm_source=tools&utm_medium=club-audit&utm_campaign=cta"
            className="mt-4 inline-block rounded-xl bg-white text-emerald-700 px-5 py-2.5 text-sm font-bold hover:bg-emerald-50">
            Начать бесплатно →
          </Link>
        </div>
      </section>

      {/* ── Cross-link ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-5 pb-10 text-center text-sm text-slate-500">
        Ещё для команды:{' '}
        <Link href="/tools/team-risk" className="text-emerald-700 hover:underline font-semibold">
          Team Risk Snapshot (тренеры)
        </Link>
        {' · '}
        <Link href="/tools/adaptive-plan" className="text-emerald-700 hover:underline font-semibold">
          Adaptive Plan (атлеты)
        </Link>
      </div>
    </div>
  )
}
