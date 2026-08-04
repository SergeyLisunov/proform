'use client'
/**
 * Team Risk Snapshot — Sprint W4 Day 18 (PR #34).
 *
 * Public lead-magnet UI. State machine:
 *   idle      → user заполняет sport + athletes
 *   analyzing → POST /api/tools/team-risk → loading
 *   result    → показ snapshot, email gate (показываем только первые 2
 *               athletes полностью, остальные blur'ятся)
 *   submitted → email captured через /api/tools/lead → full reveal +
 *               CTA «Открыть в Sporteo»
 *
 * Mirror стиля /tools/acwr (orange accent, 2-column hero, science section,
 * CTA, cross-link).
 *
 * CSV-импорт: inline parser (формат отличается от bulk-invite — нужны
 * колонки name/age/hours/recovery/mood/coach_note), не reuse'ится lib/csv/parse.
 * Зато поддерживает тот же auto-separator detection (запятая/точка с запятой/таб).
 */
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

// ── Types (mirror server-side TeamRiskInput) ─────────────────────────

type Mood = 'great' | 'ok' | 'tired' | 'exhausted'

interface AthleteRow {
  id:                          string  // local UI id, not DB
  name:                        string
  age:                         string
  training_hours_current_week: string
  training_hours_avg_4w:       string
  recovery_score:              string
  mood:                        '' | Mood
  coach_note:                  string
}

interface Snapshot {
  overall: string
  athletes: Array<{
    name:   string
    status: 'ok' | 'watch' | 'risk'
    reason: string
    action: string
  }>
  priorities: string[]
}

