/**
 * <LeadCaptureForm /> — W16 Day 79 NEW.
 *
 * Client-side form для soft conversion path («Получить аудит клуба»).
 * 6 required fields + optional pain-points multiselect.
 *
 * Submit flow:
 *   1. Client validation (zod-aligned local checks)
 *   2. POST /api/leads/audit → server validation + DB insert + email
 *   3. On 2xx: success state с next-steps
 *   4. On 4xx: inline field errors
 *   5. On 5xx / network: retry hint, keep form data
 *
 * Tracking: emits `landing.lead_capture_submit` on attempt,
 * `landing.lead_capture_success` on confirmed save.
 *
 * Privacy note inline — explicit «not sold to third parties» reduces
 * form-anxiety friction.
 */
'use client'

import { type FormEvent, useState } from 'react'
import { ArrowRight, CheckCircle2, Mail, MessageCircle } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/track'

interface AuditFormData {
  name:         string
  email:        string
  telegram:     string
  organization: string
  orgType:      string
  coachCount:   string
  athleteCount: string
  painPoints:   string[]
  consent:      boolean
}

interface FieldError {
  [field: string]: string | undefined
}

interface LeadCaptureFormProps {
  /** Optional callback fired after successful submission (used by modal to auto-close). */
  onSuccess?: () => void
}

const ORG_TYPES = [
  { value: 'fitness',      label: 'Фитнес-клуб / сеть' },
  { value: 'sport-school', label: 'Спортивная школа' },
  { value: 'academy',      label: 'Академия / performance-центр' },
  { value: 'medical',      label: 'Медицинско-спортивный центр' },
  { value: 'team',         label: 'Команда / секция' },
  { value: 'other',        label: 'Другое' },
] as const

const COACH_COUNTS = ['1-3', '4-10', '10-25', '25+'] as const
const ATHLETE_COUNTS = ['<20', '20-50', '50-200', '200+'] as const

const PAIN_OPTIONS = [
  'Слишком много чатов',
  'Нет видимости тренерской работы',
  'Медданные не защищены',
  'Сложно onboard\'ить новых сотрудников',
  'Excel-конфликты редактирования',
  'Другое',
] as const

const INITIAL: AuditFormData = {
  name:         '',
  email:        '',
  telegram:     '',
  organization: '',
  orgType:      '',
  coachCount:   '',
  athleteCount: '',
  painPoints:   [],
  consent:      false,
}

function validate(data: AuditFormData): FieldError {
  const errs: FieldError = {}
  if (!data.name.trim() || data.name.trim().length < 2) {
    errs.name = 'Укажите ваше имя (минимум 2 символа)'
  }
  if (!data.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errs.email = 'Корректный email обязателен'
  }
  if (data.telegram.trim() && !/^@?[A-Za-z0-9_]{3,32}$/.test(data.telegram.trim())) {
    errs.telegram = 'Telegram-username: @ + 3-32 символа (буквы, цифры, _)'
  }
  if (!data.organization.trim() || data.organization.trim().length < 2) {
    errs.organization = 'Укажите название организации'
  }
  if (!data.orgType) {
    errs.orgType = 'Выберите тип организации'
  }
  if (!data.coachCount) {
    errs.coachCount = 'Укажите количество тренеров'
  }
  if (!data.athleteCount) {
    errs.athleteCount = 'Укажите количество атлетов'
  }
  if (!data.consent) {
    errs.consent = 'Согласие на обработку данных обязательно'
  }
  return errs
}

