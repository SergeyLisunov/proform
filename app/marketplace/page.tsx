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
  listOfferings, resolveSellers,
  ROLE_META, SPECIALTY_META, SERVICE_TYPE_META,
  type Offering, type SellerRole, type ServiceType, type SellerSpecialty,
} from '@/services/marketplace.service'

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

  const [offerings, setOfferings] = useState<Offering[]>([])
  const [sellers, setSellers]     = useState<Map<string, { id: string; name: string | null; avatar_url: string | null; role: string | null }>>(new Map())
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const list = await listOfferings({
      sellerRole:  role     || undefined,
      serviceType: type     || undefined,
      specialty:   specialty|| undefined,
      limit: 100,
    })
    setOfferings(list)
    const map = await resolveSellers(list)
    setSellers(map)
    setLoading(false)
  }, [role, type, specialty])

  useEffect(() => { load() }, [load])

  const setFilter = (key: 'role' | 'type' | 'specialty', value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else        params.delete(key)
    router.push(`/marketplace?${params.toString()}`)
  }

  const clearFilters = () => router.push('/marketplace')

  const activeFiltersCount = (role ? 1 : 0) + (type ? 1 : 0) + (specialty ? 1 : 0)

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
        <h1 className="pf-num text-[clamp(2rem,5vw,3.5rem)] text-foreground leading-[0.95] tracking-tight mb-3">
          Услуги и абонементы
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl">
          Тренеры, врачи, массажисты, нутрициологи и психологи. Купите услугу или абонемент,
          оплата через ЮKassa, чек 54-ФЗ автоматически.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-4 mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <i className="ki-filled ki-filter text-sm text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Фильтры</span>
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
      </div>

      {/* Catalog */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
        </div>
      ) : offerings.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-16 text-center">
          <i className="ki-filled ki-shop text-4xl text-muted-foreground mb-3 block" />
          <h3 className="text-lg font-semibold text-foreground">Услуг по вашему запросу пока нет</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Попробуйте сбросить фильтры или вернуться позже — каталог обновляется регулярно.
          </p>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters}
              className="mt-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold">
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(grouped.entries()).map(([t, offs]) => {
            const meta = SERVICE_TYPE_META[t]
            return (
              <section key={t}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{meta.emoji}</span>
                  <h2 className="text-lg font-bold text-foreground">{meta.label}</h2>
                  <span className="text-xs text-muted-foreground">({offs.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {offs.map(o => {
                    const seller = sellers.get(o.seller_id)
                    const roleMeta = ROLE_META[o.seller_role]
                    return (
                      <Link key={`${o.kind}-${o.id}`}
                        href={`/marketplace/${o.kind}/${o.id}`}
                        className="rounded-2xl border border-border bg-card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col gap-3 no-underline">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-bold text-foreground line-clamp-2">{o.title}</h3>
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0"
                            style={{ background: roleMeta.bg, color: roleMeta.color }}>
                            {roleMeta.emoji} {roleMeta.label}
                          </span>
                        </div>

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
                            <div className="flex items-center gap-1.5 max-w-[140px]">
                              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-700 overflow-hidden shrink-0">
                                {seller.avatar_url
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
                                  : (seller.name ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {seller.name ?? '—'}
                              </span>
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
          ? { background: '#FFF7ED', color: '#EA580C', borderColor: '#FED7AA' }
          : undefined}>
      {label}
    </button>
  )
}
