'use client'
/**
 * /settings/billing — Sprint W3 Day 13.
 *
 * Subscription status page для current user. Показывает:
 *   - Active tariff name + price
 *   - Status (trialing / active / past_due / cancelled / etc)
 *   - Trial countdown (if applicable)
 *   - Next billing date (current_period_end)
 *   - Cancel-at-period-end toggle
 *   - "Change tariff" → /pricing
 *   - "Reactivate" если cancel_at_period_end=true но period ещё не закончился
 *
 * Idempotent on toggle — POST /api/billing/cancel {cancel:bool} can be
 * safely retried.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { Card, Badge, Alert, type BadgeVariant } from '@/components/ui/metronic'
import type { Database } from '@/types/database'

type SubRow = Database['public']['Tables']['subscriptions']['Row']
type TariffRow = Database['public']['Tables']['tariffs']['Row']

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  trialing:      { label: 'Trial-период',     variant: 'info' },
  trial:         { label: 'Trial-период',     variant: 'info' },
  active:        { label: 'Активна',          variant: 'success' },
  past_due:      { label: 'Просрочена',       variant: 'destructive' },
  cancelled:     { label: 'Отменена',         variant: 'secondary' },
  expired:       { label: 'Истекла',          variant: 'secondary' },
  blocked:       { label: 'Заблокирована',    variant: 'destructive' },
  manual_review: { label: 'Ручная проверка',  variant: 'primary' },
}

function getSb() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86400000)
}

export default function BillingPage() {
  const [sub, setSub]       = useState<SubRow | null>(null)
  const [tariff, setTariff] = useState<TariffRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const sb = getSb()
    const { data: auth } = await sb.auth.getUser()
    if (!auth?.user) { setLoading(false); return }
    const { data: meRaw } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
    const me = meRaw as { id: string } | null
    if (!me) { setLoading(false); return }

    const { data: subRaw } = await sb.from('subscriptions').select('*').eq('user_id', me.id).maybeSingle()
    const s = (subRaw as SubRow | null) ?? null
    setSub(s)

    if (s?.tariff_code || s?.plan) {
      const code = s.tariff_code ?? s.plan
      const { data: tRaw } = await sb.from('tariffs').select('*').eq('code', code).maybeSingle()
      setTariff((tRaw as TariffRow | null) ?? null)
    } else {
      // No subscription → show free tier as default
      const { data: freeRaw } = await sb.from('tariffs').select('*').eq('code', 'free').maybeSingle()
      setTariff((freeRaw as TariffRow | null) ?? null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleCancel = async (cancel: boolean) => {
    if (!sub) return
    if (cancel && !confirm('Отменить подписку? Доступ сохранится до конца оплаченного периода.')) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setMsg({ ok: false, text: json.error ?? 'Не удалось обновить подписку' })
        return
      }
      setMsg({
        ok: true,
        text: cancel
          ? 'Подписка будет отменена в конце периода. Доступ сохранится до этого времени.'
          : 'Подписка возобновлена. Списание произойдёт автоматически.',
      })
      await load()
    } finally { setBusy(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full pf-spin" />
      </div>
    )
  }

  const statusKey = sub?.status ?? 'expired'
  const statusMeta = STATUS_META[statusKey] ?? STATUS_META.expired
  const trialDaysLeft = sub?.trial_ends_at ? daysLeft(sub.trial_ends_at) : null
  const periodDaysLeft = sub?.current_period_end ? daysLeft(sub.current_period_end) : null

  return (
    <div className="pf-enter max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
      <div>
        <p className="text-2xs font-bold uppercase tracking-[0.22em] text-muted-foreground mb-1">Настройки → Биллинг</p>
        <h1 className="text-2xl font-bold text-foreground">Подписка</h1>
      </div>

      {msg && (
        <Alert variant={msg.ok ? 'success' : 'destructive'}
          icon={msg.ok ? 'ki-check-circle' : 'ki-shield-cross'}>
          {msg.text}
        </Alert>
      )}

      {/* Current plan card */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Текущий тариф</div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{tariff?.name ?? 'Free'}</h2>
              <Badge variant={statusMeta.variant} size="sm" className="uppercase tracking-wider">
                {statusMeta.label}
              </Badge>
              {sub?.cancel_at_period_end && (
                <Badge variant="warning" size="sm" className="uppercase tracking-wider">
                  Будет отменена
                </Badge>
              )}
            </div>
          </div>

          <Link href="/pricing"
            className="kt-btn kt-btn-sm gap-2 bg-orange-500 hover:bg-orange-600 text-white border-0">
            <i className="ki-filled ki-arrow-up-right text-xs" />
            Сменить тариф
          </Link>
        </div>

        {tariff && (
          <div className="text-sm text-muted-foreground mb-3">
            {tariff.price_cents === 0
              ? 'Базовый бесплатный тариф'
              : `${(tariff.price_cents / 100).toLocaleString('ru-RU')}${tariff.currency === 'RUB' ? '₽' : tariff.currency} ${
                  tariff.billing_period === 'monthly' ? '/ месяц' : tariff.billing_period === 'yearly' ? '/ год' : ''
                }`}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
          {trialDaysLeft != null && trialDaysLeft > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trial до</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{fmtDate(sub?.trial_ends_at ?? null)}</div>
              <div className="text-[11px] text-muted-foreground">осталось {trialDaysLeft} {trialDaysLeft === 1 ? 'день' : 'дней'}</div>
            </div>
          )}
          {sub?.current_period_end && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {sub.cancel_at_period_end ? 'Доступ до' : 'Следующее списание'}
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">{fmtDate(sub.current_period_end)}</div>
              {periodDaysLeft != null && (
                <div className="text-[11px] text-muted-foreground">через {periodDaysLeft} {periodDaysLeft === 1 ? 'день' : 'дней'}</div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Cancel / Reactivate */}
      {sub && tariff && tariff.price_cents > 0 && (
        <Card className="p-6">
          {sub.cancel_at_period_end ? (
            <>
              <div className="flex items-start gap-3 mb-3">
                <i className="ki-filled ki-information-2 text-base text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">Подписка будет отменена</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    Доступ сохраняется до {fmtDate(sub.current_period_end)}.
                    После — переход на Free тариф. Возобновите сейчас, чтобы избежать паузы.
                  </p>
                </div>
              </div>
              <button onClick={() => toggleCancel(false)} disabled={busy}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50">
                {busy ? 'Возобновляем…' : 'Возобновить подписку'}
              </button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-foreground mb-1">Отменить подписку</h3>
              <p className="text-xs text-muted-foreground mb-4 leading-snug">
                Доступ сохранится до конца оплаченного периода. После окончания периода — переход на Free тариф.
                Можно возобновить в любой момент до этой даты без потери истории.
              </p>
              <button onClick={() => toggleCancel(true)} disabled={busy}
                className="rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {busy ? 'Отменяем…' : 'Отменить подписку'}
              </button>
            </>
          )}
        </Card>
      )}

      {/* Free tier upgrade prompt */}
      {(!sub || (tariff?.price_cents === 0)) && (
        <section className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/30 p-6 text-center">
          <i className="ki-filled ki-rocket text-3xl text-orange-500 mb-2 block" />
          <h3 className="text-base font-bold text-foreground">Хотите больше?</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
            Pro-тарифы открывают AI-coach, безлимитные тренировки, мессенджер с тренером и продвинутую аналитику.
          </p>
          <Link href="/pricing"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 text-sm font-bold no-underline">
            Посмотреть тарифы
            <i className="ki-filled ki-arrow-right text-xs" />
          </Link>
        </section>
      )}
    </div>
  )
}
