'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { computeAcwr, ACWR_ZONE_META, type AcwrZone } from '@/lib/acwr/calc'

type Unit = 'minutes' | 'strain' | 'rpe_hours'

const UNIT_LABELS: Record<Unit, { label: string; hint: string; exampleValues: [number, number, number, number] }> = {
  minutes:   { label: 'Минуты активности', hint: 'Суммарные минуты тренировок в неделю', exampleValues: [300, 340, 360, 450] },
  strain:    { label: 'Whoop strain',       hint: 'Суммарный strain за неделю (если пользуетесь Whoop)', exampleValues: [55, 60, 65, 80] },
  rpe_hours: { label: 'sRPE (час × RPE)',   hint: 'Часы тренировок × средний RPE по шкале 1–10', exampleValues: [21, 24, 26, 35] },
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Полукруговой индикатор ACWR. */
function AcwrGauge({ acwr, zone }: { acwr: number | null; zone: AcwrZone }) {
  // Диапазон шкалы 0..2 (всё что выше — крайне красная).
  const meta = ACWR_ZONE_META[zone]
  const cx = 160, cy = 150, r = 130
  const startAngle = Math.PI               // 180°
  const endAngle   = 0                     // 0°
  const toXY = (angle: number) => ({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) })

  // Сегменты шкалы
  const segments: Array<{ from: number; to: number; color: string }> = [
    { from: 0,   to: 0.8, color: '#FDE68A' }, // жёлтый (detraining)
    { from: 0.8, to: 1.3, color: '#BBF7D0' }, // зелёный (optimal)
    { from: 1.3, to: 1.5, color: '#FBC1A0' }, // оранжевый (monitor)
    { from: 1.5, to: 2.0, color: '#FECACA' }, // красный (danger)
  ]
  const ratio = (v: number) => Math.max(0, Math.min(1, v / 2))
  const arcPath = (a1: number, a2: number) => {
    const s = toXY(a1), e = toXY(a2)
    const large = Math.abs(a1 - a2) > Math.PI ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`
  }
  const valueToAngle = (v: number) => startAngle - ratio(v) * Math.PI

  const needle = acwr != null ? valueToAngle(acwr) : null
  const needleEnd = needle != null ? toXY(needle) : null

  return (
    <div className="relative">
      <svg viewBox="0 0 320 200" className="w-full max-w-sm mx-auto">
        {/* Segments */}
        {segments.map((seg, i) => {
          const a1 = valueToAngle(seg.from)
          const a2 = valueToAngle(seg.to)
          return (
            <path key={i} d={arcPath(a1, a2)}
              stroke={seg.color} strokeWidth={28} fill="none" strokeLinecap="butt" />
          )
        })}
        {/* Ticks */}
        {[0, 0.5, 1, 1.5, 2].map(v => {
          const a = valueToAngle(v)
          const p1 = toXY(a)
          const rInner = r - 18
          const p2 = { x: cx + rInner * Math.cos(a), y: cy - rInner * Math.sin(a) }
          const rLabel = r + 12
          const pL = { x: cx + rLabel * Math.cos(a), y: cy - rLabel * Math.sin(a) }
          return (
            <g key={v}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94A3B8" strokeWidth={1} />
              <text x={pL.x} y={pL.y} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fill="#64748B">{v.toFixed(1)}</text>
            </g>
          )
        })}
        {/* Needle */}
        {needleEnd && (
          <>
            <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y}
              stroke={meta.color} strokeWidth={3} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill={meta.color} />
          </>
        )}
      </svg>
      <div className="text-center -mt-4">
        <div className="pf-num text-4xl font-bold" style={{ color: meta.color }}>
          {acwr != null ? acwr.toFixed(2) : '—'}
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: meta.color }}>
          {meta.label}
        </div>
      </div>
    </div>
  )
}

export default function AcwrCalculator() {
  const [unit, setUnit]  = useState<Unit>('minutes')
  const [w, setW] = useState<[number, number, number, number]>([0, 0, 0, 0])

  const result = useMemo(() => computeAcwr({ weeks: w }), [w])
  const meta   = ACWR_ZONE_META[result.zone]

  const [email, setEmail]     = useState('')
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  const handleFill = () => setW(UNIT_LABELS[unit].exampleValues)
  const handleClear = () => setW([0, 0, 0, 0])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!consent) { setErr('Нужно подтвердить согласие на обработку email'); return }
    setSending(true)
    try {
      const res = await fetch('/api/tools/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email, source: 'acwr', consent: true,
          payload: { unit, weeks: w, acwr: result.acwr, zone: result.zone },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setErr(json.error ?? `HTTP ${res.status}`); setSending(false); return }
      setSent(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setSending(false) }
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-50 via-white to-blue-50 border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-600 mb-4">
            🎯 Бесплатный инструмент
          </div>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">
            Калькулятор риска травмы <span className="text-orange-600">(ACWR)</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-2xl">
            Введите недельную нагрузку за последние 4 недели — получите ACWR и
            цветовую зону риска. Научный метод, которым пользуются тренеры NBA,
            АПЛ и олимпийской сборной.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Введите нагрузку</h2>
              <div className="flex gap-1.5">
                <button onClick={handleFill} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-slate-50">
                  Пример
                </button>
                <button onClick={handleClear} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-slate-50">
                  Очистить
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-600">Единица измерения</label>
              <div className="mt-1 grid grid-cols-3 gap-1.5">
                {(['minutes', 'rpe_hours', 'strain'] as Unit[]).map(u => (
                  <button key={u} type="button" onClick={() => setUnit(u)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      unit === u ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200'
                    }`}>
                    {UNIT_LABELS[u].label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{UNIT_LABELS[unit].hint}</p>
            </div>

            <div className="space-y-3">
              {(['3 недели назад', '2 недели назад', 'Прошлая неделя', 'Эта неделя'] as const).map((label, i) => (
                <div key={i}>
                  <label className="text-xs font-semibold text-slate-600">{label}</label>
                  <input type="number" min={0} step={1} inputMode="numeric"
                    value={w[i] || ''}
                    onChange={e => {
                      const next = [...w] as [number, number, number, number]
                      const parsed = Number(e.target.value)
                      next[i] = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
                      setW(next)
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="rounded-2xl border p-5 md:p-6"
            style={{ borderColor: meta.border, background: meta.bg }}>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: meta.color }}>
              Результат
            </h2>
            <AcwrGauge acwr={result.acwr} zone={result.zone} />
            <p className="mt-3 text-sm text-slate-800">
              <strong>{meta.label}.</strong> {meta.tagline}.
            </p>

            {result.acwr != null && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white border border-slate-200 p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Острая (7д)</div>
                  <div className="pf-num text-xl font-bold">{result.acute}</div>
                </div>
                <div className="rounded-lg bg-white border border-slate-200 p-3">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Хроническая (28д)</div>
                  <div className="pf-num text-xl font-bold">{result.chronic}</div>
                </div>
              </div>
            )}

            {result.advice.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Что делать
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-800">
                  {result.advice.slice(0, sent ? 10 : 2).map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span style={{ color: meta.color }}>•</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Email gate */}
            {!sent && result.acwr != null && result.advice.length > 2 && (
              <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-xl border border-dashed border-slate-300 bg-white/70">
                <p className="text-xs font-bold text-slate-700 mb-2">
                  🔒 Разблокировать все {result.advice.length} рекомендаций
                </p>
                <input type="email" required placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400" />
                <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                    className="mt-0.5 accent-orange-500" />
                  <span>Согласен получать еженедельный email с разбором нагрузки и советами. Отписка в 1 клик.</span>
                </label>
                {err && <p className="mt-1.5 text-[11px] text-red-600">{err}</p>}
                <button type="submit" disabled={sending || !email}
                  className="mt-3 w-full rounded-lg bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                  {sending ? 'Отправляем…' : 'Получить полный отчёт →'}
                </button>
              </form>
            )}

            {sent && (
              <div className="mt-4 p-4 rounded-xl border border-green-200 bg-green-50">
                <p className="text-sm font-semibold text-green-800">
                  ✅ Готово! Расширенный разбор и рекомендации открыты выше.
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Хотите отслеживать ACWR автоматически по всем своим тренировкам и видеть его в реальном времени?
                </p>
                <Link href="/auth/register?utm_source=tools&utm_medium=acwr"
                  className="mt-2 inline-block rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-xs font-semibold">
                  Начать бесплатно →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Science */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">Как это работает</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700">
            <div>
              <div className="font-bold mb-1">🧮 Формула</div>
              ACWR = острая нагрузка (7&nbsp;дней) / хроническая (28&nbsp;дней, скользящее среднее).
            </div>
            <div>
              <div className="font-bold mb-1">🎯 Sweet spot</div>
              0.8–1.3 — зелёная зона, минимальный риск травмы и стабильный прогресс.
            </div>
            <div>
              <div className="font-bold mb-1">🚨 Красная зона</div>
              ACWR &gt; 1.5 связан с резким ростом риска травмы в мета-анализах Gabbett и Bourdon.
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 md:p-8">
          <h3 className="text-xl md:text-2xl font-bold">Хотите, чтобы ACWR считался сам по каждой тренировке?</h3>
          <p className="mt-1 text-sm md:text-base opacity-90">
            В Sporteo подключается Garmin, Whoop и ручной ввод. Тренер видит ACWR по всем атлетам одной таблицей.
          </p>
          <Link href="/auth/register?utm_source=tools&utm_medium=acwr&utm_campaign=cta"
            className="mt-4 inline-block rounded-xl bg-white text-orange-600 px-5 py-2.5 text-sm font-bold hover:bg-orange-50">
            Начать бесплатно →
          </Link>
        </div>

        {/* Cross-link */}
        <div className="mt-6 text-center text-sm text-slate-500">
          Можно ещё:{' '}
          <Link href="/tools/overtraining" className="text-orange-600 hover:underline font-semibold">
            пройти тест на перетренированность
          </Link>.
        </div>
      </section>
    </div>
  )
}
