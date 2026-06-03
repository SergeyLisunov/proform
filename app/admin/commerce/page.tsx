import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

export const dynamic = 'force-dynamic'

// Nominal monthly price per plan (used as MRR proxy when ЮKassa tariffs are
// not synced into the DB). Override via env if needed.
const PLAN_PRICE_MONTH: Record<'free' | 'pro' | 'team', number> = {
  free: 0,
  pro:  Number(process.env.ADMIN_PRICE_PRO  ?? 990),
  team: Number(process.env.ADMIN_PRICE_TEAM ?? 2990),
}

type Plan = keyof typeof PLAN_PRICE_MONTH

function fmtMoney(v: number, currency = 'RUB') {
  try {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  } catch {
    return `${v} ${currency}`
  }
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default async function AdminCommercePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', authUser.id)
    .single()
  if (!me || me.role !== 'admin') redirect('/dashboard')

  // ── Snapshot queries (all in parallel) ───────────────────────────────────
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

  const [
    subsRes,
    canceledRes,
    totalSubsRes,
    recentPaymentsRes,
    recentInvoicesRes,
    ordersPaidRes,
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, cancel_at_period_end'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', ['canceled', 'unpaid'])
      .gte('updated_at', thirtyDaysAgo),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('payments')
      .select('id, user_id, amount, currency, status, created_at, order_id')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('invoices')
      .select('id, amount, currency, status, number, created_at, hosted_invoice_url')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('coach_orders')
      .select('price_amount, currency')
      .eq('status', 'paid')
      .gte('paid_at', thirtyDaysAgo),
  ])

  const subs = (subsRes.data ?? []) as { plan: Plan; status: string; current_period_end: string | null; cancel_at_period_end: boolean | null }[]

  // Plan distribution (active + trialing = "paying")
  const paying = subs.filter(s => s.status === 'active' || s.status === 'trialing')
  const byPlan: Record<Plan, number> = { free: 0, pro: 0, team: 0 }
  for (const s of paying) byPlan[s.plan] = (byPlan[s.plan] ?? 0) + 1

  // MRR proxy: count of paying subs × plan price
  const mrr = (Object.keys(byPlan) as Plan[]).reduce(
    (sum, p) => sum + (byPlan[p] ?? 0) * (PLAN_PRICE_MONTH[p] ?? 0),
    0,
  )

  // Churn: (canceled in window) / (total subs, non-zero)
  const canceled30 = canceledRes.count ?? 0
  const totalSubs  = totalSubsRes.count ?? 0
  const churnRate  = totalSubs > 0 ? canceled30 / totalSubs : 0

  // Coach-service revenue (last 30 days, summed per currency)
  const oneOffByCurrency: Record<string, number> = {}
  for (const o of ordersPaidRes.data ?? []) {
    const c = (o.currency ?? 'RUB').toUpperCase()
    oneOffByCurrency[c] = (oneOffByCurrency[c] ?? 0) + (o.price_amount ?? 0)
  }

  const payments = recentPaymentsRes.data ?? []
  const invoices = recentInvoicesRes.data ?? []

  // Upcoming cancellations (cancel_at_period_end = true, active)
  const upcomingCancel = subs.filter(s => s.cancel_at_period_end && s.status === 'active').length

  const kpis = [
    {
      label: 'MRR (прогноз)',
      value: fmtMoney(mrr, 'RUB'),
      hint: `${paying.length} платящих подписок`,
      tone: 'orange',
      icon: 'ki-chart-line-up',
    },
    {
      label: 'Pro / Team',
      value: `${byPlan.pro} / ${byPlan.team}`,
      hint: `Free: ${byPlan.free}`,
      tone: 'violet',
      icon: 'ki-people',
    },
    {
      label: 'Churn (30д)',
      value: fmtPct(churnRate),
      hint: `${canceled30} отмен из ${totalSubs}`,
      tone: canceled30 > 0 ? 'red' : 'green',
      icon: 'ki-arrow-down',
    },
    {
      label: 'Разовые услуги (30д)',
      value: Object.entries(oneOffByCurrency).map(([c, v]) => fmtMoney(v, c)).join(' · ') || '—',
      hint: `${(ordersPaidRes.data ?? []).length} заказов`,
      tone: 'green',
      icon: 'ki-wallet',
    },
  ]

  const TONE: Record<string, { bg: string; color: string; border: string }> = {
    orange: { bg: '#FFF7ED', color: '#F97316', border: '#FED7AA' },
    violet: { bg: '#FAF5FF', color: '#9333EA', border: '#E9D5FF' },
    red:    { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
    green:  { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
    blue:   { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(22,163,74,0.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.10),_transparent_28%)]" />
        <div className="relative flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-700">
                Коммерция
              </span>
              <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-green-700">
                Подписки · ЮKassa
              </span>
            </div>
            <h1 className="pf-num text-[clamp(2rem,3.5vw,3.2rem)] leading-[0.95] tracking-tight text-foreground">
              Коммерческая панель
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground">
              MRR, churn, распределение тарифов и последние платежи. Данные обновляются в реальном времени по ЮKassa-вебхукам.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              ← Админка
            </Link>
            <Link
              href="https://yookassa.ru/my"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] px-3.5 py-2 text-xs font-semibold text-white shadow-sm"
            >
              ЮKassa Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* KPI tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(k => {
          const tone = TONE[k.tone] ?? TONE.orange
          return (
            <div
              key={k.label}
              className="rounded-2xl border bg-card p-5 shadow-sm"
              style={{ borderColor: tone.border }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{k.label}</div>
                  <div className="pf-num mt-2 text-2xl leading-tight text-foreground">{k.value}</div>
                  <div className="mt-2 text-2xs text-muted-foreground">{k.hint}</div>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: tone.bg }}
                >
                  <i className={`ki-filled ${k.icon} text-base`} style={{ color: tone.color }} />
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* Plan distribution */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Подписки</div>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Распределение по тарифам</h2>
          </div>
          {upcomingCancel > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              <i className="ki-filled ki-information-2" />
              {upcomingCancel} отменяются в конце периода
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['free', 'pro', 'team'] as Plan[]).map(p => {
            const count = byPlan[p] ?? 0
            const total = paying.length + byPlan.free
            const pct = total > 0 ? count / total : 0
            const toneKey = p === 'team' ? 'violet' : p === 'pro' ? 'orange' : 'blue'
            const tone = TONE[toneKey]
            return (
              <div key={p} className="rounded-2xl border bg-background p-4" style={{ borderColor: tone.border }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: tone.color }}>
                    {p.toUpperCase()}
                  </div>
                  <div className="text-2xs text-muted-foreground">
                    {PLAN_PRICE_MONTH[p] ? `${fmtMoney(PLAN_PRICE_MONTH[p])}/мес` : 'бесплатно'}
                  </div>
                </div>
                <div className="pf-num mt-2 text-3xl text-foreground">{count}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round(pct * 100)}%`, background: tone.color }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{Math.round(pct * 100)}% от всех</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Plan distribution chart — derived from byPlan counts already in scope */}
      {(byPlan.free + byPlan.pro + byPlan.team) > 0 && (
        <ChartCard title="Доли тарифов" subtitle="Free / Pro / Team — активные подписки">
          <ApexChart
            type="donut"
            height={260}
            width="100%"
            series={[byPlan.free, byPlan.pro, byPlan.team]}
            options={{
              labels: ['Free', 'Pro', 'Team'],
              colors: ['#2563EB', '#F97316', '#9333EA'],
              chart: { toolbar: { show: false }, animations: { enabled: true, speed: 600 } },
              dataLabels: { enabled: false },
              legend: { position: 'bottom' as const, fontSize: '11px', offsetY: 4 },
              plotOptions: { pie: { donut: { size: '65%', labels: { show: true, total: { show: true, label: 'Подписки', fontSize: '11px', color: '#64748B' } } } } },
              tooltip: { theme: 'light' },
            }}
          />
        </ChartCard>
      )}

      {/* Recent payments + invoices */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Платежи</div>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Последние транзакции</h2>
            </div>
            <span className="text-2xs text-muted-foreground">{payments.length}</span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {payments.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Платежей пока нет</div>
            )}
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="pf-num text-sm font-semibold text-foreground">
                    {fmtMoney(p.amount ?? 0, p.currency ?? 'RUB')}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtDate(p.created_at)} · {p.status}
                  </div>
                </div>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={
                    p.status === 'succeeded'
                      ? { background: TONE.green.bg, color: TONE.green.color, border: `1px solid ${TONE.green.border}` }
                      : { background: TONE.red.bg, color: TONE.red.color, border: `1px solid ${TONE.red.border}` }
                  }
                >
                  {p.status === 'succeeded' ? 'Успех' : 'Ошибка'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Счета</div>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Последние инвойсы</h2>
            </div>
            <span className="text-2xs text-muted-foreground">{invoices.length}</span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {invoices.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">Инвойсов пока нет</div>
            )}
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="pf-num text-sm font-semibold text-foreground">
                    {fmtMoney(inv.amount ?? 0, inv.currency ?? 'RUB')}
                    {inv.number && <span className="ml-2 text-2xs text-muted-foreground">#{inv.number}</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{fmtDate(inv.created_at)} · {inv.status}</div>
                </div>
                {inv.hosted_invoice_url ? (
                  <a
                    href={inv.hosted_invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Открыть →
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-[11px] text-muted-foreground">
        MRR — прогнозный, рассчитан как число активных подписок × номинальная цена тарифа. Настройте цены через переменные окружения <code className="rounded bg-muted px-1 py-0.5">ADMIN_PRICE_PRO</code> и <code className="rounded bg-muted px-1 py-0.5">ADMIN_PRICE_TEAM</code>, либо синхронизируйте ЮKassa-тарифы в БД через таблицу <code className="rounded bg-muted px-1 py-0.5">tariffs</code>.
      </div>
    </div>
  )
}
