'use client'
/**
 * /onboarding/organization — Sprint W6 Day 31 (PR #49).
 *
 * 4-step wizard for first-time organizations:
 *   1. Basics       → org_name + org_type + sport_type
 *   2. Profile      → description + city + profile_public
 *   3. First invites → up to 3 athlete emails (POST /api/invite, connection=org_athlete)
 *   4. Review       → summary + finish
 *
 * On finish:
 *   - UPDATE the organizations row (created by the role trigger, migration 088,
 *       with placeholder name/slug) with the wizard's real name/type/profile +
 *       a human slug (best-effort; keeps the id-based slug if it's taken).
 *       Silent fail — onboarding still completes so the user lands on /org and
 *       can finish the profile from settings.
 *   - Dispatch invite emails (best-effort, count goes to invites_sent).
 *   - markOnboardingComplete → redirect to /org.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import WizardShell, { type WizardStep } from '@/components/onboarding/WizardShell'
import {
  loadMyOnboarding, patchMyOnboarding, markOnboardingComplete,
  type OrgWizardData,
} from '@/services/onboarding.service'

const ACCENT = '#2563EB'   // blue — matches organization role tint
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ORG_TYPES: Array<{ key: string; label: string; emoji: string }> = [
  { key: 'club',       label: 'Клуб',           emoji: '🏅' },
  { key: 'federation', label: 'Федерация',      emoji: '🏛️' },
  { key: 'team',       label: 'Команда',        emoji: '🚴' },
  { key: 'school',     label: 'Школа',          emoji: '🎓' },
  { key: 'gym',        label: 'Фитнес-центр',   emoji: '💪' },
  { key: 'academy',    label: 'Академия',       emoji: '📘' },
  { key: 'other',      label: 'Другое',         emoji: '⭐' },
]

function slugify(name: string): string {
  const map: Record<string, string> = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',
    л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',
    ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
  }
  return name.toLowerCase()
    .split('')
    .map(c => map[c] ?? c)
    .join('')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `org-${Date.now()}`
}

export default function OrgOnboardingPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [orgName, setOrgName]           = useState('')
  const [orgType, setOrgType]           = useState('')
  const [sportType, setSportType]       = useState('')
  const [description, setDescription]   = useState('')
  const [city, setCity]                 = useState('')
  const [profilePublic, setProfilePublic] = useState(true)
  const [emails, setEmails]             = useState<string[]>(['', '', ''])
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [hydrated, setHydrated]         = useState(false)

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.replace('/auth/login'); return }
    let cancelled = false
    void (async () => {
      const state = await loadMyOnboarding()
      if (cancelled) return
      if (state.completed) { router.replace('/org'); return }
      const o = (state.organization ?? {}) as OrgWizardData
      if (o.org_name)        setOrgName(o.org_name)
      if (o.org_type)        setOrgType(o.org_type)
      if (o.sport_type)      setSportType(o.sport_type)
      if (o.description)     setDescription(o.description)
      if (o.city)            setCity(o.city)
      if (typeof o.profile_public === 'boolean') setProfilePublic(o.profile_public)
      if (Array.isArray(o.invite_emails) && o.invite_emails.length > 0) {
        setEmails([o.invite_emails[0] ?? '', o.invite_emails[1] ?? '', o.invite_emails[2] ?? ''])
      }
      if (!state.started_at) {
        await patchMyOnboarding({
          started_at:        new Date().toISOString(),
          role_when_started: 'organization',
          step:              'basics',
        })
      }
      setHydrated(true)
    })()
    return () => { cancelled = true }
  }, [user, userLoading, router])

  const persistStep = useCallback(async (stepKey: string, patch: Partial<OrgWizardData>) => {
    await patchMyOnboarding({ step: stepKey, organization: patch }).catch(() => {})
  }, [])

  const trimmedEmails = useMemo(
    () => emails.map(e => e.trim()).filter(Boolean),
    [emails],
  )
  const invalidEmails = trimmedEmails.filter(e => !EMAIL_RE.test(e))

  function next() {
    setError(null)
    if (currentIndex === 0) {
      if (orgName.trim().length < 3) { setError('Минимум 3 символа в названии'); return }
      if (!orgType)                  { setError('Выберите тип организации'); return }
      void persistStep('profile', {
        org_name:   orgName.trim(),
        org_type:   orgType,
        sport_type: sportType.trim() || undefined,
      })
    } else if (currentIndex === 1) {
      void persistStep('invites', {
        description:     description.trim() || undefined,
        city:            city.trim() || undefined,
        profile_public:  profilePublic,
      })
    } else if (currentIndex === 2) {
      if (invalidEmails.length > 0) {
        setError(`Невалидный email: ${invalidEmails[0]}`)
        return
      }
      void persistStep('review', { invite_emails: trimmedEmails })
    }
    setCurrentIndex(i => Math.min(i + 1, 3))
  }

  function prev() { setError(null); setCurrentIndex(i => Math.max(i - 1, 0)) }

  async function persistOrgProfile(meId: string): Promise<boolean> {
    const sb = createClient()
    // The organizations row already exists — the role trigger (migration 088)
    // creates it with a placeholder name + id-based slug the moment a user
    // becomes role='organization'. So we UPDATE it with the wizard's real data;
    // an INSERT would conflict on the existing id and silently drop the input.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: err } = await (sb as any)
      .from('organizations')
      .update({
        org_name:       orgName.trim(),
        org_type:       orgType,
        sport_type:     sportType.trim() || null,
        description:    description.trim() || null,
        city:           city.trim() || null,
        profile_public: profilePublic,
      })
      .eq('id', meId)
      .select('id')
      .maybeSingle()
    if (err || !updated) {
      console.warn('[org-onboarding] organizations update:', err?.message ?? 'no row updated')
      return false
    }
    // Best-effort human slug. org_slug is UNIQUE — if this one is already taken
    // we keep the trigger's id-based slug (the org can rename later in settings).
    const slug = slugify(orgName)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: slugErr } = await (sb as any)
      .from('organizations')
      .update({ org_slug: slug })
      .eq('id', meId)
    if (slugErr) console.warn('[org-onboarding] slug not applied (likely taken):', slugErr.message)
    return true
  }

  async function dispatchInvites(): Promise<number> {
    let sent = 0
    for (const email of trimmedEmails) {
      try {
        const res = await fetch('/api/invite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, connection_type: 'org_athlete' }),
        })
        if (res.ok) sent++
      } catch { /* silent */ }
    }
    return sent
  }

  async function finish() {
    setError(null)
    if (!user) { setError('Сессия истекла'); return }
    if (orgName.trim().length < 3 || !orgType) {
      setError('Шаг 1 не завершён')
      return
    }
    setBusy(true)
    try {
      const orgCreated = await persistOrgProfile(user.id)
      const sent       = await dispatchInvites()

      await patchMyOnboarding({
        organization: {
          org_name:        orgName.trim(),
          org_type:        orgType,
          sport_type:      sportType.trim() || undefined,
          description:     description.trim() || undefined,
          city:            city.trim() || undefined,
          profile_public:  profilePublic,
          invite_emails:   trimmedEmails,
          invites_sent:    sent,
          org_row_created: orgCreated,
        },
      })
      const ok = await markOnboardingComplete()
      if (!ok) { setError('Не удалось отметить onboarding'); setBusy(false); return }
      router.replace('/org')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'FINISH_FAILED')
      setBusy(false)
    }
  }

  const steps: WizardStep[] = [
    {
      key:         'basics',
      title:       'Основное',
      description: 'Название, тип и спортивная направленность — отображаются в каталоге.',
      canAdvance:  orgName.trim().length >= 3 && !!orgType,
    },
    {
      key:         'profile',
      title:       'Профиль',
      description: 'Краткое описание + видимость в публичном каталоге.',
      canAdvance:  true,
    },
    {
      key:         'invites',
      title:       'Первые приглашения',
      description: 'До 3 email атлетов — приглашения отправятся при завершении. Пропустите, если нет под рукой.',
      canAdvance:  invalidEmails.length === 0,
    },
    {
      key:         'review',
      title:       'Проверьте и завершите',
      description: 'Можно изменить детали потом в /settings.',
      canAdvance:  true,
    },
  ]

  if (userLoading || !hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <WizardShell
      roleLabel="Организация"
      accentColor={ACCENT}
      steps={steps}
      currentIndex={currentIndex}
      busy={busy}
      error={error}
      onPrev={prev}
      onNext={next}
      onFinish={finish}
      finishLabel="Создать организацию"
    >
      {currentIndex === 0 && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Название организации *
            </label>
            <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
              placeholder="Sporteo Triathlon Club"
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
              Тип организации *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ORG_TYPES.map(t => {
                const sel = orgType === t.key
                return (
                  <button key={t.key} type="button" onClick={() => setOrgType(t.key)}
                    className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold transition flex flex-col items-center gap-1 ${
                      sel ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-border bg-background hover:border-blue-200 text-foreground'
                    }`}>
                    <span className="text-xl">{t.emoji}</span>
                    <span className="text-[12px]">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Вид спорта
            </label>
            <input type="text" value={sportType} onChange={e => setSportType(e.target.value)}
              placeholder="Например: триатлон, лёгкая атлетика, мультиспорт"
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>
        </div>
      )}

      {currentIndex === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Описание
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Краткая визитка — для атлетов и тренеров. Что отличает вашу организацию?"
              rows={4} maxLength={500}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-vertical" />
            <p className="mt-1 text-[11px] text-muted-foreground">{description.length}/500</p>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Город
            </label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)}
              placeholder="Москва"
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-border bg-accent/30 cursor-pointer">
            <input type="checkbox" checked={profilePublic} onChange={e => setProfilePublic(e.target.checked)}
              className="mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground">Публичный профиль</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Организация появится в публичном каталоге /marketplace.
                Можно отключить позже — это не влияет на ваш ростер и операции.
              </div>
            </div>
          </label>
        </div>
      )}

      {currentIndex === 2 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Введите 1-3 email атлета — они получат приглашение со ссылкой на регистрацию + автоматическое связывание с вашей организацией.
          </p>
          {emails.map((e, i) => (
            <div key={i}>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Атлет {i + 1}
              </label>
              <input type="email" value={e}
                onChange={ev => { const arr = [...emails]; arr[i] = ev.target.value; setEmails(arr) }}
                placeholder="athlete@example.com"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-border bg-accent/30 p-3 text-[11px] text-muted-foreground">
            Можно пропустить все поля — пригласить атлетов потом из /org/members.
          </div>
        </div>
      )}

      {currentIndex === 3 && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-sm">
            <div><strong className="text-foreground">Название:</strong> <span className="text-muted-foreground">{orgName || '—'}</span></div>
            <div><strong className="text-foreground">Тип:</strong> <span className="text-muted-foreground">{ORG_TYPES.find(t => t.key === orgType)?.label ?? '—'}</span></div>
            {sportType && <div><strong className="text-foreground">Спорт:</strong> <span className="text-muted-foreground">{sportType}</span></div>}
            {city       && <div><strong className="text-foreground">Город:</strong> <span className="text-muted-foreground">{city}</span></div>}
            <div><strong className="text-foreground">Публичный профиль:</strong> <span className="text-muted-foreground">{profilePublic ? 'Да' : 'Нет'}</span></div>
            <div><strong className="text-foreground">Приглашения:</strong> <span className="text-muted-foreground">{trimmedEmails.length > 0 ? `${trimmedEmails.length} email${trimmedEmails.length === 1 ? '' : 'ов'}` : 'нет'}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            После завершения откроется панель организации. Можно вернуться к настройкам через /settings.
          </p>
        </div>
      )}
    </WizardShell>
  )
}
