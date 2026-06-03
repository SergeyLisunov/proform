/**
 * /admin/leads — Sprint W4 Day 22 (PR #38).
 *
 * Admin dashboard для tool_leads:
 *   - Funnel stats per source (total / dispatched / pending / failed)
 *   - Filterable leads table (by source, by dispatched status)
 *   - Manual trigger для cron via "Run digest now" button (calls
 *     /api/cron/leads-digest с CRON_SECRET — admin-only access)
 *
 * Server component с RLS-aware auth check:
 *   - Если auth user отсутствует → redirect /auth/login
 *   - Если users.role !== 'admin' → 403
 *   - Иначе — fetch и render через service (admin client)
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, Alert } from '@/components/ui/metronic'
import {
  listLeadsWithUserInfo,
  getFunnelStats,
  getConversionFunnel,
  type LeadSource,
} from '@/services/admin-leads.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SOURCE_META: Record<LeadSource, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  acwr:              { label: 'ACWR',           emoji: '📊', color: '#A16207', bg: '#FEFCE8', border: '#FDE68A' },
  overtraining:      { label: 'Overtraining',   emoji: '🥵', color: '#9A3412', bg: '#FFF7ED', border: '#FED7AA' },
  templates:         { label: 'Templates',      emoji: '📋', color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' },
  'team-risk':       { label: 'Team Risk',      emoji: '🟠', color: '#D44A02', bg: '#FFF7ED', border: '#FED7AA' },
  'adaptive-plan':   { label: '7-day Plan',     emoji: '🔵', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  'club-audit':      { label: 'Club Audit',     emoji: '🟢', color: '#0F766E', bg: '#F0FDFA', border: '#99F6E4' },
  'medical-summary': { label: 'Medical Summary', emoji: '🟣', color: '#7C3AED', bg: '#FAF5FF', border: '#E9D5FF' },
  // W16 Day 79 — high-trust landing form (HeroAuditModal + LeadCaptureForm).
  // Distinct brand-orange color separates visually from tool-calculator leads.
  'landing-audit-form': { label: 'Landing Audit', emoji: '🎯', color: '#C2410C', bg: '#FFEDD5', border: '#FDBA74' },
  other:             { label: 'Other',          emoji: '⭐', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
}

interface SearchParams {
  source?:     LeadSource
  dispatched?: 'all' | 'pending' | 'dispatched'
  page?:       string
}

export default async function AdminLeadsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  // ── Auth gate ─────────────────────────────────────────────────────
  const sb = await createClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth?.user) redirect('/auth/login?next=/admin/leads')

  const { data: me } = await sb
    .from('users')
    .select('id, role, name')
    .eq('auth_id', auth.user.id)
    .maybeSingle()

  const meRow = me as { id: string; role: string | null; name: string | null } | null
  if (!meRow || meRow.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Alert variant="destructive" icon="ki-shield-cross" title="Access denied">
          <p>Только пользователи с ролью <code>admin</code> могут видеть эту страницу.</p>
          <Link href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-sm font-bold no-underline">
            ← На главную
          </Link>
        </Alert>
      </div>
    )
  }

  // ── Resolve filters ───────────────────────────────────────────────
  const sp = (await (searchParams ?? Promise.resolve({}))) as SearchParams
  const filterSource     = sp.source
  const filterDispatched = sp.dispatched ?? 'all'
  const page             = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const limit            = 50
  const offset           = (page - 1) * limit

  // ── Fetch data ────────────────────────────────────────────────────
  const [stats, conversion, leads] = await Promise.all([
    getFunnelStats(),
    getConversionFunnel(),
    listLeadsWithUserInfo({ source: filterSource, dispatched: filterDispatched, limit, offset }),
  ])

  const totalLeads      = stats.reduce((acc, s) => acc + s.total, 0)
  const totalDispatched = stats.reduce((acc, s) => acc + s.dispatched, 0)
  const totalPending    = stats.reduce((acc, s) => acc + s.pending, 0)
  const totalFailed     = stats.reduce((acc, s) => acc + s.failed, 0)
  const totalConverted  = conversion.reduce((acc, c) => acc + c.converted_to_users, 0)
  const totalPaid       = conversion.reduce((acc, c) => acc + c.converted_to_paid, 0)
  const overallConvPct  = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 1000) / 10 : 0

  // Index conversion stats by source for funnel table merge
  const convBySource = new Map<LeadSource, typeof conversion[0]>()
  for (const c of conversion) convBySource.set(c.source, c)

  const totalPages = Math.max(1, Math.ceil(leads.total / limit))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-1">Admin · Leads</p>
          <h1 className="text-3xl font-bold text-navy-500">Lead capture analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            Все captured leads из W1+W4 lead-magnets. Drip emails отправляются еженедельно cron'ом /api/cron/leads-digest.
          </p>
        </div>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          На главную
        </Link>
      </div>

      {/* Top counters */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <CounterTile label="Всего leads"             value={totalLeads}      color="#0F172A" />
        <CounterTile label="Email отправлено"        value={totalDispatched} color="#15803D" />
        <CounterTile label="Pending"                 value={totalPending}    color="#0891B2" />
        <CounterTile label="Failed (3+ attempts)"    value={totalFailed}     color="#B91C1C" />
        <CounterTile label="Converted → users"       value={totalConverted}  color="#7C3AED" subtitle={`${overallConvPct}% conv. rate`} />
        <CounterTile label="Converted → paid"        value={totalPaid}       color="#D44A02" />
      </div>

      {/* Funnel by source */}
      <Card className="p-5">
        <h2 className="text-base font-bold text-navy-500 mb-3">Funnel по source</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Dispatched</th>
                <th className="pb-2 pr-4 text-right">Converted</th>
                <th className="pb-2 pr-4 text-right">Paid</th>
                <th className="pb-2 pr-4 text-right">Conv. rate</th>
                <th className="pb-2 pr-4 text-right">Failed</th>
                <th className="pb-2">Last lead</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => {
                const meta = SOURCE_META[s.source]
                const conv = convBySource.get(s.source)
                const converted    = conv?.converted_to_users ?? 0
                const paid         = conv?.converted_to_paid ?? 0
                const convRatePct  = conv?.conversion_rate_percent ?? 0
                return (
                  <tr key={s.source} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                        {meta.emoji} {meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-bold text-foreground">{s.total}</td>
                    <td className="py-2.5 pr-4 text-right text-emerald-700 font-semibold">{s.dispatched}</td>
                    <td className="py-2.5 pr-4 text-right text-violet-700 font-semibold">{converted}</td>
                    <td className="py-2.5 pr-4 text-right text-orange-700 font-semibold">{paid}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{convRatePct}%</td>
                    <td className="py-2.5 pr-4 text-right text-red-700">{s.failed}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {s.most_recent_at ? new Date(s.most_recent_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                )
              })}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    Пока нет leads. Откройте /tools/team-risk и заполните пример → появится первая запись.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-5">
        <h2 className="text-base font-bold text-navy-500 mb-3">Список leads</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterChip href="/admin/leads"           label="Все sources"       active={!filterSource} />
          {(['team-risk','adaptive-plan','club-audit','medical-summary'] as LeadSource[]).map(s => (
            <FilterChip key={s}
              href={`/admin/leads?source=${s}${filterDispatched !== 'all' ? `&dispatched=${filterDispatched}` : ''}`}
              label={`${SOURCE_META[s].emoji} ${SOURCE_META[s].label}`}
              active={filterSource === s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {(['all','pending','dispatched'] as const).map(d => (
            <FilterChip key={d}
              href={`/admin/leads?${filterSource ? `source=${filterSource}&` : ''}dispatched=${d}`}
              label={d === 'all' ? 'Все статусы' : d === 'pending' ? 'Pending' : 'Dispatched'}
              active={filterDispatched === d} />
          ))}
        </div>

        {leads.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            По текущим фильтрам leads нет.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-3">Email</th>
                    <th className="pb-2 pr-3">Source</th>
                    <th className="pb-2 pr-3">Captured</th>
                    <th className="pb-2 pr-3">Dispatched</th>
                    <th className="pb-2 pr-3">Converted</th>
                    <th className="pb-2 pr-3 text-right">Attempts</th>
                    <th className="pb-2">Payload meta</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.rows.map(r => {
                    const meta = SOURCE_META[r.source]
                    const payloadKeys = r.payload ? Object.keys(r.payload).slice(0, 3).join(', ') : '—'
                    return (
                      <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-accent/30">
                        <td className="py-2 pr-3 text-foreground font-mono text-xs truncate max-w-[200px]">{r.email}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                            style={{ background: meta.bg, color: meta.color }}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {r.email_dispatched_at ? (
                            <span className="text-emerald-700 font-semibold">
                              ✅ {new Date(r.email_dispatched_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </span>
                          ) : r.email_attempts >= 3 ? (
                            <span className="text-red-700">❌ Failed</span>
                          ) : (
                            <span className="text-cyan-700">⏳ Pending</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs">
                          {r.converted_at ? (
                            <span className="text-violet-700 font-semibold" title={r.user_name ? `${r.user_name} (${r.user_role ?? 'user'})` : 'Signup detected'}>
                              🎯 {r.user_role ? r.user_role.slice(0, 3).toUpperCase() : 'USR'} · {new Date(r.converted_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right text-xs text-muted-foreground">{r.email_attempts}</td>
                        <td className="py-2 text-xs text-muted-foreground font-mono truncate max-w-[260px]">{payloadKeys}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 mt-4">
                <span className="text-xs text-muted-foreground">Страница {page} из {totalPages} · всего {leads.total}</span>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={buildPageHref(page - 1, filterSource, filterDispatched)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted no-underline">
                      ← Назад
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link href={buildPageHref(page + 1, filterSource, filterDispatched)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:bg-muted no-underline">
                      Вперёд →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Cron info */}
      <Alert variant="info" title="⚙️ Auto-drip cron">
        <p className="leading-relaxed">
          <code>GET /api/cron/leads-digest</code> запускается еженедельно (Monday 8am UTC) через Vercel cron.
          Обрабатывает до {50} pending leads за раз, отправляет drip emails по 4 W4 sources (team-risk / adaptive-plan / club-audit / medical-summary),
          marks email_dispatched_at. Failed leads retry до 3 раз. После 3 attempts помечаются как Failed и больше не отправляются.
        </p>
        <p className="mt-2">
          Manual trigger требует <code>CRON_SECRET</code> в Bearer header (только admin доступа).
        </p>
      </Alert>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

function CounterTile({ label, value, color, subtitle }: { label: string; value: number; color: string; subtitle?: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="pf-num text-2xl font-bold mt-1" style={{ color }}>{value}</div>
      {subtitle && (
        <div className="text-[10px] font-semibold mt-0.5" style={{ color }}>{subtitle}</div>
      )}
    </Card>
  )
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`rounded-full px-3 py-1 text-[11px] font-bold transition border no-underline ${
        active
          ? 'border-orange-300 bg-orange-50 text-orange-700'
          : 'border-border bg-background hover:border-orange-200 text-muted-foreground'
      }`}>
      {label}
    </Link>
  )
}

function buildPageHref(page: number, source: LeadSource | undefined, dispatched: string): string {
  const params = new URLSearchParams()
  if (source) params.set('source', source)
  if (dispatched !== 'all') params.set('dispatched', dispatched)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/admin/leads${qs ? '?' + qs : ''}`
}
