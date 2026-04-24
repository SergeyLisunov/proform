'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  OT_QUESTIONS, OT_LEVEL_META, scoreOvertraining,
  type OvertrainingLevel,
} from '@/lib/overtraining/scoring'

export default function OvertrainingQuiz() {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [showResult, setShowResult] = useState(false)

  const [email, setEmail]     = useState('')
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [err, setErr]         = useState<string | null>(null)

  const q = OT_QUESTIONS[idx]
  const totalQ = OT_QUESTIONS.length
  const progress = Math.round(((idx + (answers[q?.id] !== undefined ? 1 : 0)) / totalQ) * 100)

  const result = showResult ? scoreOvertraining(answers) : null
  const levelMeta = result ? OT_LEVEL_META[result.level] : null

  const pickAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [q.id]: value }))
  }
  const next = () => {
    if (idx < totalQ - 1) setIdx(idx + 1)
    else setShowResult(true)
  }
  const prev = () => { if (idx > 0) setIdx(idx - 1) }
  const restart = () => {
    setIdx(0); setAnswers({}); setShowResult(false)
    setSent(false); setEmail(''); setConsent(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!consent) { setErr('Подтвердите согласие на обработку email'); return }
    setSending(true)
    try {
      const res = await fetch('/api/tools/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email, source: 'overtraining', consent: true,
          payload: { answers, score: result?.score, level: result?.level },
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
      <section className="bg-gradient-to-br from-rose-50 via-white to-orange-50 border-b border-slate-200">
        <div className="mx-auto max-w-3xl px-5 py-10">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-600 mb-3">
            🩺 2 минуты — научный тест
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            Тест на перетренированность
          </h1>
          <p className="mt-2 text-slate-600">
            10 коротких вопросов, основанных на критериях Overtraining Syndrome.
            Узнайте, нужна ли вам разгрузочная неделя или пора очно показаться врачу.
          </p>
        </div>
      </section>

      {/* Quiz / Result */}
      <section className="mx-auto max-w-3xl px-5 py-10">
        {!showResult ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Progress */}
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Вопрос {idx + 1} из {totalQ}
                </div>
                <div className="text-[11px] font-semibold text-slate-500">{progress}%</div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Question */}
            <div className="px-5 py-6">
              <h2 className="text-xl font-bold mb-4">{q.question}</h2>
              <div className="space-y-2">
                {q.options.map((option, i) => {
                  const active = answers[q.id] === i
                  return (
                    <button key={i} onClick={() => pickAnswer(i)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
                        active
                          ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-100'
                          : 'border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/30'
                      }`}>
                      <span className="inline-block w-5 text-rose-500">{active ? '●' : '○'}</span>
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Nav */}
            <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between">
              <button onClick={prev} disabled={idx === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold disabled:opacity-40 hover:bg-slate-50">
                ← Назад
              </button>
              <button onClick={next} disabled={answers[q.id] === undefined}
                className="rounded-lg bg-rose-500 hover:bg-rose-600 text-white px-5 py-2 text-sm font-bold disabled:opacity-40">
                {idx === totalQ - 1 ? 'Показать результат' : 'Дальше →'}
              </button>
            </div>
          </div>
        ) : (
          /* Result */
          <div className="space-y-4">
            <div className="rounded-2xl border p-5 md:p-6"
              style={{ borderColor: levelMeta!.border, background: levelMeta!.bg }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: levelMeta!.color }}>
                    Ваш уровень риска
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold mt-1" style={{ color: levelMeta!.color }}>
                    {levelMeta!.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">{levelMeta!.tagline}.</p>
                </div>
                <div className="text-right">
                  <div className="pf-num text-5xl font-bold" style={{ color: levelMeta!.color }}>
                    {result!.score}
                    <span className="text-xl text-slate-500">/100</span>
                  </div>
                  <div className="mt-2 h-1.5 w-32 rounded-full bg-white border border-slate-200 overflow-hidden">
                    <div className="h-full" style={{ width: `${result!.score}%`, background: levelMeta!.color }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Breakdown — top 3 contributors */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
                Что больше всего тянет вниз
              </h3>
              <ul className="space-y-2">
                {[...result!.breakdown].sort((a, b) => b.contribution - a.contribution).slice(0, 3).map(b => (
                  <li key={b.id} className="text-sm text-slate-700">
                    <span className="font-semibold">·</span> {b.label}
                    <span className="text-xs text-slate-500 ml-1.5">(+{b.contribution.toFixed(1)} балла)</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommendations gated */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
                Рекомендации
              </h3>
              <ul className="space-y-2 text-sm text-slate-800">
                {result!.recommendations.slice(0, sent ? 10 : 2).map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span style={{ color: levelMeta!.color }}>→</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              {!sent && result!.recommendations.length > 2 && (
                <form onSubmit={handleSubmit} className="mt-4 p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <p className="text-xs font-bold text-slate-700 mb-2">
                    🔒 Открыть все {result!.recommendations.length} рекомендаций + PDF-чек-лист
                  </p>
                  <input type="email" required placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-rose-400" />
                  <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                      className="mt-0.5 accent-rose-500" />
                    <span>Согласен получать полезные материалы про восстановление и нагрузку. Отписка в 1 клик.</span>
                  </label>
                  {err && <p className="mt-1.5 text-[11px] text-red-600">{err}</p>}
                  <button type="submit" disabled={sending || !email}
                    className="mt-3 w-full rounded-lg bg-rose-500 hover:bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                    {sending ? 'Отправляем…' : 'Открыть рекомендации →'}
                  </button>
                </form>
              )}
            </div>

            {/* Next steps */}
            <div className="rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white p-6">
              <h3 className="text-xl font-bold">Хотите отслеживать состояние автоматически?</h3>
              <p className="mt-1 text-sm opacity-90">
                В ProForm ваш тренер и спортивный врач видят ваши ответы каждую неделю и
                замечают изменения до того, как они превратятся в травму.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/auth/register?utm_source=tools&utm_medium=overtraining&utm_campaign=cta"
                  className="rounded-xl bg-white text-rose-600 px-5 py-2.5 text-sm font-bold hover:bg-rose-50">
                  Начать бесплатно
                </Link>
                <button onClick={restart}
                  className="rounded-xl border border-white/40 bg-white/10 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
                  Пройти ещё раз
                </button>
              </div>
            </div>

            {/* Cross-link */}
            <div className="text-center text-sm text-slate-500">
              Можно ещё:{' '}
              <Link href="/tools/acwr" className="text-orange-600 hover:underline font-semibold">
                посчитать ACWR — риск травмы
              </Link>.
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
