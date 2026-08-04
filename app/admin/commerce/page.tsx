import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSubscriptionActive } from '@/lib/plans'
import { Card, ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

export const dynamic = 'force-dynamic'

/**
 * Терминальные статусы подписки для расчёта churn.
 *
 * Почему список именно такой: subscriptions_status_check (миграция 096)
 * допускает ТОЛЬКО active | trial | trialing | past_due | cancelled |
 * expired | blocked | manual_review, а cron продлений
 * (app/api/cron/billing-renewals) переводит подписку ровно в 'cancelled'
 * (шаг 3a) и 'expired' (шаг 3b). Раньше фильтр искал stripe-словарь
 * 'canceled'/'unpaid' — эти значения CHECK запрещает физически, поэтому
 * счётчик отмен возвращал 0 всегда, при любых данных, и churn показывал
 * ровный 0% даже после массового оттока. Наследие эпохи Stripe, чьи
 * колонки выпилила миграция 075.
 */
const CHURNED_STATUSES = ['cancelled', 'expired'] as const

// Nominal monthly price per plan (used as MRR proxy when ЮKassa tariffs are
// not synced into the DB). Override via env if needed.
const PLAN_PRICE_MONTH: Record<'free' | 'pro' | 'team', number> = {
  free: 0,
  pro:  Number(process.env.ADMIN_PRICE_PRO  ?? 990),
  team: Number(process.env.ADMIN_PRICE_TEAM ?? 2990),
}

type Plan = keyof typeof PLAN_PRICE_MONTH

// Формы строк billing-таблиц. Нужны потому, что createAdminClient() отдаёт
// нетипизированный SupabaseClient: без них ветка «service-ключа нет» и ветка
// с реальным запросом расходятся по типам, и пустой массив пришлось бы
// протаскивать как any.
type PaymentRow = {
  id: string
  amount: number | null
  currency: string | null
  status: string | null
  created_at: string | null
}
type InvoiceRow = {
  id: string
  amount: number | null
  currency: string | null
  status: string | null
  number: string | null
  created_at: string | null
  hosted_invoice_url: string | null
}
type CoachOrderRow = {
  price_amount: number | null
  currency: string | null
}

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

  // Почему для billing-таблиц отдельный клиент: у payments, invoices и
  // coach_orders в RLS есть только «свои строки» — payments_read_own,
  // invoices_read_own, coach_orders_read_party (миграция 047), admin-политики
  // SELECT у них нет вовсе (в отличие от subscriptions, где есть
  // «subscriptions: admin all»). Пользовательским клиентом админ видел
  // исключительно собственные платежи, то есть панель выручки была пуста
  // всегда — не «данных нет», а «данные скрыты от того, кому они нужны».
  //
  // Почему admin-клиент, а не новая RLS-политика: страница серверная (нет
  // 'use client', createClient берётся из lib/supabase/server), service-ключ
  // остаётся на сервере и в браузер не уходит. Проверка роли выполнена
  // СТРОГО выше — до первого запроса. Тот же приём уже применён в
  // app/parent/dashboard/page.tsx и в /api/org/newsletters/[id]/send.
  // Политика в БД открыла бы эти таблицы ещё и для чтения анонимным ключом
  // из браузера — лишняя поверхность ради экрана, который и так серверный.
  //
  // Почему вызов обёрнут, а не оставлен «как есть»: createAdminClient()
  // БРОСАЕТ, когда не задан SUPABASE_SERVICE_ROLE_KEY, и стоит он прямо в теле
  // серверного компонента — исключение отсюда роняет весь маршрут в HTTP 500.
  // До появления admin-клиента страница от этой переменной не зависела вовсе,
  // так что окружение без service-ключа (превью-стенд, CI, свежий клон с
  // неполным .env.local) получало не «блоки биллинга пусты», а полностью
  // недоступную коммерческую панель. Цена ошибки конфигурации при этом
  // несоразмерна: MRR, churn и распределение тарифов читаются ОБЫЧНЫМ
  // клиентом по политике «subscriptions: admin all» и к service-ключу
  // отношения не имеют — терять их вместе с платежами незачем.
  const admin = (() => {
    try {
      return createAdminClient()
    } catch {
      return null
    }
  })()

  // ── Snapshot queries (all in parallel) ───────────────────────────────────
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString()

  // Три billing-запроса вынесены в отдельную ветку: без service-ключа их
  // выполнить нечем, и вместо падения отдаём пустые списки. Молчать об этом
  // нельзя — пустой блок «Платежей пока нет» читается админом как «выручки
  // нет», хотя на деле данные просто не запрашивались; ниже это состояние
  // помечено явным баннером.
  async function loadBilling() {
    if (!admin) {
      return { payments: [] as PaymentRow[], invoices: [] as InvoiceRow[], orders: [] as CoachOrderRow[] }
    }
    const [paymentsRes, invoicesRes, ordersRes] = await Promise.all([
      admin
        .from('payments')
        .select('id, user_id, amount, currency, status, created_at, order_id')
        .order('created_at', { ascending: false })
        .limit(12),
      admin
        .from('invoices')
        .select('id, amount, currency, status, number, created_at, hosted_invoice_url')
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('coach_orders')
        .select('price_amount, currency')
        .eq('status', 'paid')
        .gte('paid_at', thirtyDaysAgo),
    ])
    return {
      payments: (paymentsRes.data ?? []) as PaymentRow[],
      invoices: (invoicesRes.data ?? []) as InvoiceRow[],
      orders:   (ordersRes.data ?? []) as CoachOrderRow[],
    }
  }

  const [
    subsRes,
    canceledRes,
    totalSubsRes,
    billing,
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, cancel_at_period_end'),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('status', [...CHURNED_STATUSES])
      .gte('updated_at', thirtyDaysAgo),
    supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true }),
    loadBilling(),
  ])

  const subs = (subsRes.data ?? []) as { plan: Plan; status: string; current_period_end: string | null; cancel_at_period_end: boolean | null }[]

  // Распределение по тарифам среди действующих подписок.
  // Раньше здесь был свой инлайновый список ('active' || 'trialing'), который
  // терял 'trial' (legacy-строки) и 'past_due' (грейс-период — доступ ещё
  // открыт, деньги ещё ожидаются). Единственный источник правды о том, что
  // считается действующей подпиской, — isSubscriptionActive из lib/plans.ts:
  // по нему же работают все гейты доступа, и расхождение между «что мы
  // считаем в MRR» и «кого мы пускаем в продукт» недопустимо.
  const paying = subs.filter(s => isSubscriptionActive(s.status))
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
  for (const o of billing.orders) {
    const c = (o.currency ?? 'RUB').toUpperCase()
    oneOffByCurrency[c] = (oneOffByCurrency[c] ?? 0) + (o.price_amount ?? 0)
  }

  const payments = billing.payments
  const invoices = billing.invoices

  // Отмены в конце периода. Сравнение только с 'active' теряло подписки в
  // грейсе: шаг 3a крона продлений гасит cancel_at_period_end для
  // ['active','trialing','past_due'], значит и предупреждать надо про все три.
  const upcomingCancel = subs.filter(s => s.cancel_at_period_end && isSubscriptionActive(s.status)).length

  const kpis = [
    {
      label: 'MRR (прогноз)',
      value: fmtMoney(mrr, 'RUB'),
      // paying включает и действующие free-подписки — подписывать их числом
      // «платящих» значило бы завышать метрику. Платят те, чей тариф вносит
      // вклад в MRR.
      hint: `${byPlan.pro + byPlan.team} платящих подписок`,
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
      hint: `${billing.orders.length} заказов`,
      tone: 'green',
      icon: 'ki-wallet',
    },
  ]

  const TONE: Record<string, { bg: string; color: string; border: string }> = {
    orange: { bg: '#FEF0E7', color: '#F35703', border: '#FBC1A0' },
    violet: { bg: '#FAF5FF', color: '#9333EA', border: '#E9D5FF' },
    red:    { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
    green:  { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
    blue:   { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[32px] border border-border bg-card shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(22,163,74,0.10),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(243,87,3,0.10),_transparent_28%)]" />
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
            <h1 className="pf-num text-[clamp(2rem,3.5vw,3.2rem)] leading-[0.95] tracking-tight text-navy-500">
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
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#F35703] to-[#D44A02] px-3.5 py-2 text-xs font-semibold text-white shadow-sm"
            >
              ЮKassa Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* Честное состояние вместо тихого нуля: без service-ключа платежи,
          инвойсы и разовые услуги не запрашивались вовсе, и пустые блоки ниже
          означают «не смогли прочитать», а не «выручки нет». */}
      {!admin && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <i className="ki-filled ki-information-2 mt-0.5 text-base text-amber-600" />
          <div className="text-xs text-amber-900">
            <div className="font-semibold">Блоки биллинга недоступны</div>
            <p className="mt-1 text-amber-800">
              В окружении не задан <code className="rounded bg-amber-100 px-1 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code>,
              поэтому платежи, инвойсы и разовые услуги не читались. Подписки, MRR и churn ниже — настоящие.
            </p>
          </div>
        </div>
      )}

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
            <h2 className="mt-1 text-lg font-semibold text-navy-500">Распределение по тарифам</h2>
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
            // paying уже содержит free-подписки (byPlan заполняется из него),
            // поэтому прежнее `paying.length + byPlan.free` считало free дважды
            // и занижало все доли: при 6 подписках знаменатель выходил 12.
            const total = paying.length
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
              colors: ['#2563EB', '#F35703', '#9333EA'],
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
              <h2 className="mt-1 text-lg font-semibold text-navy-500">Последние транзакции</h2>
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
              <h2 className="mt-1 text-lg font-semibold text-navy-500">Последние инвойсы</h2>
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
