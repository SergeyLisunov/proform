'use client'
/**
 * /onboarding/specialist — мастер первого входа специалиста: физиотерапевт,
 * массажист, нутрициолог, психолог.
 *
 *   1. Специализация          → specialist_types (одна или несколько) + main_focus
 *   2. О себе и квалификация  → bio, experience_years, education, certifications, license_number
 *   3. Как вы работаете       → formats, city, accepts_new_clients, profile_public
 *   4. Согласия и границы     → 152-ФЗ, условия использования, границы роли
 *
 * Модель формы, проверки и преобразование в строку specialists — общие с
 * настройками (lib/specialist-form). Профиль пишется только на финише и
 * целиком; в onboarding_state между шагами уходят лишь шаг и специализации.
 * Поэтому при возврате в мастер поля берутся из строки specialists, если она
 * уже есть: финиш сохранил профиль, а отметка «пройден» не записалась.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/hooks/useUser'
import WizardShell, { WIZARD_ERROR_ID, type WizardStep } from '@/components/onboarding/WizardShell'
import {
  loadMyOnboarding, patchMyOnboarding, markOnboardingComplete,
  type SpecialistWizardData,
} from '@/services/onboarding.service'
import { getSpecialistProfile, saveSpecialistProfile } from '@/services/specialist.service'
import {
  SPECIALIST_TYPES, SPECIALIST_TYPE_META, SPECIALIST_FORMATS, SPECIALIST_FORMAT_META, SPECIALIST_SCOPE,
} from '@/lib/specialist'
import {
  MAX_CERTS, MAX_EXPERIENCE_YEARS, SPECIALIST_FIELD_LABEL as LABEL,
  emptySpecialistForm, specialistFormFromProfile, specialistFormError, toSpecialistInput,
  toggleSpecialistType, toggleSpecialistFormat, digitsOnly, isBlankCertRow, cityRequired,
  knownSpecialistTypes,
  type CertRow, type SpecialistForm, type SpecialistFormSection,
  MAX_BIO_LENGTH,
} from '@/lib/specialist-form'
import { roleMeta } from '@/lib/roles'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/reui/button'
import { ScopeList } from '@/components/specialist/ScopeList'

const ROLE = roleMeta('specialist')

// Tailwind собирает классы только из литералов, поэтому цвет роли
// (ROLE_META.specialist, #0284C7) в классах повторён строкой.
const CHOICE_ON   = 'border-[#0284C7] bg-[#0284C7]/10'
const CHOICE_OFF  = 'border-border bg-background hover:border-[#0284C7]/40'
const FOCUS_RING  = 'outline-hidden focus-visible:ring-2 focus-visible:ring-[#0284C7]/40'
const FIELD       = `w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-[#0284C7] aria-invalid:border-destructive ${FOCUS_RING}`
const FIELD_LABEL = 'text-xs font-bold uppercase tracking-widest text-muted-foreground'
const CHECKBOX    = 'mt-0.5 size-4 shrink-0 accent-[#0284C7]'
const LINK        = `rounded-sm font-semibold text-foreground underline decoration-[#0284C7] ${FOCUS_RING}`


const STEP_KEYS = ['specialty', 'experience', 'work', 'consents'] as const
type StepKey = (typeof STEP_KEYS)[number]

/** Ошибка, которую показывает мастер. step — чьи поля подсветить; у сбоя сохранения его нет. */
interface Issue { message: string; step?: StepKey }

interface Consents { consent152: boolean; acceptTerms: boolean; scopeAck: boolean }

const NO_CONSENTS: Consents = { consent152: false, acceptTerms: false, scopeAck: false }

function consentsError(c: Consents): string | null {
  if (!c.consent152)  return 'Нужно согласие на обработку данных о здоровье (152-ФЗ)'
  if (!c.acceptTerms) return 'Примите условия использования'
  if (!c.scopeAck)    return 'Подтвердите, что понимаете границы роли'
  return null
}