const STATUS_META: Record<'ok' | 'watch' | 'risk', { label: string; color: string; bg: string; border: string }> = {
  ok:    { label: 'Зелёная зона', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  watch: { label: 'Наблюдение',   color: '#CA8A04', bg: '#FEFCE8', border: '#FDE68A' },
  risk:  { label: 'Риск',         color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

const MOOD_LABELS: Record<Mood, string> = {
  great:     'Отлично',
  ok:        'Норма',
  tired:     'Уставший',
  exhausted: 'Истощён',
}

const SPORT_OPTIONS = [
  'Футбол', 'Баскетбол', 'Бег', 'Силовые', 'Выносливость',
  'Хоккей', 'Волейбол', 'Лёгкая атлетика', 'Триатлон', 'Другое',
]

const SAMPLE_ATHLETES: AthleteRow[] = [
  { id: '1', name: 'Иван Петров',     age: '22', training_hours_current_week: '14', training_hours_avg_4w: '10', recovery_score: '38', mood: 'tired',     coach_note: 'жалуется на колено' },
  { id: '2', name: 'Мария Иванова',   age: '19', training_hours_current_week: '11', training_hours_avg_4w: '11', recovery_score: '78', mood: 'ok',        coach_note: '' },
  { id: '3', name: 'Сергей Новиков',  age: '24', training_hours_current_week: '8',  training_hours_avg_4w: '12', recovery_score: '85', mood: 'great',     coach_note: 'возвращается после травмы' },
  { id: '4', name: 'Анна Кузнецова',  age: '20', training_hours_current_week: '16', training_hours_avg_4w: '11', recovery_score: '32', mood: 'exhausted', coach_note: '' },
  { id: '5', name: 'Дмитрий Волков',  age: '21', training_hours_current_week: '12', training_hours_avg_4w: '11', recovery_score: '70', mood: 'ok',        coach_note: '' },
]

// ── CSV parsing (inline, not reuse'd from lib/csv/parse — другие колонки) ─

interface CsvParseError {
  line: number
  reason: string
}

function parseTeamCsv(input: string): { rows: AthleteRow[]; errors: CsvParseError[] } {
  const cleaned = input.replace(/^﻿/, '')
  const lines = cleaned.split(/\r?\n/).map(l => l).filter(l => l.trim().length > 0)
  if (lines.length === 0) return { rows: [], errors: [] }

  // Auto-detect separator from first line
  const first = lines[0]
  const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ','

  const splitLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (inQ) {
        if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++ } else inQ = false }
        else cur += c
      } else {
        if (c === '"') inQ = true
        else if (c === sep) { out.push(cur); cur = '' }
        else cur += c
      }
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  // Header detection
  const firstCells = splitLine(lines[0]).map(s => s.toLowerCase())
  const hasHeader = firstCells.includes('name') || firstCells.includes('имя')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const rows: AthleteRow[] = []
  const errors: CsvParseError[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const lineNum = (hasHeader ? i + 2 : i + 1)
    const cols = splitLine(dataLines[i])
    if (cols.length === 0 || !cols[0]) continue
    const name = cols[0]
    if (!name) {
      errors.push({ line: lineNum, reason: 'нет имени' })
      continue
    }
    rows.push({
      id:                          String(i + 1),
      name,
      age:                         cols[1] ?? '',
      training_hours_current_week: cols[2] ?? '',
      training_hours_avg_4w:       cols[3] ?? '',
      recovery_score:              cols[4] ?? '',
      mood:                        normalizeMood(cols[5]),
      coach_note:                  cols[6] ?? '',
    })
  }

  return { rows, errors }
}

function normalizeMood(raw: string | undefined): '' | Mood {
  if (!raw) return ''
  const v = raw.trim().toLowerCase()
  if (v === 'great' || v === 'отлично')    return 'great'
  if (v === 'ok' || v === 'норма')          return 'ok'
  if (v === 'tired' || v === 'уставший')    return 'tired'
  if (v === 'exhausted' || v === 'истощён') return 'exhausted'
  return ''
}

// ── Main component ───────────────────────────────────────────────────────

export default function TeamRiskCalculator() {
  const [sport, setSport]       = useState('Футбол')
  const [teamName, setTeamName] = useState('')
  const [rows, setRows]         = useState<AthleteRow[]>([emptyRow('1'), emptyRow('2'), emptyRow('3')])

  const [phase, setPhase]   = useState<'idle' | 'analyzing' | 'result' | 'submitted'>('idle')
  const [snapshot, setSnap] = useState<Snapshot | null>(null)
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
      if (!r.name.trim()) return false
      const cur = parseFloat(r.training_hours_current_week)
      const avg = parseFloat(r.training_hours_avg_4w)
      return Number.isFinite(cur) && cur >= 0 && cur <= 60
          && Number.isFinite(avg) && avg >= 0 && avg <= 60
    })
  }, [rows])

  const canSubmit = validRows.length >= 1

  // ── Mutations ──────────────────────────────────────────────────────
  function emptyRow(id: string): AthleteRow {
    return { id, name: '', age: '', training_hours_current_week: '', training_hours_avg_4w: '', recovery_score: '', mood: '', coach_note: '' }
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow(String(prev.length + 1))])
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev)
  }

  function updateRow(id: string, patch: Partial<AthleteRow>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function fillSample() {
    setRows(SAMPLE_ATHLETES.map((r, i) => ({ ...r, id: String(i + 1) })))
    setSport('Футбол')
    setTeamName('Demo команда')
  }

  function clearAll() {
    setRows([emptyRow('1'), emptyRow('2'), emptyRow('3')])
    setSport('Футбол')
    setTeamName('')
    setPhase('idle')
    setSnap(null)
    setAnalyzeError(null)
  }

  function handleCsvUpload(file: File | null | undefined) {
    if (!file) return
    if (file.size > 64 * 1024) { setAnalyzeError('Файл слишком большой (макс 64 KB)'); return }
    file.text().then(text => {
      const { rows: parsedRows, errors } = parseTeamCsv(text)
      if (parsedRows.length === 0) {
        setAnalyzeError('CSV не содержит атлетов. Формат: name,age,hours_current,hours_avg_4w,recovery,mood,note')
        return
      }
      if (parsedRows.length > 20) {
        setAnalyzeError('Максимум 20 атлетов за раз. В CSV найдено ' + parsedRows.length)
        return
      }
      setRows(parsedRows)
      if (errors.length > 0) {
        setAnalyzeError(`Импортировано ${parsedRows.length}; пропущено ${errors.length} (ошибки в строках: ${errors.map(e => e.line).join(', ')})`)
      } else {
        setAnalyzeError(null)
      }
    }).catch(() => setAnalyzeError('Не удалось прочитать файл'))
  }

  // ── Submit analyze ─────────────────────────────────────────────────
  async function handleAnalyze() {
    if (validRows.length === 0) { setAnalyzeError('Заполните минимум одного атлета'); return }
    setPhase('analyzing')
    setAnalyzeError(null)
    setSnap(null)
    try {
      const payload = {
        sport,
        team_name: teamName.trim() || undefined,
        athletes: validRows.map(r => ({
          name:                         r.name.trim(),
          age:                          r.age ? parseInt(r.age, 10) : undefined,
          training_hours_current_week:  parseFloat(r.training_hours_current_week),
          training_hours_avg_4w:        parseFloat(r.training_hours_avg_4w),
          recovery_score:               r.recovery_score ? parseInt(r.recovery_score, 10) : undefined,
          mood:                         r.mood || undefined,
          coach_note:                   r.coach_note.trim() || undefined,
        })),
      }
      const res = await fetch('/api/tools/team-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        if (data.error === 'RATE_LIMITED') {
          setAnalyzeError('Слишком много запросов. Попробуйте через час.')
        } else if (data.error === 'INVALID_INPUT') {
          setAnalyzeError('Проверьте корректность введённых данных.')
        } else {
          setAnalyzeError('Не удалось проанализировать команду. Попробуйте ещё раз.')
        }
        setPhase('idle')
        return
      }
      setSnap(data.data as Snapshot)
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
          source: 'team-risk',
          consent: true,
          payload: {
            sport,
            team_name: teamName || null,
            athletes_count: validRows.length,
            risk_count:  snapshot?.athletes.filter(a => a.status === 'risk').length ?? 0,
            watch_count: snapshot?.athletes.filter(a => a.status === 'watch').length ?? 0,
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

  // ── Counts (for UI summary) ────────────────────────────────────────
  const counts = useMemo(() => {
    if (!snapshot) return { ok: 0, watch: 0, risk: 0 }
    return {
      ok:    snapshot.athletes.filter(a => a.status === 'ok').length,
      watch: snapshot.athletes.filter(a => a.status === 'watch').length,
      risk:  snapshot.athletes.filter(a => a.status === 'risk').length,
    }
  }, [snapshot])

  // ── Reveal logic: первые 2 athlete cards + 1 priority всегда видны.
  // Остальные blur'ятся до email submit.
  const showAllAthletes  = phase === 'submitted'
  const showAllPriorities = phase === 'submitted'

  // Auto-clear analyzeError when phase changes
  useEffect(() => {
    if (phase === 'idle' || phase === 'analyzing') return
    setAnalyzeError(null)
  }, [phase])

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-orange-50 via-white to-rose-50 border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-600 mb-4">
            <i className="ki-filled ki-focus text-orange-600" /> Бесплатный AI-инструмент
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
            Team Risk Snapshot — <span className="text-orange-600">атлеты в зоне риска</span> за 60 секунд
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl">
            Введите weekly training hours + recovery + mood по 3-12 атлетам.
            AI выдаст светофор по каждому, причины и конкретные действия на ближайшие 7-14 дней.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className="rounded-full bg-orange-100 text-orange-700 px-3 py-1">Без регистрации</span>
            <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1">CSV-импорт</span>
            <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1">Gemma 4</span>
            <span className="rounded-full bg-green-100 text-green-700 px-3 py-1">152-ФЗ совместимо</span>
          </div>
        </div>
      </section>

      {/* ── Form ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold">Данные команды</h2>
              <p className="text-xs text-slate-500 mt-0.5">Минимум 1 атлет, рекомендуем 5-12 для лучшего snapshot</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={fillSample} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Пример
              </button>
              <button onClick={() => fileRef.current?.click()} type="button"
                className="rounded-md border border-blue-200 bg-blue-50 text-blue-700 px-2.5 py-1 text-[11px] font-semibold hover:bg-blue-100">
                Загрузить CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden
                onChange={e => handleCsvUpload(e.target.files?.[0])} />
              <button onClick={clearAll} type="button"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold hover:bg-slate-50">
                Очистить
              </button>
            </div>
          </div>

          {/* Sport + team meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Вид спорта</label>
              <select value={sport} onChange={e => setSport(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400">
                {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Команда (опц.)</label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={80}
                placeholder="Например: U-18 Атлет"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400" />
            </div>
          </div>

          {/* Athlete rows */}
          <div className="space-y-2.5 mb-3">
            {rows.map((r, idx) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Атлет #{idx + 1}</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(r.id)} type="button"
                      className="text-[11px] font-semibold text-red-600 hover:underline">
                      Удалить
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <input value={r.name} onChange={e => updateRow(r.id, { name: e.target.value })} maxLength={80}
                    placeholder="Имя" className="col-span-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400" />
                  <input value={r.age} onChange={e => updateRow(r.id, { age: e.target.value })}
                    type="number" min={8} max={80} placeholder="Возраст"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400" />
                  <input value={r.training_hours_current_week} onChange={e => updateRow(r.id, { training_hours_current_week: e.target.value })}
                    type="number" min={0} max={60} step={0.5} placeholder="Часы (нед)"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400" />
                  <input value={r.training_hours_avg_4w} onChange={e => updateRow(r.id, { training_hours_avg_4w: e.target.value })}
                    type="number" min={0} max={60} step={0.5} placeholder="Avg 4 нед"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400" />
                  <input value={r.recovery_score} onChange={e => updateRow(r.id, { recovery_score: e.target.value })}
                    type="number" min={0} max={100} placeholder="Recovery 0-100"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <select value={r.mood} onChange={e => updateRow(r.id, { mood: e.target.value as '' | Mood })}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400">
                    <option value="">Настроение (опц.)</option>
                    <option value="great">Отлично</option>
                    <option value="ok">Норма</option>
                    <option value="tired">Уставший</option>
                    <option value="exhausted">Истощён</option>
                  </select>
                  <input value={r.coach_note} onChange={e => updateRow(r.id, { coach_note: e.target.value })} maxLength={280}
                    placeholder="Заметка тренера (опц.)"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-orange-400" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={addRow} type="button" disabled={rows.length >= 12}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              + Атлет ({rows.length}/12)
            </button>
            <button onClick={handleAnalyze} disabled={!canSubmit || phase !== 'idle'}
              className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
              {phase !== 'idle' && phase !== 'result' && phase !== 'submitted' ? 'Анализируем…' : `Получить snapshot (${validRows.length})`}
            </button>
          </div>

          {analyzeError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {analyzeError}
            </div>
          )}

          <p className="mt-2 text-[10px] text-slate-400">
            CSV-формат: <code>name,age,hours_current,hours_avg_4w,recovery,mood,note</code> · разделитель определяется автоматически
          </p>
        </div>
      </section>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {snapshot && (
        <section id="result-section" className="mx-auto max-w-5xl px-5 pb-10">
          <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50/50 to-white p-5 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold mb-3 inline-flex items-center gap-2"><i className="ki-filled ki-chart-simple" /> Snapshot команды</h2>

            <p className="text-base text-slate-700 mb-4">{snapshot.overall}</p>

            {/* Counts */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <CountTile label="В норме"      count={counts.ok}    status="ok" />
              <CountTile label="Наблюдение"   count={counts.watch} status="watch" />
              <CountTile label="Риск"         count={counts.risk}  status="risk" />
            </div>

            {/* Athlete cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
              {snapshot.athletes.map((a, i) => {
                const meta = STATUS_META[a.status]
                const blurred = !showAllAthletes && i >= 2
                return (
                  <div key={i} className="rounded-xl border p-3.5 transition-all relative overflow-hidden"
                    style={{ background: meta.bg, borderColor: meta.border }}>
                    <div className={blurred ? 'blur-[5px] select-none pointer-events-none' : ''}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-slate-900 text-sm truncate">{a.name}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                          style={{ background: 'white', color: meta.color, border: `1px solid ${meta.border}` }}>
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} /> {meta.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-700 mb-1.5">
                        <strong className="text-slate-900">Причина:</strong> {a.reason}
                      </p>
                      <p className="text-[12px] text-slate-700">
                        <strong className="text-slate-900">Действие:</strong> {a.action}
                      </p>
                    </div>
                    {blurred && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
                          <i className="ki-filled ki-lock-2" /> email откроет
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Priorities */}
            {snapshot.priorities.length > 0 && (
              <div className="mt-5 mb-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-800 mb-2">
                  <i className="ki-filled ki-focus text-blue-800" /> Главные приоритеты на 7-14 дней
                </h3>
                <ol className="space-y-1.5 text-sm text-slate-800">
                  {snapshot.priorities.map((p, i) => {
                    const blurred = !showAllPriorities && i >= 1
                    return (
                      <li key={i} className="flex gap-2">
                        <span className="font-bold text-blue-700">{i + 1}.</span>
                        <span className={blurred ? 'blur-[4px] select-none' : ''}>{p}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}

            {/* Email gate */}
            {phase === 'result' && (
              <form onSubmit={handleEmailSubmit} className="mt-5 p-4 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/40">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2.5">
                  <i className="ki-filled ki-lock-2" /> Открыть полный snapshot ({snapshot.athletes.length} атлетов + все приоритеты)
                </p>
                <input type="email" required placeholder="coach@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 accent-orange-500" />
                  <span>Согласен получать еженедельный email с разбором нагрузки команды и советами тренеру. Отписка в 1 клик.</span>
                </label>
                {emailError && <p className="mt-1.5 text-[11px] text-red-600">{emailError}</p>}
                <button type="submit" disabled={sending || !email}
                  className="mt-3 w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Открыть полный отчёт →'}
                </button>
              </form>
            )}

            {phase === 'submitted' && (
              <div className="mt-5 p-4 rounded-xl border border-green-200 bg-green-50">
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-green-800">
                  <i className="ki-filled ki-check-circle text-green-800" /> Готово! Полный snapshot открыт выше.
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Хотите автоматический snapshot по всем тренировкам команды?
                  В Sporteo атлеты подключают Garmin / Whoop / ручной ввод —
                  риск-светофор обновляется в реальном времени.
                </p>
                <Link href="/auth/register?utm_source=tools&utm_medium=team-risk"
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
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Как работает Team Risk Snapshot</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <div>
              <div className="font-bold mb-1 inline-flex items-center gap-1.5"><i className="ki-filled ki-chart-simple" /> ACWR</div>
              Отношение нагрузки текущей недели к среднему за 4 недели.
              Связь с риском травмы — мета-анализы Gabbett & Bourdon.
            </div>
            <div>
              <div className="font-bold mb-1 inline-flex items-center gap-1.5"><i className="ki-filled ki-heart text-green-600" /> Recovery</div>
              Если recovery score &lt; 40 — атлет в зоне риска переутомления.
              По данным Whoop validation studies.
            </div>
            <div>
              <div className="font-bold mb-1 inline-flex items-center gap-1.5"><i className="ki-filled ki-message-programming" /> Gemma 4</div>
              AI читает данные, применяет правила (recovery / ACWR / mood)
              и формулирует action items на русском.
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pb-10">
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold">Хотите snapshot автоматически по всей команде?</h3>
          <p className="mt-1 text-sm md:text-base opacity-90">
            Sporteo подключает Garmin, Whoop и ручной ввод. Тренер видит ACWR + recovery + mood
            по каждому атлету одной таблицей. Risk-светофор обновляется в реальном времени.
          </p>
          <Link href="/auth/register?utm_source=tools&utm_medium=team-risk&utm_campaign=cta"
            className="mt-4 inline-block rounded-xl bg-white text-orange-600 px-5 py-2.5 text-sm font-bold hover:bg-orange-50">
            Начать бесплатно →
          </Link>
        </div>
      </section>

      {/* ── Cross-link ─────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-5 pb-10 text-center text-sm text-slate-500">
        Ещё для тренеров:{' '}
        <Link href="/tools/acwr" className="text-orange-600 hover:underline font-semibold">
          калькулятор ACWR
        </Link>
        {' · '}
        <Link href="/tools/overtraining" className="text-orange-600 hover:underline font-semibold">
          тест на перетренированность
        </Link>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function CountTile({ label, count, status }: { label: string; count: number; status: 'ok' | 'watch' | 'risk' }) {
  const meta = STATUS_META[status]
  return (
    <div className="rounded-xl border p-3 text-center"
      style={{ background: meta.bg, borderColor: meta.border }}>
      <div className="pf-num text-2xl font-bold" style={{ color: meta.color }}>{count}</div>
      <div className="inline-flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wider mt-0.5" style={{ color: meta.color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: meta.color }} /> {label}
      </div>
    </div>
  )
}

// suppress unused-import lint when MOOD_LABELS not directly referenced
void MOOD_LABELS