export default function LeadCaptureForm({ onSuccess }: LeadCaptureFormProps) {
  const [data, setData]       = useState<AuditFormData>(INITIAL)
  const [errors, setErrors]   = useState<FieldError>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState<string | null>(null)
  const [submitted, setSubmitted]   = useState(false)

  function setField<K extends keyof AuditFormData>(key: K, value: AuditFormData[K]) {
    setData((d) => ({ ...d, [key]: value }))
    if (errors[key as string]) {
      setErrors((e) => ({ ...e, [key as string]: undefined }))
    }
  }

  function togglePain(option: string) {
    setData((d) => ({
      ...d,
      painPoints: d.painPoints.includes(option)
        ? d.painPoints.filter((p) => p !== option)
        : [...d.painPoints, option],
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitErr(null)

    const errs = validate(data)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setSubmitting(true)
    trackEvent({ name: 'landing.lead_capture_submit' })

    try {
      const normalizedTelegram = data.telegram.trim().replace(/^@/, '')
      const res = await fetch('/api/leads/audit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         data.name.trim(),
          email:        data.email.trim().toLowerCase(),
          telegram:     normalizedTelegram ? `@${normalizedTelegram}` : null,
          organization: data.organization.trim(),
          orgType:      data.orgType,
          coachCount:   data.coachCount,
          athleteCount: data.athleteCount,
          painPoints:   data.painPoints,
          consent:      data.consent,
        }),
      })

      if (res.status === 429) {
        setSubmitErr('Слишком много заявок с этого IP. Попробуйте через час.')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitErr(body?.error === 'invalid_email'
          ? 'Email не прошёл валидацию. Проверьте написание.'
          : 'Не получилось отправить. Попробуйте ещё раз или напишите на support@proform-delta.vercel.app')
        return
      }

      // Success
      trackEvent({ name: 'landing.lead_capture_success' })
      setSubmitted(true)
      onSuccess?.()
    } catch {
      setSubmitErr('Сетевая ошибка. Проверьте подключение и попробуйте ещё раз.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center sm:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 size={28} strokeWidth={2.2} />
        </div>
        <h3 className="text-xl font-bold text-emerald-900">Заявка получена!</h3>
        <p className="text-sm text-emerald-900/90">
          Подготовим аудит клуба и отправим на{' '}
          <strong className="font-mono">{data.email}</strong> в течение 24 часов
          (в рабочие дни — обычно за 2-4 часа).
        </p>
        {data.telegram && (
          <p className="text-xs text-emerald-900/70">
            При необходимости свяжемся в Telegram: {data.telegram.startsWith('@') ? data.telegram : `@${data.telegram}`}
          </p>
        )}
        <p className="mt-2 text-xs text-emerald-900/70">
          Не получили письмо за 24 часа? Напишите на{' '}
          <a
            href="mailto:support@proform-delta.vercel.app"
            className="font-semibold underline"
          >
            support@proform-delta.vercel.app
          </a>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Name */}
      <div>
        <label htmlFor="lc-name" className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ваше имя <span className="text-red-500">*</span>
        </label>
        <input
          id="lc-name"
          type="text"
          autoComplete="name"
          value={data.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Иван Иванов"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'lc-name-err' : undefined}
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
        />
        {errors.name && <p id="lc-name-err" className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="lc-email" className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Email <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Mail aria-hidden="true" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="lc-email"
            type="email"
            autoComplete="email"
            value={data.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="ivan@club.ru"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'lc-email-err' : undefined}
            className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
          />
        </div>
        {errors.email && <p id="lc-email-err" className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      {/* Telegram (optional) */}
      <div>
        <label htmlFor="lc-tg" className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Telegram <span className="text-muted-foreground/70">(опционально, для быстрой связи)</span>
        </label>
        <div className="relative">
          <MessageCircle aria-hidden="true" size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            id="lc-tg"
            type="text"
            value={data.telegram}
            onChange={(e) => setField('telegram', e.target.value)}
            placeholder="@ivan_proform"
            aria-invalid={!!errors.telegram}
            aria-describedby={errors.telegram ? 'lc-tg-err' : undefined}
            className="w-full rounded-2xl border border-input bg-background py-3 pl-11 pr-4 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
          />
        </div>
        {errors.telegram && <p id="lc-tg-err" className="mt-1 text-xs text-red-600">{errors.telegram}</p>}
      </div>

      {/* Organization */}
      <div>
        <label htmlFor="lc-org" className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Название организации <span className="text-red-500">*</span>
        </label>
        <input
          id="lc-org"
          type="text"
          autoComplete="organization"
          value={data.organization}
          onChange={(e) => setField('organization', e.target.value)}
          placeholder="Клуб «Спарта»"
          aria-invalid={!!errors.organization}
          aria-describedby={errors.organization ? 'lc-org-err' : undefined}
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
        />
        {errors.organization && <p id="lc-org-err" className="mt-1 text-xs text-red-600">{errors.organization}</p>}
      </div>

      {/* Org type */}
      <div>
        <label htmlFor="lc-type" className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Тип организации <span className="text-red-500">*</span>
        </label>
        <select
          id="lc-type"
          value={data.orgType}
          onChange={(e) => setField('orgType', e.target.value)}
          aria-invalid={!!errors.orgType}
          aria-describedby={errors.orgType ? 'lc-type-err' : undefined}
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-all focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
        >
          <option value="">Выберите тип</option>
          {ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {errors.orgType && <p id="lc-type-err" className="mt-1 text-xs text-red-600">{errors.orgType}</p>}
      </div>

      {/* Size — 2 cols */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Тренеров <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {COACH_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setField('coachCount', c)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                  data.coachCount === c
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-border bg-white text-muted-foreground hover:border-orange-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {errors.coachCount && <p className="mt-1 text-xs text-red-600">{errors.coachCount}</p>}
        </div>
        <div>
          <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Атлетов <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {ATHLETE_COUNTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setField('athleteCount', c)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${
                  data.athleteCount === c
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-border bg-white text-muted-foreground hover:border-orange-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {errors.athleteCount && <p className="mt-1 text-xs text-red-600">{errors.athleteCount}</p>}
        </div>
      </div>

      {/* Pain points — multi-select */}
      <div>
        <label className="mb-1 block text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          Что главное сейчас? <span className="text-muted-foreground/70">(можно несколько)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PAIN_OPTIONS.map((option) => {
            const active = data.painPoints.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => togglePain(option)}
                aria-pressed={active}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-border bg-white text-muted-foreground hover:border-orange-200'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      {/* Consent */}
      <label className="flex items-start gap-3 rounded-2xl border border-border bg-slate-50 p-3 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={data.consent}
          onChange={(e) => setField('consent', e.target.checked)}
          aria-invalid={!!errors.consent}
          className="mt-0.5 h-4 w-4 rounded border-input text-orange-500 focus:ring-orange-500/30"
        />
        <span>
          Согласен на обработку персональных данных в соответствии с{' '}
          <a href="/legal/privacy" target="_blank" rel="noopener" className="font-semibold text-orange-600 hover:underline">
            Политикой конфиденциальности
          </a>
          . Данные используются только для составления аудита и связи с вами,
          не передаются третьим сторонам.
        </span>
      </label>
      {errors.consent && <p className="-mt-2 text-xs text-red-600">{errors.consent}</p>}

      {/* Submit */}
      {submitErr && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitErr}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <span className="pf-spin h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
            Отправляем...
          </>
        ) : (
          <>
            Получить аудит на email
            <ArrowRight size={18} />
          </>
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Аудит приходит на email в течение 24 часов. Без обязательств, без банковской карты.
      </p>
    </form>
  )
}
