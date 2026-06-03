/**
 * <Calculator /> — W15 Day 77.
 *
 * Client-side widget для admin landing-ab page. Input: visitors +
 * conversions per variant (manual entry from Vercel Analytics dashboard).
 * Output: per-variant CTR, Z-statistic, p-value, verdict chip.
 *
 * Pattern matches W13 Day 66 admin/ab-tests verdict logic — но teaches
 * a manual workflow вместо auto-fetched DB query (Vercel Analytics не
 * exposes events API на free tier).
 *
 * State: ephemeral (no persistence). Admin paste'ит data → reads result.
 * Future: автоматизация через Vercel API когда Pro plan активен.
 */
'use client'

import { useMemo, useState } from 'react'
import { pooledZTest } from '@/lib/stats/ztest'
import { Card } from '@/components/ui/metronic'

interface VariantInputs {
  visitors:    number
  conversions: number
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

function VariantInput({
  label,
  color,
  value,
  onChange,
}: {
  label:    string
  color:    string
  value:    VariantInputs
  onChange: (next: VariantInputs) => void
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: `${color}33` }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: color }}
        >
          {label}
        </span>
        <span className="text-sm font-semibold text-foreground">Вариант {label}</span>
      </div>

      <label className="mb-2 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Visitors (показов)
      </label>
      <input
        type="number"
        min="0"
        value={value.visitors === 0 ? '' : value.visitors}
        onChange={(e) =>
          onChange({ ...value, visitors: Math.max(0, Number(e.target.value || 0)) })
        }
        placeholder="напр. 1200"
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
      />

      <label className="mt-3 mb-2 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        Conversions (например, hero_cta_primary_click)
      </label>
      <input
        type="number"
        min="0"
        value={value.conversions === 0 ? '' : value.conversions}
        onChange={(e) =>
          onChange({ ...value, conversions: Math.max(0, Number(e.target.value || 0)) })
        }
        placeholder="напр. 84"
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20"
      />

      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-center">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          CTR
        </div>
        <div className="pf-num text-2xl font-bold" style={{ color }}>
          {value.visitors > 0 ? fmtPct(value.conversions / value.visitors) : '—'}
        </div>
      </div>
    </div>
  )
}

export default function Calculator() {
  const [a, setA] = useState<VariantInputs>({ visitors: 0, conversions: 0 })
  const [b, setB] = useState<VariantInputs>({ visitors: 0, conversions: 0 })

  const result = useMemo(() => {
    return pooledZTest(a.conversions, a.visitors, b.conversions, b.visitors)
  }, [a, b])

  const verdict = useMemo(() => {
    if (a.visitors < 100 || b.visitors < 100) {
      return {
        chip:   'Жди трафик',
        color:  '#64748B',
        bg:     '#F1F5F9',
        text:   'Нужно как минимум 100 visitors на каждом варианте. Сейчас одна из групп ниже этого порога.',
      }
    }
    if (!result.isSignificant) {
      return {
        chip:   'Внутри шума',
        color:  '#C2410C',
        bg:     '#FFF7ED',
        text:   `p-value = ${result.pValue.toFixed(3)} ≥ 0.05. Разница может быть случайной — продолжай собирать данные.`,
      }
    }
    const winner = result.z > 0 ? 'B' : 'A'
    return {
      chip:   `Выигрывает ${winner}`,
      color:  '#15803D',
      bg:     '#F0FDF4',
      text:   `p-value = ${result.pValue.toFixed(3)} < 0.05. Разница статистически значима.`,
    }
  }, [a, b, result])

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold text-foreground">Z-test калькулятор</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Введите visitors и conversions для каждого варианта из{' '}
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="text-orange-600 hover:underline"
        >
          Vercel Analytics → Custom Events
        </a>
        . Калькулятор сразу покажет CTR и Z-test verdict (95% confidence).
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <VariantInput label="A" color="#2563EB" value={a} onChange={setA} />
        <VariantInput label="B" color="#EA580C" value={b} onChange={setB} />
      </div>

      {/* Verdict */}
      <div
        className="mt-5 flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center"
        style={{ background: verdict.bg }}
      >
        <span
          className="inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wider text-white"
          style={{ background: verdict.color }}
        >
          {verdict.chip}
        </span>
        <p className="text-sm" style={{ color: verdict.color }}>
          {verdict.text}
        </p>
      </div>

      {/* Numeric breakdown */}
      {(a.visitors > 0 || b.visitors > 0) && (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Z-statistic
            </div>
            <div className="pf-num mt-1 text-base font-bold text-foreground">
              {Number.isFinite(result.z) ? result.z.toFixed(2) : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              p-value
            </div>
            <div className="pf-num mt-1 text-base font-bold text-foreground">
              {Number.isFinite(result.pValue) ? result.pValue.toFixed(3) : '—'}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Confidence
            </div>
            <div className="pf-num mt-1 text-base font-bold text-foreground">95%</div>
          </div>
        </div>
      )}
    </Card>
  )
}
