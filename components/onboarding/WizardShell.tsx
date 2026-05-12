'use client'
/**
 * WizardShell — Sprint W6 Day 30 (PR #48).
 *
 * Shared chrome for all role wizards. Renders:
 *   - hero header with role-tinted accent + step counter
 *   - progress bar
 *   - title + description for the current step
 *   - body slot (children)
 *   - footer with Prev / Next / Finish buttons
 *
 * Pure presentational — no data fetching. Each wizard owns its own
 * state machine (currentStepIndex, validations, on-finish action) and
 * passes navigation handlers in.
 */
import type { ReactNode } from 'react'

export interface WizardStep {
  key:         string
  title:       string
  description?: string
  /** When false, the Next/Finish button is disabled. */
  canAdvance?: boolean
}

export interface WizardShellProps {
  roleLabel:        string        // "Атлет", "Тренер" — for hero pill
  accentColor:      string        // hex — affects progress bar + button
  steps:            WizardStep[]
  currentIndex:     number
  busy?:            boolean
  error?:           string | null
  onPrev:           () => void
  onNext:           () => void
  onFinish:         () => void
  /** Optional custom CTA copy for the last step. */
  finishLabel?:     string
  children:         ReactNode
}

export default function WizardShell({
  roleLabel, accentColor, steps, currentIndex,
  busy, error, onPrev, onNext, onFinish, finishLabel, children,
}: WizardShellProps) {
  const totalSteps  = steps.length
  const step        = steps[currentIndex]
  const isLast      = currentIndex === totalSteps - 1
  const canAdvance  = step.canAdvance !== false
  const progressPct = Math.round(((currentIndex + 1) / totalSteps) * 100)

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.10),_transparent_28%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_55%,#FFFDF9_100%)] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-2xl">
        {/* Hero */}
        <div className="rounded-3xl border border-orange-100/80 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] p-6 md:p-8 mb-4">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em]"
              style={{ background: `${accentColor}1A`, color: accentColor, border: `1px solid ${accentColor}33` }}>
              <i className="ki-filled ki-rocket text-[10px]" />
              Старт · {roleLabel}
            </span>
            <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              Шаг {currentIndex + 1} из {totalSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-6">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${progressPct}%`, background: accentColor }} />
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
            {step.title}
          </h1>
          {step.description && (
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              {step.description}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-8">
          {children}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-4 flex items-center gap-2">
          <button onClick={onPrev} disabled={busy || currentIndex === 0}
            className="rounded-2xl border border-border bg-card hover:bg-muted text-foreground px-5 py-2.5 text-sm font-semibold disabled:opacity-40">
            ← Назад
          </button>
          <div className="flex-1" />
          {isLast ? (
            <button onClick={onFinish} disabled={busy || !canAdvance}
              className="rounded-2xl text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50 shadow-md"
              style={{ background: accentColor }}>
              {busy ? 'Завершаем…' : (finishLabel ?? 'Готово')}
            </button>
          ) : (
            <button onClick={onNext} disabled={busy || !canAdvance}
              className="rounded-2xl text-white px-6 py-2.5 text-sm font-bold disabled:opacity-50 shadow-md"
              style={{ background: accentColor }}>
              Дальше →
            </button>
          )}
        </div>

        {/* Step pills (small footer) */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s.key}
              className="rounded-full"
              style={{
                width: i === currentIndex ? 18 : 6,
                height: 6,
                background: i <= currentIndex ? accentColor : 'var(--border)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
