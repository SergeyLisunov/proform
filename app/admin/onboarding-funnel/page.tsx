/**
 * /admin/onboarding-funnel — Sprint W7 Day 36 (PR #54).
 *
 * Closes the "wizard funnel invisible" gap from W6. After W6 Day 30/31
 * shipped 4 onboarding wizards (athlete/coach/org/doctor), we knew users
 * were entering them but had no view of WHERE they dropped off.
 *
 * Strategy — derive entirely from `users.onboarding_state` JSONB (no
 * event log, no migration). Each wizard persists `step` on every Next
 * transition (W6 Day 30 design). Rank a user's progress as the index
 * of their current step in the role's STEP_ORDER. "Reached step X" =
 * user.stepIndex >= X OR completed=true.
 *
 * Backfilled legacy users (Migration 068) are excluded — their
 * `backfilled: true` marks them as not-real-funnel-participants. We
 * focus only on users who actually entered a wizard (started_at set).
 *
 * Auth: admin role required.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type WizardRole = 'athlete' | 'coach' | 'organization' | 'doctor'

/** Step order per role (matches W6 Day 30/31 wizard definitions). */
const STEP_ORDER: Record<WizardRole, string[]> = {
  athlete:      ['sport',      'goal',         'level'],
  coach:        ['speciality', 'invite',       'plan'],
  organization: ['basics',     'profile',      'invites',     'review'],
  doctor:       ['specialty',  'availability', 'compliance'],
}

