'use client'
/**
 * /marketplace/[kind]/[id] — offering detail page (Day 15).
 *
 * `kind` is `pass_plan` | `service` (mirrors source table). Server-side
 * fetch + buy CTA which routes to /api/billing/checkout with the right
 * shape (passPlanId for packs, serviceId for services).
 *
 * Public browse, auth required to buy. If unauth on click → redirect
 * to /auth/login?next=/marketplace/...
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  getOffering, ROLE_META, SPECIALTY_META, SERVICE_TYPE_META,
  type Offering, type OfferingKind,
} from '@/services/marketplace.service'
import { Card, Badge, Alert } from '@/components/ui/metronic'

function fmtPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Бесплатно'
  const main = (cents / 100).toLocaleString('ru-RU')
  const sym = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency
  return `${main}${sym}`
}

function getSb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export default function OfferingDetailPage() {
  const params = useParams<{ kind: string; id: string }>()
  const router = useRouter()
  const kind = (params.kind === 'pass_plan' || params.kind === 'service') ? params.kind as OfferingKind : null
  const id = params.id

  const [offering, setOffering] = useState<Offering | null>(null)
  const [seller, setSeller] = useState<{ name: string | null; avatar_url: string | null } | null>(null)
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!kind || !id) return
    setLoading(true)
    const o = await getOffering(kind, id)
    setOffering(o)
    if (o) {
      const sb = getSb()
      const { data } = await sb
        .from('users')
        .select('name, avatar_url')
        .eq('id', o.seller_id)
        .maybeSingle()
      setSeller(data as { name: string | null; avatar_url: string | null } | null)
    }
    setLoading(false)
  }, [kind, id])

  useEffect(() => { load() }, [load])

  const buy = async () => {
    if (!offering) return
    setBusy(true)
    setError(null)
    try {
      const sb = getSb()
      const { data: auth } = await sb.auth.getUser()
      if (!auth?.user) {
        const next = `/marketplace/${offering.kind}/${offering.id}`
        router.push(`/auth/login?next=${encodeURIComponent(next)}`)
        return
      }
      const body = offering.kind === 'pass_plan'
        ? { passPlanId: offering.id }
        : { serviceId: offering.id }
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setError('Платёжная система пока не подключена. Свяжитесь с продавцом напрямую или попробуйте позже.')
        return
      }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Не удалось открыть оплату')
        return
      }
      window.location.href = data.url as string
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  if (!offering) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-3xl border-2 border-dashed border-border bg-accent/30 px-6 py-12 text-center">
          <i className="ki-filled ki-information-2 text-4xl text-muted-foreground mb-3 block" />
          <h2 className="text-lg font-semibold text-foreground">Услуга не найдена</h2>
          <p className="mt-2 text-sm text-muted-foreground">Возможно, продавец отключил её или её больше нет в каталоге.</p>
          <Link href="/marketplace"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold no-underline">
            ← Вернуться в каталог
          </Link>
        </div>
      </div>
    )
  }

  const roleMeta = ROLE_META[offering.seller_role]
  const typeMeta = SERVICE_TYPE_META[offering.service_type]
  const specMeta = offering.seller_specialty ? SPECIALTY_META[offering.seller_specialty] : null

  return (
    <div className="pf-enter max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <Link href="/marketplace"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          В каталог
        </Link>
      </div>

      <header>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: roleMeta.bg, color: roleMeta.color }}>
            {roleMeta.emoji} {roleMeta.label}
          </span>
          {specMeta && (
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-700 border border-violet-200">
              {specMeta.emoji} {specMeta.label}
            </span>
          )}
          <Badge variant="secondary" size="sm">
            {typeMeta.emoji} {typeMeta.label}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold text-foreground">{offering.title}</h1>
        {offering.description && (
          <p className="mt-3 text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {offering.description}
          </p>
        )}
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Цена</div>
          <div className="pf-num text-2xl font-bold text-foreground">
            {fmtPrice(offering.price_cents, offering.currency)}
          </div>
        </Card>
        {offering.kind === 'pass_plan' && offering.total_sessions != null && (
          <Card className="p-4">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Состав</div>
            <div className="text-sm font-bold text-foreground">{offering.total_sessions} сессий</div>
            <div className="text-[11px] text-muted-foreground">
              период {offering.period_days} {offering.period_days === 1 ? 'день' : 'дней'}
            </div>
          </Card>
        )}
        {offering.kind === 'service' && offering.duration_days != null && (
          <Card className="p-4">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Длительность</div>
            <div className="text-sm font-bold text-foreground">
              {offering.duration_days} {offering.duration_days === 1 ? 'день' : 'дней'}
            </div>
          </Card>
        )}
      </div>

      {/* Seller card */}
      {seller && (
        <Card className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-base font-bold text-orange-700 overflow-hidden shrink-0">
            {seller.avatar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={seller.avatar_url} alt="" className="w-full h-full object-cover" />
              : (seller.name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Продавец</div>
            <div className="text-base font-semibold text-foreground truncate">{seller.name ?? '—'}</div>
          </div>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" icon="ki-shield-cross">
          {error}
        </Alert>
      )}

      <div>
        <button onClick={buy} disabled={busy}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-6 py-4 text-base font-bold shadow-md disabled:opacity-50 transition">
          {busy ? 'Открываем оплату…' : `Купить за ${fmtPrice(offering.price_cents, offering.currency)}`}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Оплата через ЮKassa · 54-ФЗ автофискализация · Возврат по запросу
        </p>
      </div>
    </div>
  )
}