// Шаги 1–3 — разделы общей формы; раздела «Контакты» в мастере нет.
function stepIssue(step: StepKey, form: SpecialistForm, consents: Consents): Issue | null {
  const message = step === 'consents'
    ? consentsError(consents)
    : specialistFormError(form, [step])?.message ?? null
  return message ? { step, message } : null
}

function firstIssue(form: SpecialistForm, consents: Consents): Issue | null {
  for (const step of STEP_KEYS) {
    const found = stepIssue(step, form, consents)
    if (found) return found
  }
  return null
}

// Ошибку отдельного поля спрашиваем у той же общей проверки, подставив поле
// в пустую форму, — пределы остаются в одном месте.
function fieldHasError(patch: Partial<SpecialistForm>, section: SpecialistFormSection): boolean {
  return specialistFormError({ ...emptySpecialistForm(), ...patch }, [section]) !== null
}

const describedBy = (invalid: boolean, ...ids: string[]): string | undefined =>
  [...ids, ...(invalid ? [WIZARD_ERROR_ID] : [])].join(' ') || undefined

export default function SpecialistOnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const userId = user?.id ?? null
  const userRole = user?.role ?? null

  const [currentIndex, setCurrentIndex] = useState(0)
  const [form, setForm]                 = useState<SpecialistForm>(emptySpecialistForm)
  const [consents, setConsents]         = useState<Consents>(NO_CONSENTS)
  const [busy, setBusy]                 = useState(false)
  const [issue, setIssue]               = useState<Issue | null>(null)
  const [hydrated, setHydrated]         = useState(false)
  const [loadFailed, setLoadFailed]     = useState(false)
  const [loadAttempt, setLoadAttempt]   = useState(0)

  const rowSeq = useRef(0)
  const nextRowKey = useCallback(() => `cert-${++rowSeq.current}`, [])

  // Запись шага из next() не ждём, а финиш ждёт: patchMyOnboarding читает
  // состояние и пишет его целиком, и запоздавшая запись шага затёрла бы
  // согласия. Цепочка заодно не даёт записям шагов обгонять друг друга.
  const stepWrites = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    if (userLoading) return
    if (!userId) { router.replace('/auth/login'); return }
    if (userRole !== 'specialist') { router.replace('/onboarding'); return }
    let cancelled = false
    void (async () => {
      try {
        const [state, profile] = await Promise.all([loadMyOnboarding(), getSpecialistProfile(userId)])
        if (cancelled) return
        if (state.completed) { router.replace('/dashboard'); return }
        const s = (state.specialist ?? {}) as SpecialistWizardData
        const savedTypes = knownSpecialistTypes(s.specialist_types)
        const base = specialistFormFromProfile(profile, nextRowKey)
        // Шаг 1 сохраняется сразу, профиль — только на финише: свежее то, что в onboarding_state.
        setForm(savedTypes.length > 0 ? { ...base, types: savedTypes } : base)
        setConsents({
          consent152:  s.consent_152fz === true,
          acceptTerms: s.accept_terms === true,
          scopeAck:    s.scope_ack === true,
        })
        if (!state.started_at) {
          await patchMyOnboarding({
            started_at:        new Date().toISOString(),
            role_when_started: 'specialist',
            step:              STEP_KEYS[0],
          })
        }
        if (!cancelled) setHydrated(true)
      } catch {
        // Пустую форму вместо незагруженной не показываем: финиш сохраняет
        // строку целиком и затёр бы уже заполненный профиль.
        if (!cancelled) setLoadFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [userId, userRole, userLoading, router, nextRowKey, loadAttempt])

  function retryLoad() {
    setLoadFailed(false)
    setLoadAttempt(n => n + 1)
  }

  function update(patch: Partial<SpecialistForm>) {
    setIssue(null)
    setForm(prev => ({ ...prev, ...patch }))
  }

  function updateConsents(patch: Partial<Consents>) {
    setIssue(null)
    setConsents(prev => ({ ...prev, ...patch }))
  }

  function next() {
    const found = stepIssue(STEP_KEYS[currentIndex], form, consents)
    if (found) { setIssue(found); return }
    setIssue(null)
    const nextIndex = Math.min(currentIndex + 1, STEP_KEYS.length - 1)
    const patch = { step: STEP_KEYS[nextIndex], specialist: { specialist_types: [...form.types] } }
    // Шаг нужен лишь для возврата в мастер — его сбой не мешает идти дальше.
    stepWrites.current = stepWrites.current.then(() => patchMyOnboarding(patch)).catch(() => {})
    setCurrentIndex(nextIndex)
  }

  function prev() { setIssue(null); setCurrentIndex(i => Math.max(i - 1, 0)) }

  async function finish() {
    if (!userId) { setIssue({ message: 'Сессия истекла — войдите снова' }); return }
    const found = firstIssue(form, consents)
    if (found) {
      if (found.step) setCurrentIndex(STEP_KEYS.indexOf(found.step))
      setIssue(found)
      return
    }
    setIssue(null)
    setBusy(true)
    const fail = (message: string) => { setIssue({ message }); setBusy(false) }
    try {
      const saved = await saveSpecialistProfile(userId, toSpecialistInput(form))
      if (!saved.ok) { fail(saved.error); return }

      await stepWrites.current
      // patchMyOnboarding не бросает: при сбое возвращает прежнее состояние.
      // Других записей о согласиях нет, поэтому без них онбординг не закрываем.
      const consentedAt = new Date().toISOString()
      const after = await patchMyOnboarding({
        specialist: {
          specialist_types: [...form.types], consent_152fz: true, accept_terms: true, scope_ack: true,
          consented_at: consentedAt,
        },
      })
      const s = after.specialist
      if (s?.consent_152fz !== true || s.accept_terms !== true || s.scope_ack !== true || s.consented_at !== consentedAt) {
        fail('Профиль сохранён, но согласия записать не удалось. Попробуйте ещё раз.')
        return
      }

      const ok = await markOnboardingComplete()
      if (!ok) { fail('Профиль сохранён, но завершить онбординг не удалось. Попробуйте ещё раз.'); return }
      router.replace('/dashboard')
    } catch {
      fail('Не удалось завершить онбординг. Проверьте соединение и попробуйте ещё раз.')
    }
  }

  const steps: WizardStep[] = [
    {
      key:         'specialty',
      title:       'Специализация',
      description: 'Чем вы занимаетесь? Можно выбрать несколько специализаций.',
      canAdvance:  form.types.length > 0,
    },
    {
      key:         'experience',
      title:       'О себе и квалификация',
      description: 'Всё необязательно, но так спортсмену проще решить, принять ли ваш запрос на работу.',
    },
    {
      key:         'work',
      title:       'Как вы работаете',
      description: 'Где вы встречаетесь с клиентами и кто видит ваш профиль.',
      canAdvance:  form.formats.length > 0,
    },
    {
      key:         'consents',
      title:       'Согласия и границы роли',
      description: 'Специалист работает рядом с врачом, но не вместо него. Подтвердите, что понимаете, где проходит граница.',
      canAdvance:  consentsError(consents) === null,
    },
  ]

  if (loadFailed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xs">
          <Icon name="ki-information-2" className="text-2xl text-destructive" />
          <p className="mt-2 text-sm font-semibold text-foreground">Не удалось загрузить ваши данные</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Проверьте соединение и попробуйте ещё раз. Пустую форму не открываем, чтобы не затереть то, что вы уже заполнили.
          </p>
          <Button variant="outline" className="mt-4" onClick={retryLoad}>Повторить</Button>
        </div>
      </div>
    )
  }

  if (userLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Загрузка">
        <div className="w-8 h-8 border-2 border-[#0284C7] border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  const stepKey = STEP_KEYS[currentIndex]
  const showInvalid = issue?.step === stepKey

  return (
    <WizardShell
      roleLabel={ROLE.label}
      accentColor={ROLE.text}
      steps={steps}
      currentIndex={currentIndex}
      busy={busy}
      error={issue?.message ?? null}
      onPrev={prev}
      onNext={next}
      onFinish={finish}
      finishLabel="Принять и открыть кабинет"
    >
      {stepKey === 'specialty'  && <SpecialtyStep form={form} onChange={update} showInvalid={showInvalid} />}
      {stepKey === 'experience' && <ExperienceStep form={form} onChange={update} showInvalid={showInvalid} nextRowKey={nextRowKey} />}
      {stepKey === 'work'       && <WorkStep form={form} onChange={update} showInvalid={showInvalid} />}
      {stepKey === 'consents'   && <ConsentStep consents={consents} onChange={updateConsents} />}
    </WizardShell>
  )
}

interface FormStepProps {
  form: SpecialistForm
  onChange: (patch: Partial<SpecialistForm>) => void
  /** Ошибка этого шага показана — подсветить поля, к которым она относится. */
  showInvalid: boolean
}

function SpecialtyStep({ form, onChange }: FormStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Специализации">
        {SPECIALIST_TYPES.map(type => {
          const meta = SPECIALIST_TYPE_META[type]
          const selected = form.types.includes(type)
          return (
            <button key={type} type="button" aria-pressed={selected}
              onClick={() => onChange({ types: toggleSpecialistType(form.types, type) })}
              className={`flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${FOCUS_RING} ${selected ? CHOICE_ON : CHOICE_OFF}`}>
              <Icon name={meta.icon} className="mt-0.5 shrink-0 text-xl text-[#0284C7]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-foreground">{meta.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
              </span>
              {selected && <Icon name="ki-check-circle" className="shrink-0 text-lg text-[#0284C7]" />}
            </button>
          )
        })}
      </div>

      <div>
        <label htmlFor="sp-main-focus" className={FIELD_LABEL}>{LABEL.mainFocus} (необязательно)</label>
        <input id="sp-main-focus" type="text" value={form.mainFocus} maxLength={200}
          onChange={e => onChange({ mainFocus: e.target.value })}
          placeholder="Например: восстановление после травм колена, питание в циклических видах"
          className={`mt-1 ${FIELD}`} />
      </div>
    </div>
  )
}

function ExperienceStep({ form, onChange, showInvalid, nextRowKey }: FormStepProps & { nextRowKey: () => string }) {
  const certs = form.certs
  const editRow = (key: string, patch: Partial<CertRow>) =>
    onChange({ certs: certs.map(r => (r.key === key ? { ...r, ...patch } : r)) })
  const addRow = () => onChange({ certs: [...certs, { key: nextRowKey(), name: '', issuer: '', year: '' }] })
  const removeRow = (key: string) => onChange({ certs: certs.filter(r => r.key !== key) })

  const experienceInvalid = showInvalid && fieldHasError({ experience: form.experience }, 'experience')

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="sp-bio" className={FIELD_LABEL}>{LABEL.bio} (необязательно)</label>
        <textarea id="sp-bio" value={form.bio} rows={4} maxLength={MAX_BIO_LENGTH}
          onChange={e => onChange({ bio: e.target.value })}
          placeholder="С кем и как работаете, в чём сильны — пара предложений для спортсмена"
          aria-describedby="sp-bio-hint"
          className={`mt-1 resize-y ${FIELD}`} />
        <p id="sp-bio-hint" className="mt-1 text-xs text-muted-foreground">
          {form.bio.length} из {MAX_BIO_LENGTH} символов
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="sp-experience" className={FIELD_LABEL}>{LABEL.experience}</label>
          <input id="sp-experience" type="text" inputMode="numeric" value={form.experience}
            onChange={e => onChange({ experience: digitsOnly(e.target.value, 2) })}
            placeholder={`0–${MAX_EXPERIENCE_YEARS}`}
            aria-invalid={experienceInvalid || undefined}
            aria-describedby={describedBy(experienceInvalid, 'sp-experience-hint')}
            className={`mt-1 ${FIELD}`} />
          <p id="sp-experience-hint" className="mt-1 text-xs text-muted-foreground">Полных лет практики</p>
        </div>
        <div>
          <label htmlFor="sp-license" className={FIELD_LABEL}>{LABEL.license}</label>
          <input id="sp-license" type="text" value={form.license} maxLength={100}
            onChange={e => onChange({ license: e.target.value })}
            placeholder="Лицензия или аккредитация, если есть"
            className={`mt-1 ${FIELD}`} />
        </div>
      </div>

      <div>
        <label htmlFor="sp-education" className={FIELD_LABEL}>{LABEL.education}</label>
        <textarea id="sp-education" value={form.education} rows={3} maxLength={500}
          onChange={e => onChange({ education: e.target.value })}
          placeholder="Вуз, специальность, год окончания"
          className={`mt-1 resize-y ${FIELD}`} />
      </div>

      <fieldset>
        <legend className={FIELD_LABEL}>{LABEL.certs}</legend>
        {certs.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Пока ничего — добавьте, если есть чем подтвердить квалификацию.</p>
        )}
        <ul className="mt-2 space-y-2">
          {certs.map((row, i) => {
            const filled = !isBlankCertRow(row)
            const nameInvalid = showInvalid && filled && !row.name.trim()
            // С названием в строке остаётся одна возможная ошибка — год.
            const yearInvalid = showInvalid && filled && !nameInvalid && fieldHasError({ certs: [row] }, 'experience')
            return (
              <li key={row.key}
                className="grid grid-cols-[1fr_5.5rem_auto] gap-2 rounded-xl border border-border p-2 sm:grid-cols-[1fr_1fr_5.5rem_auto]">
                <input type="text" value={row.name} maxLength={200}
                  aria-label={`Сертификат ${i + 1}: название`} placeholder="Название"
                  aria-invalid={nameInvalid || undefined}
                  aria-describedby={describedBy(nameInvalid)}
                  onChange={e => editRow(row.key, { name: e.target.value })}
                  className={`col-span-3 sm:col-span-1 ${FIELD}`} />
                <input type="text" value={row.issuer} maxLength={200}
                  aria-label={`Сертификат ${i + 1}: кем выдан`} placeholder="Кем выдан"
                  onChange={e => editRow(row.key, { issuer: e.target.value })}
                  className={FIELD} />
                <input type="text" inputMode="numeric" value={row.year}
                  aria-label={`Сертификат ${i + 1}: год`} placeholder="Год"
                  aria-invalid={yearInvalid || undefined}
                  aria-describedby={describedBy(yearInvalid)}
                  onChange={e => editRow(row.key, { year: digitsOnly(e.target.value, 4) })}
                  className={FIELD} />
                <button type="button" onClick={() => removeRow(row.key)}
                  aria-label={`Удалить сертификат ${i + 1}`}
                  className={`flex items-center justify-center rounded-xl px-3 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive ${FOCUS_RING}`}>
                  <Icon name="ki-trash" className="text-base" />
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-2 flex items-center gap-3">
          <button type="button" onClick={addRow} disabled={certs.length >= MAX_CERTS}
            className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[#0284C7]/40 disabled:opacity-50 ${FOCUS_RING}`}>
            <Icon name="ki-plus" className="text-sm" />
            Добавить сертификат
          </button>
          <span className="text-xs text-muted-foreground">{certs.length} из {MAX_CERTS}</span>
        </div>
      </fieldset>
    </div>
  )
}

function WorkStep({ form, onChange, showInvalid }: FormStepProps) {
  const needCity = cityRequired(form.formats)
  const cityInvalid = showInvalid && needCity && !form.city.trim()
  return (
    <div className="space-y-5">
      <div>
        <span id="sp-formats-label" className={`block ${FIELD_LABEL}`}>
          {LABEL.formats}
          <span aria-hidden="true"> *</span>
          <span className="sr-only"> (обязательно)</span>
        </span>
        <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-labelledby="sp-formats-label">
          {SPECIALIST_FORMATS.map(format => {
            const meta = SPECIALIST_FORMAT_META[format]
            const selected = form.formats.includes(format)
            return (
              <button key={format} type="button" aria-pressed={selected}
                onClick={() => onChange({ formats: toggleSpecialistFormat(form.formats, format) })}
                className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition-colors sm:flex-col sm:items-center sm:text-center ${FOCUS_RING} ${selected ? CHOICE_ON : CHOICE_OFF}`}>
                <Icon name={meta.icon} className="shrink-0 text-xl text-[#0284C7]" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">{meta.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{meta.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label htmlFor="sp-city" className={FIELD_LABEL}>
          {LABEL.city}
          {needCity ? <span aria-hidden="true"> *</span> : ' (необязательно)'}
        </label>
        <input id="sp-city" type="text" value={form.city} maxLength={80}
          onChange={e => onChange({ city: e.target.value })}
          placeholder="Москва" aria-required={needCity}
          aria-invalid={cityInvalid || undefined}
          aria-describedby={describedBy(cityInvalid)}
          className={`mt-1 ${FIELD}`} />
        {!needCity && form.formats.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">Работаете только онлайн — город можно не указывать.</p>
        )}
      </div>

      <div className="space-y-3">
        <CheckCard checked={form.acceptsNewClients} onChange={v => onChange({ acceptsNewClients: v })}
          title="Принимаю новых клиентов">
          Выключите, если сейчас нет времени на новых клиентов.
        </CheckCard>
        <CheckCard checked={form.profilePublic} onChange={v => onChange({ profilePublic: v })}
          title="Сделать профиль публичным">
          Специализацию, основной фокус, рассказ о себе, опыт, образование, сертификаты, номер лицензии и город
          увидят все — даже без входа в Sporteo. Пока галочка снята, профиль видите только вы;
          включить можно и позже, в настройках.
        </CheckCard>
      </div>
    </div>
  )
}

function ConsentStep({ consents, onChange }: { consents: Consents; onChange: (patch: Partial<Consents>) => void }) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="sp-scope-title" className="rounded-2xl border border-border bg-background p-4">
        <h2 id="sp-scope-title" className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Icon name="ki-shield-tick" className="text-base text-[#0284C7]" />
          Границы роли
        </h2>
        <ScopeList className="mt-3" />
      </section>

      <div className="space-y-3">
        <CheckCard checked={consents.consent152} onChange={v => onChange({ consent152: v })}
          title="Согласие на обработку данных о здоровье (152-ФЗ)">
          Ограничения, травмы и восстановление клиентов — особая категория персональных данных.
          Обрабатываю их только с согласия клиента и в объёме, нужном для работы с ним.
          Подробнее — в <NewTabLink href="/legal/privacy">политике обработки персональных данных</NewTabLink>.
        </CheckCard>
        <CheckCard checked={consents.acceptTerms} onChange={v => onChange({ acceptTerms: v })}
          title="Принимаю условия использования">
          Текст — на странице <NewTabLink href="/legal/terms">условий использования</NewTabLink>.
          Рекомендации специалиста не заменяют осмотр и назначения врача.
        </CheckCard>
        <CheckCard checked={consents.scopeAck} onChange={v => onChange({ scopeAck: v })}
          title="Понимаю границы роли">
          Соблюдаю границы из списка «{SPECIALIST_SCOPE.cannotTitle}» выше. Если замечаю симптомы,
          с которыми нужен врач, — направляю к врачу.
        </CheckCard>
      </div>

      <p className="rounded-xl border border-dashed border-border bg-accent/30 p-3 text-xs text-muted-foreground">
        После завершения откроется ваш кабинет. Клиенты появятся там, когда связь подтвердят обе стороны: спортсмен примет ваш запрос или вы — его.
      </p>
    </div>
  )
}

function NewTabLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
      <span className="sr-only"> (откроется в новой вкладке)</span>
    </Link>
  )
}

interface CheckCardProps {
  checked: boolean
  onChange: (value: boolean) => void
  title: string
  children: ReactNode
}

function CheckCard({ checked, onChange, title, children }: CheckCardProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-accent/30 p-3">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className={CHECKBOX} />
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{children}</span>
      </span>
    </label>
  )
}
