'use client'
/**
 * /pricing — Sprint W3 Day 13 redesign.
 *
 * DB-driven public pricing page. Reads tariffs from `tariffs` table
 * (RLS allows anonymous read where is_active=true). Replaces previous
 * 3-tier hardcoded const Paywall.PricingPage.
 *
 * 6 tiers from the audit's revised model — grouped by `target_role`
 * for clearer browsing:
 *   - athlete: free, pro_athlete
 *   - coach:   pro_trainer, team_trainer
 *   - specialist: pro_specialist
 *   - organization: club
 *
 * Checkout flow:
 *   - free tier → no checkout (already free)
 *   - paid tier → POST /api/billing/checkout {provider:'yookassa', tariffCode}
 *   - Server returns confirmation_url → redirect window.location
 *
 * If user not authenticated when clicking → redirect to /auth/login
 * with `?next=/pricing`.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

type TariffRow = Database['public']['Tables']['tariffs']['Row']

interface Tariff {
  id: string
  code: string
  name: string
  description: string | null
  price_cents: number
  currency: string
  billing_period: string
  trial_days: number
  max_athletes: number | null
  features: string[]
  target_role: string
  display_order: number
}

const ROLE_GROUPS: Array<{ key: string; label: string; icon: string; bg: string; color: string }> = [
  { key: 'athlete',      label: 'Атлет',           icon: 'ki-abstract-26', bg: '#FEF0E7', color: '#D44A02' },
  { key: 'coach',        label: 'Тренер',          icon: 'ki-medal-star',  bg: '#EFF6FF', color: '#2563EB' },
  { key: 'specialist',   label: 'Врач / Специалист', icon: 'ki-pulse',     bg: '#FEF2F2', color: '#E11D48' },
  { key: 'organization', label: 'Организация',     icon: 'ki-office-bag',  bg: '#FAF5FF', color: '#9333EA' },
]

function getSb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return 'Бесплатно'
  const main = (cents / 100).toLocaleString('ru-RU')
  const sym = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency
  return `${main}${sym}`
}

function periodLabel(p: string): string {
  return p === 'monthly' ? '/мес' : p === 'yearly' ? '/год' : p === 'one_time' ? '' : `/${p}`
}

export default function PricingPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [currentCode, setCurrentCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const sb = getSb()
      const [{ data: tariffsRaw }, { data: auth }] = await Promise.all([
        sb.from('tariffs')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        sb.auth.getUser(),
      ])
      if (cancelled) return
      const list = ((tariffsRaw ?? []) as TariffRow[]).map(r => ({
        id: r.id, code: r.code, name: r.name, description: r.description,
        price_cents: r.price_cents, currency: r.currency,
        billing_period: r.billing_period, trial_days: r.trial_days,
        max_athletes: r.max_athletes,
        features: Array.isArray(r.features) ? (r.features as string[]) : [],
        target_role: r.target_role, display_order: r.display_order,
      }))
      setTariffs(list)

      // If logged in → fetch current subscription tariff_code
      if (auth?.user) {
        const { data: meRaw } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
        const me = meRaw as { id: string } | null
        if (me) {
          const { data: subRaw } = await sb
            .from('subscriptions')
            .select('tariff_code, plan, status')
            .eq('user_id', me.id)
            .maybeSingle()
          const sub = subRaw as { tariff_code: string | null; plan: string | null; status: string | null } | null
          if (sub && sub.status !== 'cancelled' && sub.status !== 'expired') {
            setCurrentCode(sub.tariff_code ?? sub.plan ?? null)
          } else {
            setCurrentCode('free')
          }
        }
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const buy = async (tariffCode: string) => {
    setBusyCode(tariffCode)
    setError(null)
    try {
      const sb = getSb()
      const { data: auth } = await sb.auth.getUser()
      if (!auth?.user) {
        window.location.href = `/auth/login?next=${encodeURIComponent('/pricing')}`
        return
      }
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'yookassa', tariffCode }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 503) {
        setError('Платёжная система пока не подключена. Попробуйте позже или свяжитесь с поддержкой.')
        return
      }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Не удалось открыть оплату')
        return
      }
      window.location.href = data.url as string
    } finally {
      setBusyCode(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  return (
    <main id="main-content" className="pf-enter max-w-6xl mx-auto px-4 py-8">
      {/* Back nav */}
      <div className="mb-6">
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition no-underline">
          <i className="ki-filled ki-arrow-left text-sm" />
          На главную
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center mb-10">
        <p className="text-2xs font-bold uppercase tracking-[0.24em] text-muted-foreground mb-2">Тарифы</p>
        <h1 className="pf-num text-[clamp(2rem,5vw,3.5rem)] text-navy-500 leading-[0.95] tracking-tight mb-3">
          Простые и честные цены
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
          Free start. Trial period на платных тарифах. Отмена в любой момент.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 max-w-xl mx-auto">
          <i className="ki-filled ki-shield-cross mr-2" />
          {error}
        </div>
      )}

      {/* Grouped by target role */}
      {ROLE_GROUPS.map(group => {
        const groupTariffs = tariffs.filter(t =>
          t.target_role === group.key || (group.key === 'athlete' && t.target_role === 'any')
        )
        if (groupTariffs.length === 0) return null

        return (
          <section key={group.key} className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              <i className={`ki-filled ${group.icon} text-2xl`} style={{ color: group.color }} />
              <h2 className="text-xl font-bold text-navy-500">Для роли: {group.label}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupTariffs.map(t => {
                const isCurrent = currentCode === t.code
                const isFree = t.price_cents === 0
                const isPopular = t.code === 'pro_trainer' // Coach is the highest-LTV persona
                return (
                  <div key={t.code}
                    className={`rounded-2xl border-2 bg-card p-6 flex flex-col relative transition-all ${
                      isPopular ? 'border-orange-300 shadow-md' : isCurrent ? 'border-emerald-400' : 'border-border hover:border-orange-200 hover:-translate-y-0.5'
                    }`}>
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: 'linear-gradient(135deg,#F35703,#D44A02)', color: 'white', boxShadow: '0 4px 12px rgba(212,74,2,0.4)' }}>
                          <i className="ki-solid ki-star text-[10px]" /> Популярный
                        </span>
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 right-4">
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Текущий
                        </span>
                      </div>
                    )}

                    <div className="text-base font-bold text-foreground" style={{ color: group.color }}>{t.name}</div>
                    {t.description && (
                      <p className="mt-1 text-xs text-muted-foreground leading-snug line-clamp-2">{t.description}</p>
                    )}

                    <div className="flex items-baseline gap-1 mt-4 mb-4">
                      <span className="pf-num text-3xl font-bold text-foreground leading-none">
                        {formatPrice(t.price_cents, t.currency)}
                      </span>
                      {!isFree && (
                        <span className="text-xs text-muted-foreground">{periodLabel(t.billing_period)}</span>
                      )}
                    </div>

                    {t.trial_days > 0 && !isFree && (
                      <div className="mb-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider self-start"
                        style={{ background: '#FEF0E7', color: '#D44A02', border: '1px solid #FBC1A0' }}>
                        <i className="ki-filled ki-gift text-[11px]" /> Trial {t.trial_days} дней
                      </div>
                    )}

                    {t.max_athletes != null && (
                      <div className="text-[11px] text-muted-foreground mb-3">
                        До <strong className="text-foreground">{t.max_athletes}</strong> атлетов
                      </div>
                    )}

                    <ul className="space-y-1.5 flex-1 mb-4">
                      {t.features.map(f => (
                        <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                          <i className="ki-filled ki-check text-[10px] mt-1 shrink-0" style={{ color: group.color }} />
                          <span className="leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => isFree || isCurrent ? null : buy(t.code)}
                      disabled={busyCode === t.code || isFree || isCurrent}
                      className="w-full rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-60"
                      style={{
                        background: isCurrent
                          ? '#F0FDF4'
                          : isFree
                            ? 'var(--accent)'
                            : `linear-gradient(135deg, ${group.color}, ${group.color}dd)`,
                        color: isCurrent ? '#15803D' : isFree ? 'var(--muted-foreground)' : 'white',
                        boxShadow: isCurrent || isFree ? 'none' : `0 4px 14px ${group.color}40`,
                      }}>
                      {busyCode === t.code ? 'Открываем оплату…'
                        : isCurrent ? 'Текущий план'
                        : isFree ? 'Текущий тариф'
                        : 'Перейти на ' + t.name}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <p className="text-center text-xs text-muted-foreground mt-8">
        Безопасная оплата через ЮKassa · 54-ФЗ автофискализация · Отмена в любой момент
      </p>
    </main>
  )
}