const ROLE_META: Record<WizardRole, { label: string; accent: string; bg: string; border: string }> = {
  athlete:      { label: 'Атлет',         accent: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
  coach:        { label: 'Тренер',        accent: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  organization: { label: 'Организация',   accent: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  doctor:       { label: 'Врач',          accent: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
}

interface OnboardingState {
  completed?:    boolean
  started_at?:   string
  completed_at?: string | null
  step?:         string
  backfilled?:   boolean
}

interface UserRow {
  id:                string
  role:              string
  created_at:        string
  onboarding_state:  OnboardingState | null
}

interface RoleFunnel {
  role:                  WizardRole
  total_signups:         number   // ALL users with this role (incl. backfilled)
  started:               number   // entered wizard (started_at set, not backfilled)
  per_step:              number[] // count who reached or passed each step
  completed:             number
  drop_rate:             number   // (started - completed) / started
  avg_time_minutes:      number | null  // avg completed_at - started_at
  median_time_minutes:   number | null
  resume_indicator:      number   // started_at older than 1d AND not completed AND step set
}

function stepIndex(role: WizardRole, step: string | undefined): number {
  if (!step) return -1
  const idx = STEP_ORDER[role].indexOf(step)
  return idx   // -1 if unknown/done
}

function computeFunnel(role: WizardRole, users: UserRow[]): RoleFunnel {
  const inRole = users.filter(u => u.role === role)
  const steps = STEP_ORDER[role]

  // Started = entered wizard (real users, not backfilled).
  const started = inRole.filter(u => {
    const s = u.onboarding_state
    return !!s?.started_at && !s.backfilled
  })

  const completed = started.filter(u => u.onboarding_state?.completed === true)

  // Per-step count: users who reached at least step index N OR completed.
  const per_step = steps.map((_, idx) => {
    return started.filter(u => {
      const s = u.onboarding_state
      if (s?.completed) return true
      const uIdx = stepIndex(role, s?.step)
      return uIdx >= idx
    }).length
  })

  // Time-to-complete (minutes).
  const completionTimes: number[] = completed
    .map(u => {
      const s = u.onboarding_state
      if (!s?.started_at || !s.completed_at) return null
      const ms = new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()
      return ms > 0 ? Math.round(ms / 60_000) : null
    })
    .filter((v): v is number => v !== null)

  const avg_time_minutes = completionTimes.length > 0
    ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
    : null
  const sorted = [...completionTimes].sort((a, b) => a - b)
  const median_time_minutes = sorted.length > 0
    ? sorted[Math.floor(sorted.length / 2)]
    : null

  // Resume indicator: started >24h ago, not completed, step set (paused not abandoned).
  const dayMs = 24 * 3600 * 1000
  const resume_indicator = started.filter(u => {
    const s = u.onboarding_state
    if (!s?.started_at || s.completed) return false
    if (!s.step) return false
    return Date.now() - new Date(s.started_at).getTime() > dayMs
  }).length

  return {
    role,
    total_signups:         inRole.length,
    started:               started.length,
    per_step,
    completed:             completed.length,
    drop_rate:             started.length > 0 ? (started.length - completed.length) / started.length : 0,
    avg_time_minutes,
    median_time_minutes,
    resume_indicator,
  }
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function fmtTime(min: number | null): string {
  if (min === null) return '—'
  if (min < 60) return `${min} мин`
  const hours = Math.floor(min / 60)
  const rest = min % 60
  return `${hours}ч ${rest}м`
}

export default async function OnboardingFunnelPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me || me.role !== 'admin') redirect('/dashboard')

  // Pull only the roles that have a wizard. Admin role excluded — no wizard.
  const { data: usersRaw } = await supabase
    .from('users')
    .select('id, role, created_at, onboarding_state')
    .in('role', ['athlete', 'coach', 'organization', 'doctor'])
    .limit(5000)   // safety cap; for >5000 users move to RPC aggregator

  const users = (usersRaw ?? []) as UserRow[]

  const funnels: RoleFunnel[] = (['athlete', 'coach', 'organization', 'doctor'] as WizardRole[])
    .map(role => computeFunnel(role, users))

  const totalStarted   = funnels.reduce((a, f) => a + f.started, 0)
  const totalCompleted = funnels.reduce((a, f) => a + f.completed, 0)
  const overallCvr     = totalStarted > 0 ? totalCompleted / totalStarted : 0

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(249,115,22,0.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(124,58,237,0.10),_transparent_28%)]" />
        <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                Activation · Sprint W7 Day 36
              </span>
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-700">
                4 wizards · derived from onboarding_state
              </span>
            </div>
            <h1 className="pf-num text-[clamp(2rem,3.5vw,3.2rem)] leading-[0.95] tracking-tight text-foreground">
              Onboarding funnel
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">
              Где пользователи отваливаются между signup и completion. Backfilled legacy users исключены —
              видим только тех, кто реально открывал wizard. Resume indicator показывает «зашёл и пропал ≥24h».
            </p>
          </div>
          <Link href="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground self-start">
            ← Админка
          </Link>
        </div>
      </section>

      {/* Totals row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label="Started wizards"  value={totalStarted.toString()}   hint="Across all 4 roles" />
        <KpiTile label="Completed"        value={totalCompleted.toString()} hint={fmtPct(overallCvr) + ' CVR'} />
        <KpiTile label="Currently paused" value={funnels.reduce((a, f) => a + f.resume_indicator, 0).toString()}
                 hint=">24h since started, no completion" />
      </section>

      {/* Per-role funnels */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {funnels.map(f => {
          const meta = ROLE_META[f.role]
          const steps = STEP_ORDER[f.role]
          const peak = f.per_step[0] || 1
          return (
            <div key={f.role}
              className="rounded-[26px] border bg-card p-6 shadow-sm"
              style={{ borderColor: meta.border }}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="text-2xs font-bold uppercase tracking-[0.2em]" style={{ color: meta.accent }}>
                    {meta.label}
                  </div>
                  <h2 className="mt-1 text-xl font-bold text-foreground">
                    {f.started} started · {f.completed} completed
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {f.total_signups} total signups · drop {fmtPct(f.drop_rate)}
                  </p>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: meta.bg, color: meta.accent, border: `1px solid ${meta.border}` }}>
                  CVR {f.started > 0 ? fmtPct(f.completed / f.started) : '—'}
                </span>
              </div>

              {/* Funnel bars */}
              <div className="space-y-2">
                {steps.map((stepKey, idx) => {
                  const count = f.per_step[idx]
                  const pct = peak > 0 ? (count / peak) * 100 : 0
                  return (
                    <div key={stepKey}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-foreground">
                          {idx + 1}. {stepKey}
                        </span>
                        <span className="pf-num text-muted-foreground">
                          {count} <span className="text-[10px]">({peak > 0 ? Math.round((count / peak) * 100) : 0}%)</span>
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: meta.accent }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 mt-1 border-t border-border">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-foreground">✓ Completed</span>
                    <span className="pf-num font-bold" style={{ color: meta.accent }}>
                      {f.completed}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${peak > 0 ? (f.completed / peak) * 100 : 0}%`, background: meta.accent, opacity: 0.7 }} />
                  </div>
                </div>
              </div>

              {/* Stats footer */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="avg" value={fmtTime(f.avg_time_minutes)} />
                <Stat label="median" value={fmtTime(f.median_time_minutes)} />
                <Stat label="paused" value={f.resume_indicator.toString()} />
              </div>
            </div>
          )
        })}
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-[11px] text-muted-foreground">
        Funnel выведен из <code className="rounded bg-muted px-1 py-0.5">users.onboarding_state</code> JSONB
        (W6 Migration 066). Backfilled legacy users (Migration 068) исключены — видим реальный funnel
        только тех кто открывал wizard. Step-level event log можно добавить отдельной миграцией если
        нужна point-in-time analytics (когда именно user закрыл tab).
      </div>
    </div>
  )
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="pf-num mt-2 text-3xl leading-tight text-foreground">{value}</div>
      <div className="mt-2 text-2xs text-muted-foreground">{hint}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="pf-num text-sm font-bold text-foreground mt-0.5">{value}</div>
    </div>
  )
}
