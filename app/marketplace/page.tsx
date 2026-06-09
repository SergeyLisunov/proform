'use client'
/**
 * /marketplace — Sprint W3 Day 15 (PR #30).
 *
 * Public multi-vendor catalog. Browse without auth; buy requires login
 * (existing /api/billing/checkout enforces auth).
 *
 * Filters (URL-driven, не form state — shareable):
 *   - ?role=coach|doctor|specialist
 *   - ?type=training_pack|consultation|...
 *   - ?specialty=physician|physio|massage|nutrition|psychiatry
 *
 * Each filter drops to "all" when not set. Filter chips highlight active.
 *
 * Per-card: title, price, seller (name + role badge + specialty),
 * description preview, click → /marketplace/[kind]/[id] detail.
 *
 * Note: useSearchParams must be wrapped in <Suspense> per Next.js 14
 * App Router requirements. We extract the inner logic to MarketplaceInner
 * and wrap with Suspense at default export.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  listOfferings, listFeaturedOfferings, resolveSellers,
  ROLE_META, SPECIALTY_META, SERVICE_TYPE_META,
  type Offering, type SellerRole, type ServiceType, type SellerSpecialty,
  type OfferingSort,
} from '@/services/marketplace.service'
import { getReviewSummaries } from '@/services/coach-reviews.service'
import VerifiedBadge from '@/components/ui/VerifiedBadge'
import { Card, Badge, ChartCard } from '@/components/ui/metronic'
import ApexChart from '@/components/charts/ApexChart'

const ROLE_OPTIONS: SellerRole[] = ['coach', 'doctor', 'specialist']
const TYPE_OPTIONS: ServiceType[] = [
  'training_pack', 'consultation', 'massage_session',
  'nutrition_plan', 'physio_session', 'psychology_session',
]
const SPECIALTY_OPTIONS: SellerSpecialty[] = [
  'physician', 'physio', 'massage', 'nutrition', 'psychiatry',
]

function fmtPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Бесплатно'
  const main = (cents / 100).toLocaleString('ru-RU')
  const sym = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency
  return `${main}${sym}`
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    }>
      <MarketplaceInner />
    </Suspense>
  )
}

function MarketplaceInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const role     = (searchParams.get('role')     ?? '') as SellerRole | ''
  const type     = (searchParams.get('type')     ?? '') as ServiceType | ''
  const specialty= (searchParams.get('specialty')?? '') as SellerSpecialty | ''
  const q        = (searchParams.get('q')        ?? '')
  const sort     = ((searchParams.get('sort')    ?? 'newest') as OfferingSort)
  // W8 Day 42: format + price facets
  const format   = (searchParams.get('format')   ?? '') as 'online' | 'offline' | 'hybrid' | ''
  const priceMaxRub = Number.parseInt(searchParams.get('price_max') ?? '', 10)
  const priceMax    = Number.isFinite(priceMaxRub) && priceMaxRub > 0 ? priceMaxRub : null
  // W9 Day 46: verified-only toggle
  const verifiedOnly = searchParams.get('verified') === '1'

  const [offerings, setOfferings] = useState<Offering[]>([])
  const [featured, setFeatured]   = useState<Offering[]>([])
  const [sellers, setSellers]     = useState<Map<string, { id: string; name: string | null; avatar_url: string | null; role: string | null; is_demo: boolean; is_featured: boolean; is_verified: boolean }>>(new Map())
  // W9 Day 44: ratings summary per seller_id (only populated for coach sellers with >=1 review)
  const [ratings, setRatings]     = useState<Map<string, { avg_rating: number; review_count: number }>>(new Map())
  const [loading, setLoading]     = useState(true)
  const [searchInput, setSearchInput] = useState(q)

  useEffect(() => { setSearchInput(q) }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    const [list, feat] = await Promise.all([
      listOfferings({
        sellerRole:   role     || undefined,
        serviceType:  type     || undefined,
        specialty:    specialty|| undefined,
        q:            q        || undefined,
        sort:         sort,
        format:       format   || undefined,
        priceMaxRub:  priceMax ?? undefined,
        verifiedOnly: verifiedOnly || undefined,
        limit:        100,
      }),
      // Only show featured carousel when there are no filters AND no search.
      role || type || specialty || q || format || priceMax || verifiedOnly
        ? Promise.resolve([] as Offering[])
        : listFeaturedOfferings(),
    ])
    const map = await resolveSellers([...feat, ...list])
    setSellers(map)
    // W9 Day 44: batched rating summaries for all visible coach sellers
    const sellerIds = Array.from(new Set([...feat, ...list].map(o => o.seller_id)))
    const summaries = await getReviewSummaries(sellerIds)
    const ratingsMap = new Map<string, { avg_rating: number; review_count: number }>()
    for (const [k, v] of summaries) ratingsMap.set(k, { avg_rating: v.avg_rating, review_count: v.review_count })

    // W9 Day 46: client-side rating sort happens AFTER ratings are
    // resolved. Service can't sort by rating because it doesn't join
    // the coach_review_summary view. Coaches with no reviews fall to
    // the bottom (treated as rating=0).
    let listSorted = list
    if (sort === 'rating_desc') {
      listSorted = [...list].sort((a, b) => {
        const ra = ratingsMap.get(a.seller_id)?.avg_rating ?? 0
        const rb = ratingsMap.get(b.seller_id)?.avg_rating ?? 0
        if (rb !== ra) return rb - ra
        // Tie-break: more reviews wins, then newest
        const ca = ratingsMap.get(a.seller_id)?.review_count ?? 0
        const cb = ratingsMap.get(b.seller_id)?.review_count ?? 0
        if (cb !== ca) return cb - ca
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    setOfferings(listSorted)
    setFeatured(feat)
    setRatings(ratingsMap)
    setLoading(false)
  }, [role, type, specialty, q, sort, format, priceMax, verifiedOnly])

  useEffect(() => { load() }, [load])

  const setFilter = (key: 'role' | 'type' | 'specialty' | 'q' | 'sort' | 'format' | 'price_max' | 'verified', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else        params.delete(key)
    router.push(`/marketplace?${params.toString()}`)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setFilter('q', searchInput.trim())
  }

  const clearFilters = () => { setSearchInput(''); router.push('/marketplace') }

  const activeFiltersCount = (role ? 1 : 0) + (type ? 1 : 0) + (specialty ? 1 : 0) + (q ? 1 : 0) + (format ? 1 : 0) + (priceMax ? 1 : 0) + (verifiedOnly ? 1 : 0)

  // W8 Day 42: compute "new this month" cutoff once per render
  const newCutoff = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const grouped = useMemo(() => {
    // Group by service_type for display
    const map = new Map<ServiceType, Offering[]>()
    for (const o of offerings) {
      const arr = map.get(o.service_type) ?? []
      arr.push(o)
      map.set(o.service_type, arr)
    }
    return map
  }, [offerings])

  return (
    <div className="pf-enter max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          На главную
        </Link>
      </div>

      <div className="mb-8">
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-2">Marketplace</p>
        <h1 className="pf-num text-[clamp(2rem,5vw,3.5rem)] text-navy-500 leading-[0.95] tracking-tight mb-3">
          Услуги и абонементы
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl">
          Тренеры, врачи, массажисты, нутрициологи и психологи. Купите услугу или абонемент,
          оплата через ЮKassa, чек 54-ФЗ автоматически.
        </p>
      </div>

      {/* Search + Sort row — W6 Day 32 */}
      <form onSubmit={submitSearch} className="flex items-stretch gap-2 mb-4">
        <div className="relative flex-1">
          <i className="ki-filled ki-magnifier pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" />
          <input type="search" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по названию или описанию"
            className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm outline-none focus:border-orange-400" />
        </div>
        <button type="submit"
          className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 text-sm font-bold whitespace-nowrap">
          Найти
        </button>
        <select value={sort} onChange={e => setFilter('sort', e.target.value === 'newest' ? '' : e.target.value)}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold outline-none focus:border-orange-400">
          <option value="newest">Сначала новые</option>
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
          <option value="rating_desc">По рейтингу</option>
        </select>
      </form>

      {/* Filters */}
      <Card className="p-4 mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <i className="ki-filled ki-filter text-sm text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фильтры</span>
            {/* W9 Day 46: verified-only toggle */}
            <button
              type="button"
              onClick={() => setFilter('verified', verifiedOnly ? '' : '1')}
              aria-pressed={verifiedOnly}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                verifiedOnly
                  ? 'bg-blue-600 text-white border border-blue-700 shadow-sm'
                  : 'bg-card text-blue-700 border border-blue-200 hover:bg-blue-50'
              }`}
              title="Показать только верифицированных тренеров"
            >
              <i className="ki-filled ki-verify text-xs" />
              {verifiedOnly ? 'Только Verified' : 'Только Verified'}
            </button>
          </div>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters}
              className="text-[11px] font-semibold text-orange-600 hover:underline">
              Сбросить ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Role */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Роль</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Все" active={!role} onClick={() => setFilter('role', '')} />
            {ROLE_OPTIONS.map(r => (
              <FilterChip key={r} label={`${ROLE_META[r].emoji} ${ROLE_META[r].label}`}
                active={role === r}
                color={ROLE_META[r].color} bg={ROLE_META[r].bg}
                onClick={() => setFilter('role', r)} />
            ))}
          </div>
        </div>

        {/* Specialty (только для doctor/specialist) */}
        {(role === 'doctor' || role === 'specialist' || !role) && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Специализация</div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label="Все" active={!specialty} onClick={() => setFilter('specialty', '')} />
              {SPECIALTY_OPTIONS.map(s => (
                <FilterChip key={s} label={`${SPECIALTY_META[s].emoji} ${SPECIALTY_META[s].label}`}
                  active={specialty === s}
                  onClick={() => setFilter('specialty', s)} />
              ))}
            </div>
          </div>
        )}

        {/* Type */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Тип услуги</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Все" active={!type} onClick={() => setFilter('type', '')} />
            {TYPE_OPTIONS.map(t => (
              <FilterChip key={t} label={`${SERVICE_TYPE_META[t].emoji} ${SERVICE_TYPE_META[t].label}`}
                active={type === t}
                onClick={() => setFilter('type', t)} />
            ))}
          </div>
        </div>

        {/* W8 Day 42: Format */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Формат</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Любой" active={!format} onClick={() => setFilter('format', '')} />
            <FilterChip label="Онлайн"  active={format === 'online'}  onClick={() => setFilter('format', 'online')} />
            <FilterChip label="Очно"    active={format === 'offline'} onClick={() => setFilter('format', 'offline')} />
            <FilterChip label="Гибрид"   active={format === 'hybrid'}  onClick={() => setFilter('format', 'hybrid')} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">При выборе формата абонементы (pass-plans) исключаются — у них нет формата.</p>
        </div>

        {/* W8 Day 42: Price range presets */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Цена</div>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="Любая"          active={!priceMax}                onClick={() => setFilter('price_max', '')} />
            <FilterChip label="до 5 000 ₽"     active={priceMax === 5000}        onClick={() => setFilter('price_max', '5000')} />
            <FilterChip label="до 15 000 ₽"    active={priceMax === 15000}       onClick={() => setFilter('price_max', '15000')} />
            <FilterChip label="до 50 000 ₽"    active={priceMax === 50000}       onClick={() => setFilter('price_max', '50000')} />
          </div>
        </div>
      </Card>

      {/* Featured carousel (only without filters/search) — W6 Day 32 */}
      {!loading && featured.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <i className="ki-solid ki-star text-xl text-amber-400" />
            <h2 className="text-lg font-bold text-navy-500">Рекомендуем</h2>
            <Badge variant="warning" size="sm" className="uppercase tracking-[0.18em]">
              Featured
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map(o => {
              const seller = sellers.get(o.seller_id)
              const roleMeta = ROLE_META[o.seller_role]
              return (
                <Link key={`feat-${o.kind}-${o.id}`}
                  href={`/marketplace/${o.kind}/${o.id}`}
                  className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col gap-3 no-underline">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-navy-500 line-clamp-2">{o.title}</h3>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                      style={{ background: roleMeta.bg, color: roleMeta.color }}>
                      {roleMeta.emoji} {roleMeta.label}
                    </span>
                  </div>
                  {o.description && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{o.description}</p>}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200">
                    <div className="pf-num text-xl font-bold text-foreground">{fmtPrice(o.price_cents, o.currency)}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      {ratings.get(o.seller_id) && (
                        <span
                          title={`${ratings.get(o.seller_id)!.review_count} отзывов`}
                          className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold shrink-0"
                        >
                          <i className="ki-solid ki-star text-[10px]" /> {ratings.get(o.seller_id)!.avg_rating.toFixed(1)}
                          <span className="font-normal opacity-70">·{ratings.get(o.seller_id)!.review_count}</span>
                        </span>
                      )}
                      {seller && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[140px]">
                          {seller.name ?? '—'}
                          {seller.is_verified && <VerifiedBadge size="sm" />}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Catalog */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
        </div>
      ) : offerings.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-16 text-center">
          {verifiedOnly ? (
            <>
              <i className="ki-filled ki-verify text-4xl text-blue-500 mb-3 block" />
              <h3 className="text-lg font-semibold text-navy-500">Verified-тренеров пока нет</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Программа верификации только запускается. Снимите фильтр, чтобы увидеть всех доступных тренеров.
              </p>
              <button
                onClick={() => setFilter('verified', '')}
                className="mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-bold"
              >
                Показать всех
              </button>
            </>
          ) : (
            <>
              <i className="ki-filled ki-shop text-4xl text-muted-foreground mb-3 block" />
              <h3 className="text-lg font-semibold text-navy-500">Услуг по вашему запросу пока нет</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Попробуйте сбросить фильтры или вернуться позже — каталог обновляется регулярно.
              </p>
              {activeFiltersCount > 0 && (
                <button onClick={clearFilters}
                  className="mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold">
                  Сбросить фильтры
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.size > 1 && (
            <ChartCard
              title="Каталог по типам услуг"
              subtitle={`Всего ${offerings.length} предложений в ${grouped.size} категориях`}
              accent
            >
              <ApexChart
                type="bar"
                height={Math.max(140, grouped.size * 44)}
                width="100%"
                options={{
                  chart: { toolbar: { show: false }, animations: { enabled: true, speed: 500 } },
                  colors: ['#F35703'],
                  plotOptions: { bar: { horizontal: true, borderRadius: 4, columnWidth: '60%' } },
                  dataLabels: { enabled: false },
                  grid: { borderColor: '#F1F5F9', strokeDashArray: 3 },
                  xaxis: {
                    categories: Array.from(grouped.keys()).map(t => SERVICE_TYPE_META[t].label),
                    labels: { style: { fontSize: '10px', colors: '#94A3B8' } },
                    axisBorder: { show: false }, axisTicks: { show: false },
                  },
                  yaxis: { labels: { style: { fontSize: '11px', colors: '#94A3B8' } } },
                  tooltip: { theme: 'light' },
                }}
                series={[{ name: 'Предложений', data: Array.from(grouped.values()).map(offs => offs.length) }]}
              />
            </ChartCard>
          )}
          {Array.from(grouped.entries()).map(([t, offs]) => {
            const meta = SERVICE_TYPE_META[t]
            return (
              <section key={t}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{meta.emoji}</span>
                  <h2 className="text-lg font-bold text-navy-500">{meta.label}</h2>
                  <span className="text-xs text-muted-foreground">({offs.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offs.map(o => {
                    const seller = sellers.get(o.seller_id)
                    const roleMeta = ROLE_META[o.seller_role]
                    // W8 Day 42: compute badges per card
                    const isFeatured = seller?.is_featured === true
                    const isNew      = o.created_at >= newCutoff
                    return (
                      <Link key={`${o.kind}-${o.id}`}
                        href={`/marketplace/${o.kind}/${o.id}`}
                        className="rounded-2xl border border-border bg-card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col gap-3 no-underline">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-bold text-navy-500 line-clamp-2">{o.title}</h3>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                            style={{ background: roleMeta.bg, color: roleMeta.color }}>
                            {roleMeta.emoji} {roleMeta.label}
                          </span>
                        </div>

                        {/* W8 Day 42: badge row */}
                        {(isFeatured || isNew) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isFeatured && (
                              <Badge variant="warning" size="sm" className="uppercase tracking-wider">
                                <i className="ki-solid ki-star text-[10px] mr-0.5" /> Featured
                              </Badge>
                            )}
                            {isNew && (
                              <Badge variant="success" size="sm" className="uppercase tracking-wider">
                                New this month
                              </Badge>
                            )}
                          </div>
                        )}

                        {o.description && (
                          <p className="text-xs text-muted-foreground line-clamp-3 flex-1">{o.description}</p>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
                          <div>
                            <div className="pf-num text-xl font-bold text-foreground">
                              {fmtPrice(o.price_cents, o.currency)}
                            </div>
                            {o.kind === 'pass_plan' && o.total_sessions && (
                              <div className="text-[10px] text-muted-foreground">
                                {o.total_sessions} сессий · {o.period_days} дн.
                              </div>
                            )}
                            {o.kind === 'service' && o.duration_days && (
                              <div className="text-[10px] text-muted-foreground">
                                {o.duration_days} дн.
                              </div>
                            )}
                          </div>
                          {seller && (
                            <div className="flex items-center gap-1.5 max-w-[160px]">
                              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700 overflow-hidden shrink-0">
                                {seller.avatar_url
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                                  : (seller.name ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                                  {seller.name ?? '—'}
                                  {seller.is_verified && <VerifiedBadge size="sm" />}
                                </span>
                                <div className="flex items-center gap-1">
                                  {ratings.get(o.seller_id) && (
                                    <span
                                      title={`${ratings.get(o.seller_id)!.review_count} отзывов · среднее ${ratings.get(o.seller_id)!.avg_rating.toFixed(1)}`}
                                      className="text-[10px] font-bold text-amber-700"
                                    >
                                      <i className="ki-solid ki-star text-[10px]" /> {ratings.get(o.seller_id)!.avg_rating.toFixed(1)}
                                      <span className="font-normal text-muted-foreground"> ({ratings.get(o.seller_id)!.review_count})</span>
                                    </span>
                                  )}
                                  {seller.is_demo && (
                                    <span title="Demo-профиль — реальные тренеры скоро"
                                      className="text-[9px] font-bold uppercase tracking-wider text-amber-700">
                                      DEMO
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick, color, bg }: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
  bg?: string
}) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-bold transition border ${
        active
          ? 'ring-2 ring-current'
          : 'border-border bg-background hover:border-orange-200 text-muted-foreground'
      }`}
      style={active && color && bg
        ? { background: bg, color, borderColor: color + '60' }
        : active
          ? { background: '#FEF0E7', color: '#D44A02', borderColor: '#FBC1A0' }
          : undefined}>
      {label}
    </button>
  )
}
