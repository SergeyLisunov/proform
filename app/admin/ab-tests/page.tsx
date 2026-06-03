/**
 * /admin/ab-tests — Sprint W6 Day 32 (PR #50).
 *
 * Read-only analytics surface for the drip-email A/B test. Aggregates
 * tool_leads by (source, ab_variant) and reports:
 *   - leads      — count of inserts
 *   - dispatched — emails actually sent (email_dispatched_at NOT NULL)
 *   - converted  — signed-up via /auth/register (converted_at NOT NULL
 *                  OR user_id NOT NULL — both are set by handle_new_auth_user)
 *   - cvr        — converted / leads ratio (signup conversion)
 *   - dispatch_cvr — converted / dispatched (drip → signup conversion)
 *
 * Variant assignment is 50/50 random at insert (see app/api/tools/lead).
 * Subject diff is the only A/B variable; body identical.
 *
 * Auth: admin role required (server redirect).
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/metronic'
import { pooledZTest } from '@/lib/stats/ztest'

export const dynamic = 'force-dynamic'

type Source = 'team-risk' | 'adaptive-plan' | 'club-audit' | 'medical-summary'
type Variant = 'a' | 'b'

const SOURCE_LABELS: Record<Source, string> = {
  'team-risk':       'Team Risk Snapshot',
  'adaptive-plan':   'Adaptive Plan',
  'club-audit':      'Club Audit',
  'medical-summary': 'Medical Summary',
}

interface LeadRow {
  source:               string
  payload:              { ab_variant?: string } | null
  email_dispatched_at:  string | null
  converted_at:         string | null
  user_id:              string | null
  // W13 Day 66: touch-level funnel breakdown
  dispatched_touches:   number | null
}

interface Cell {
  leads:        number
  dispatched:   number
  converted:    number
  // W13 Day 66: per-touch counts (0=fresh, 1/2/3 — after each touch)
  touches:      [number, number, number, number]
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function tone(cvr: number): { bg: string; color: string } {
  if (cvr >= 0.15) return { bg: '#F0FDF4', color: '#15803D' }
  if (cvr >= 0.05) return { bg: '#FFF7ED', color: '#C2410C' }
  return { bg: '#FEF2F2', color: '#B91C1C' }
}

// W15 Day 77: pooledZTest extracted to `lib/stats/ztest.ts` for shared
// reuse (also consumed by `/admin/landing-ab`). Math + thresholds identical
// (two-proportion pooled, normal approx via Abramowitz & Stegun, 30-per-
// group hard floor для validity).

export default async function AbTestsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .single()
  if (!me || me.role !== 'admin') redirect('/dashboard')

  const { data: leadsRaw } = await supabase
    .from('tool_leads')
    .select('source, payload, email_dispatched_at, converted_at, user_id, dispatched_touches')
    .in('source', ['team-risk', 'adaptive-plan', 'club-audit', 'medical-summary'])
  const leads = (leadsRaw ?? []) as LeadRow[]

  // Build (source, variant) → Cell map.
  const grid = new Map<string, Cell>()
  const ensureKey = (source: Source, variant: Variant): Cell => {
    const k = `${source}/${variant}`
    let c = grid.get(k)
    if (!c) c = { leads: 0, dispatched: 0, converted: 0, touches: [0, 0, 0, 0] }
    grid.set(k, c)
    return c
  }

  for (const l of leads) {
    const source = l.source as Source
    const rawV = l.payload?.ab_variant
    const variant: Variant = rawV === 'b' ? 'b' : 'a'   // default to 'a' if missing/legacy
    const cell = ensureKey(source, variant)
    cell.leads++
    if (l.email_dispatched_at) cell.dispatched++
    if (l.converted_at || l.user_id) cell.converted++
    // W13 Day 66: bucket by touch level (0/1/2/3)
    const t = Math.min(3, Math.max(0, l.dispatched_touches ?? 0))
    cell.touches[t]++
  }

  const sources: Source[] = ['team-risk', 'adaptive-plan', 'club-audit', 'medical-summary']
  // Compute totals + winner per source.
  type SourceSummary = {
    source: Source
    a: Cell
    b: Cell
    lift: number   // ((b_cvr - a_cvr) / a_cvr) — positive = B wins
    sampleSize: number
  }
  const summaries: SourceSummary[] = sources.map(source => {
    const a = grid.get(`${source}/a`) ?? { leads: 0, dispatched: 0, converted: 0, touches: [0, 0, 0, 0] as [number, number, number, number] }
    const b = grid.get(`${source}/b`) ?? { leads: 0, dispatched: 0, converted: 0, touches: [0, 0, 0, 0] as [number, number, number, number] }
    const aCvr = a.leads > 0 ? a.converted / a.leads : 0
    const bCvr = b.leads > 0 ? b.converted / b.leads : 0
    const lift = aCvr > 0 ? (bCvr - aCvr) / aCvr : 0
    return { source, a, b, lift, sampleSize: a.leads + b.leads }
  })

  // W13 Day 66: Per-source statistical significance (Z-test) + winner verdict.
  // Used to flip «inconclusive» → «winner detected» chip in the table below.
  const verdicts = summaries.map(s => {
    const ztest = pooledZTest(s.a.converted, s.a.leads, s.b.converted, s.b.leads)
    let label: 'a_wins' | 'b_wins' | 'inconclusive' | 'too_small' = 'inconclusive'
    if (s.sampleSize < 100) label = 'too_small'
    else if (ztest.isSignificant) label = s.lift > 0 ? 'b_wins' : 'a_wins'
    return { source: s.source, ztest, label }
  })
  const verdictMap = new Map(verdicts.map(v => [v.source, v]))

  const totalLeads      = leads.length
  const totalDispatched = leads.filter(l => l.email_dispatched_at).length
  const totalConverted  = leads.filter(l => l.converted_at || l.user_id).length
  const overallCvr      = totalLeads > 0 ? totalConverted / totalLeads : 0

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.10),_transparent_28%)]" />
        <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-700">
                A/B test · Sprint W6 Day 32
              </span>
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                Drip subject A vs B
              </span>
            </div>
            <h1 className="pf-num text-[clamp(2rem,3.5vw,3.2rem)] leading-[0.95] tracking-tight text-navy-500">
              Drip template A/B test
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">
              Variant A — declarative subjects (existing). Variant B — question-form subjects. Body identical;
              subject is the only A/B variable. Conversion = signup (converted_at OR user_id NOT NULL).
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
        <KpiTile label="Всего лидов"      value={totalLeads.toString()}      hint="4 источника"        />
        <KpiTile label="Отправлено email"  value={totalDispatched.toString()} hint={`${totalDispatched > 0 ? Math.round((totalDispatched/Math.max(1,totalLeads))*100) : 0}% leads`} />
        <KpiTile label="Конвертировано"    value={totalConverted.toString()}  hint={fmtPct(overallCvr)} tone={tone(overallCvr)} />
      </section>

      {/* Per-source A vs B table */}
      <Card className="p-6">
        <div className="mb-4">
          <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Per-source</div>
          <h2 className="mt-1 text-lg font-semibold text-navy-500">Conversion: variant A vs B</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lift = (B.cvr − A.cvr) / A.cvr. Sample size {'<'}30 на вариант — результат пока статистически слабый.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-2xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Источник</th>
                <th className="py-2 pr-3">A · leads</th>
                <th className="py-2 pr-3">A · cvr</th>
                <th className="py-2 pr-3">B · leads</th>
                <th className="py-2 pr-3">B · cvr</th>
                <th className="py-2 pr-3">Lift</th>
                <th className="py-2 pr-3">Sample</th>
                <th className="py-2 pr-3">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map(s => {
                const aCvr = s.a.leads > 0 ? s.a.converted / s.a.leads : 0
                const bCvr = s.b.leads > 0 ? s.b.converted / s.b.leads : 0
                const liftTone = s.lift > 0.05 ? '#15803D' : s.lift < -0.05 ? '#B91C1C' : '#64748B'
                const insufficient = s.sampleSize < 30
                return (
                  <tr key={s.source} className="border-b border-border last:border-0">
                    <td className="py-3 pr-3 font-semibold text-foreground">{SOURCE_LABELS[s.source]}</td>
                    <td className="py-3 pr-3 pf-num text-muted-foreground">{s.a.leads}</td>
                    <td className="py-3 pr-3 pf-num" style={{ color: tone(aCvr).color }}>{fmtPct(aCvr)}</td>
                    <td className="py-3 pr-3 pf-num text-muted-foreground">{s.b.leads}</td>
                    <td className="py-3 pr-3 pf-num" style={{ color: tone(bCvr).color }}>{fmtPct(bCvr)}</td>
                    <td className="py-3 pr-3 pf-num font-semibold" style={{ color: liftTone }}>
                      {s.sampleSize === 0 ? '—' : `${s.lift > 0 ? '+' : ''}${(s.lift * 100).toFixed(1)}%`}
                    </td>
                    <td className="py-3 pr-3 pf-num text-xs">
                      <span className={`rounded-full px-2 py-0.5 ${insufficient ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {s.sampleSize}{insufficient ? ' ⚠' : ' ✓'}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-xs">
                      {(() => {
                        const v = verdictMap.get(s.source)
                        if (!v) return <span className="text-muted-foreground">—</span>
                        if (v.label === 'too_small') {
                          return <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5">Need 100+</span>
                        }
                        if (v.label === 'a_wins') {
                          return <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5" title={`p=${v.ztest.pValue.toFixed(3)}, z=${v.ztest.z.toFixed(2)}`}>A wins ✓</span>
                        }
                        if (v.label === 'b_wins') {
                          return <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5" title={`p=${v.ztest.pValue.toFixed(3)}, z=${v.ztest.z.toFixed(2)}`}>B wins ✓</span>
                        }
                        return <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5" title={`p=${v.ztest.pValue.toFixed(3)}, not significant`}>Inconclusive</span>
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* W13 Day 66: Touch funnel — drip cadence (W7 Day 35) breakdown per variant */}
      <Card className="p-6">
        <div className="mb-4">
          <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">3-touch drip funnel</div>
          <h2 className="mt-1 text-lg font-semibold text-navy-500">Где конвертируются — после какого touch</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Funnel показывает сколько leads застряли на каждом touch level. Touch 0 = ещё не отправляли (fresh); 1/2/3 = после первого/второго/третьего email. Big drop с touch 1 → touch 2 значит cadence работает (или leads разрешились).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-2xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Источник</th>
                <th className="py-2 pr-3">Variant</th>
                <th className="py-2 pr-3">T0 fresh</th>
                <th className="py-2 pr-3">T1</th>
                <th className="py-2 pr-3">T2</th>
                <th className="py-2 pr-3">T3 final</th>
                <th className="py-2 pr-3">Reached T3</th>
              </tr>
            </thead>
            <tbody>
              {summaries.flatMap(s => ['a', 'b'].map(variant => {
                const cell = variant === 'a' ? s.a : s.b
                const t = cell.touches
                const reachedT3pct = cell.leads > 0 ? (t[3] / cell.leads) * 100 : 0
                return (
                  <tr key={`${s.source}/${variant}`} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-semibold text-foreground">{variant === 'a' ? SOURCE_LABELS[s.source] : ''}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${variant === 'a' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                        {variant.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-3 pf-num text-muted-foreground">{t[0]}</td>
                    <td className="py-2 pr-3 pf-num text-muted-foreground">{t[1]}</td>
                    <td className="py-2 pr-3 pf-num text-muted-foreground">{t[2]}</td>
                    <td className="py-2 pr-3 pf-num text-muted-foreground">{t[3]}</td>
                    <td className="py-2 pr-3 pf-num text-xs">
                      {cell.leads > 0
                        ? <span className="text-foreground">{t[3]} <span className="text-muted-foreground">({reachedT3pct.toFixed(1)}%)</span></span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                )
              }))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-[11px] text-muted-foreground">
        Чтобы пополнить выборку, направляйте трафик на инструменты с UTM-меткой, или ждите естественной конверсии.
        Sample {'<'}30 на вариант — результат не достоверен; ориентируйтесь на 100+ leads per variant before declaring winner.
      </div>
    </div>
  )
}

function KpiTile({ label, value, hint, tone: t }: { label: string; value: string; hint: string; tone?: { bg: string; color: string } }) {
  return (
    <Card className="p-5">
      <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="pf-num mt-2 text-3xl leading-tight" style={t ? { color: t.color } : { color: 'inherit' }}>{value}</div>
      <div className="mt-2 text-2xs text-muted-foreground">{hint}</div>
    </Card>
  )
}
