/**
 * /org/activity — Sprint W7 Day 37 (PR #55).
 *
 * Reverse-chronological feed of cross-cutting events для organization
 * users. Closes the "Org tier silent" gap — before this, org admins
 * had to navigate per-section to see what was happening.
 *
 * Server component. Pulls up to 50 events from the last 30 days via
 * services/org-activity.service.ts (aggregates 4 source tables).
 *
 * Auth: organization role required. Non-org users redirected to
 * /dashboard.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getRecentOrgActivity, type OrgEvent, type OrgEventType } from '@/services/org-activity.service'
import { ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

export const dynamic = 'force-dynamic'

const TYPE_META: Record<OrgEventType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  member_joined:          { label: 'Член команды',     icon: 'ki-users',        color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  inquiry_created:        { label: 'Запрос врачу',     icon: 'ki-message-question', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  inquiry_answered:       { label: 'Ответ врача',      icon: 'ki-check-circle',     color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  recommendation_issued:  { label: 'Рекомендация',     icon: 'ki-shield-cross',     color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

const TONE_RING: Record<NonNullable<OrgEvent['tone']>, string> = {
  info:     '#94A3B8',
  warning:  '#F59E0B',
  critical: '#DC2626',
  success:  '#10B981',
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60)    return `${sec}с назад`
  const min = Math.floor(sec / 60)
  if (min < 60)    return `${min} мин назад`
  const hr = Math.floor(min / 60)
  if (hr < 24)     return `${hr}ч назад`
  const days = Math.floor(hr / 24)
  if (days < 7)    return `${days} дн назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function shortName(name: string | null, id: string | null): string {
  if (name) return name
  if (id)   return id.slice(0, 8)
  return '—'
}

export default async function OrgActivityPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', authUser.id).single()
  if (!me || me.role !== 'organization') redirect('/dashboard')

  const events = await getRecentOrgActivity()

  // Counts per type (for filter chips header).
  const counts: Record<OrgEventType, number> = {
    member_joined:         0,
    inquiry_created:       0,
    inquiry_answered:      0,
    recommendation_issued: 0,
  }
  for (const e of events) counts[e.type]++

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 pf-enter">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(243,87,3,0.10),_transparent_28%)]" />
        <div className="relative flex flex-col gap-3 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="text-2xs font-bold uppercase tracking-[0.24em] text-blue-700 mb-1">Организация · Лента событий</p>
            <h1 className="pf-num text-[clamp(1.75rem,3vw,2.5rem)] leading-[0.95] tracking-tight text-navy-500">
              Activity feed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Кросс-секционная лента за последние 30 дней — присоединения, запросы врачу, ответы, рекомендации.
              До 50 событий, реверс-хронологически.
            </p>
          </div>
          <Link href="/org"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground self-start">
            ← К дашборду
          </Link>
        </div>
      </section>

      {/* Counts chips */}
      <section className="flex flex-wrap gap-1.5">
        {(Object.keys(counts) as OrgEventType[]).map(t => {
          const m = TYPE_META[t]
          return (
            <span key={t}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ background: m.bg, color: m.color, borderColor: m.border }}>
              <i className={`ki-filled ${m.icon}`} />
              {m.label} · <span className="pf-num">{counts[t]}</span>
            </span>
          )
        })}
      </section>

      {/* Type distribution */}
      {events.length > 0 && (
        <ChartCard title="Распределение событий" subtitle="За последние 30 дней по типу">
          <ApexChart
            type="donut"
            options={{
              chart: { toolbar: { show: false }, animations: { enabled: true, speed: 600 } },
              colors: (Object.keys(counts) as OrgEventType[]).map(t => TYPE_META[t].color),
              labels: (Object.keys(counts) as OrgEventType[]).map(t => TYPE_META[t].label),
              plotOptions: { pie: { donut: { size: '65%' } } },
              dataLabels: { enabled: false },
              legend: { position: 'bottom', fontSize: '11px', offsetY: 4 },
              tooltip: { theme: 'light' },
            }}
            series={(Object.keys(counts) as OrgEventType[]).map(t => counts[t])}
            height={260}
            width="100%"
          />
        </ChartCard>
      )}

      {/* Feed */}
      {events.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <i className="ki-filled ki-people text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-navy-500">Пока тихо</h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            События появятся когда атлет присоединится, тренер задаст вопрос врачу или врач выпустит рекомендацию.
            Пригласите первых атлетов на <Link href="/org/members" className="text-blue-600 font-semibold hover:underline">/org/members</Link>.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {events.map((e, idx) => {
            const m = TYPE_META[e.type]
            const ringColor = e.tone ? TONE_RING[e.tone] : '#CBD5E1'
            const isLast = idx === events.length - 1
            return (
              <li key={`${e.type}-${e.entity_id}`}
                className="relative flex gap-4 pl-1 pr-4 py-3">
                {/* Timeline rail */}
                {!isLast && (
                  <span className="absolute left-[26px] top-12 bottom-0 w-px bg-border" />
                )}
                {/* Icon */}
                <div className="relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: m.bg, border: `2px solid ${ringColor}`, color: m.color }}>
                  <i className={`ki-filled ${m.icon} text-lg`} />
                </div>
                {/* Body */}
                <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                          {m.label}
                        </span>
                        {e.tone && e.tone !== 'info' && (
                          <span className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: ringColor }}>
                            {e.tone === 'critical' ? 'critical' : e.tone === 'warning' ? 'warning' : 'ok'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">{e.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.actor_id && e.type !== 'member_joined' && (
                          <>
                            <strong className="text-foreground">{shortName(e.actor_name, e.actor_id)}</strong>
                            {e.target_id && e.target_id !== e.actor_id && <> · атлет: <strong className="text-foreground">{shortName(e.target_name, e.target_id)}</strong></>}
                          </>
                        )}
                        {e.type === 'member_joined' && e.target_id && (
                          <strong className="text-foreground">{shortName(e.target_name, e.target_id)}</strong>
                        )}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap pt-1">
                      {fmtRelative(e.timestamp)}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-[11px] text-muted-foreground">
        Aggregated from <code className="rounded bg-muted px-1 py-0.5">org_members</code>,
        <code className="rounded bg-muted px-1 py-0.5">doctor_inquiries</code>,
        <code className="rounded bg-muted px-1 py-0.5">recommendations</code>. Окно 30 дней, лимит 50.
        Pagination + email digest — W8 candidates.
      </div>
    </div>
  )
}
