import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProvider } from '@/lib/payments'
import type { ProviderId } from '@/lib/payments/provider'
import { applyPaymentEvent } from '@/services/payment-events.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * GET /api/cron/billing-renewals — ежедневно 07:00 (P2).
 *
 * Закрывает три давно обещанных дыры биллинга:
 *   1. «Janitor» из billing.service: pending-платежи старше 1 часа →
 *      canceled (иначе копятся вечно).
 *   2. ПЕРВЫЙ вызов provider.chargeRecurring: подписки с истёкшим
 *      периодом, автопродлением и сохранённым токеном — списание по
 *      связке (Альфа binding / ЮKassa payment_method).
 *   3. Локаут из /api/billing/cancel: cancel_at_period_end → cancelled;
 *      без токена / past_due — 3 дня грейса → expired.
 */
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const GRACE_DAYS = 3

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any
  const now = new Date()
  const stats = {
    stale_canceled: 0, stale_orders_cancelled: 0,
    renewed: 0, renew_pending: 0, renew_failed: 0, skipped_inflight: 0,
    cancelled: 0, expired: 0,
  }

  try {
    // ── 1. Janitor: протухшие pending-платежи + их pending-заказы ────────
    const hourAgo = new Date(now.getTime() - 3600_000).toISOString()
    const { data: staleRows } = await adminAny.from('payments')
      .update({ status: 'canceled', updated_at: now.toISOString() })
      .eq('status', 'requires_payment_method')
      .lt('created_at', hourAgo)
      .select('id, order_id')
    const stale = (staleRows ?? []) as Array<{ id: string; order_id: string | null }>
    stats.stale_canceled = stale.length
    const staleOrderIds = stale.map(s => s.order_id).filter(Boolean) as string[]
    if (staleOrderIds.length) {
      const { data: cancelledOrders } = await adminAny.from('coach_orders')
        .update({ status: 'cancelled', updated_at: now.toISOString() })
        .in('id', staleOrderIds)
        .eq('status', 'pending')
        .select('id')
      stats.stale_orders_cancelled = (cancelledOrders ?? []).length
    }

    // ── 2. Автопродление по сохранённому токену ───────────────────────────
    // past_due внутри грейса ретраится ежедневно (грейс из уведомления
    // должен быть настоящим); терминальный путь для него — шаг 3b.
    const graceCutoffISO = new Date(now.getTime() - GRACE_DAYS * 86400000).toISOString()
    const dueBase = () => adminAny.from('subscriptions')
      .select('id, user_id, status, tariff_code, provider, yookassa_payment_method_id, current_period_end')
      .eq('cancel_at_period_end', false)
      .not('yookassa_payment_method_id', 'is', null)
      .lt('current_period_end', now.toISOString())
      .limit(50)
    const [{ data: dueActive }, { data: duePastDue }] = await Promise.all([
      dueBase().in('status', ['active', 'trialing']),
      dueBase().eq('status', 'past_due').gte('current_period_end', graceCutoffISO),
    ])
    const due = ([...(dueActive ?? []), ...(duePastDue ?? [])]) as Array<{
      id: string; user_id: string; status: string; tariff_code: string | null
      provider: string | null; yookassa_payment_method_id: string
      current_period_end: string
    }>

    // Guard от двойного списания: пропускаем подписчиков с незавершённым
    // renewal-платежом (создан < 1 ч назад — старше уже убрал janitor;
    // его судьбу решит вебхук или завтрашний janitor).
    const dueUserIds = due.map(s => s.user_id)
    const inflightUsers = new Set<string>()
    if (dueUserIds.length) {
      const { data: inflight } = await adminAny.from('payments')
        .select('user_id')
        .in('user_id', dueUserIds)
        .eq('status', 'requires_payment_method')
        .filter('raw->>renewal', 'eq', 'true')
      for (const p of (inflight ?? []) as Array<{ user_id: string }>) {
        inflightUsers.add(p.user_id)
      }
    }

    for (const sub of due) {
      if (inflightUsers.has(sub.user_id)) { stats.skipped_inflight += 1; continue }

      // ── Фаза A: списание. Ошибки здесь = деньги НЕ двигались ────────────
      let charge: Awaited<ReturnType<ReturnType<typeof getProvider>['chargeRecurring']>>
      let providerId: Exclude<ProviderId, 'manual'>
      let paymentId: string
      try {
        if (!sub.tariff_code) throw new Error('no tariff_code')
        providerId = (sub.provider ?? 'alfabank') as Exclude<ProviderId, 'manual'>
        const provider = getProvider(providerId)

        const { data: tariffRaw } = await adminAny.from('tariffs')
          .select('code, name, price_cents, currency, billing_period')
          .eq('code', sub.tariff_code).maybeSingle()
        const tariff = tariffRaw as {
          code: string; name: string; price_cents: number
          currency: string; billing_period: string
        } | null
        if (!tariff || tariff.price_cents <= 0) throw new Error(`tariff unusable: ${sub.tariff_code}`)

        paymentId = randomUUID()
        const idempotenceKey = randomUUID()
        const { error: insErr } = await adminAny.from('payments').insert({
          id:       paymentId,
          user_id:  sub.user_id,
          amount:   tariff.price_cents,
          currency: tariff.currency,
          status:   'requires_payment_method',
          provider: providerId,
          raw:      { tariff_code: tariff.code, idempotence_key: idempotenceKey, renewal: true },
        })
        if (insErr) throw new Error(`payments insert: ${insErr.message}`)

        charge = await provider.chargeRecurring({
          paymentMethodId: sub.yookassa_payment_method_id,
          paymentId,
          amountCents:     tariff.price_cents,
          currency:        tariff.currency as 'RUB' | 'KZT',
          description:     `Продление: ${tariff.name}`,
          idempotenceKey,
          metadata:        { renewal: 'true' },
          // Персист provider-id ДО списания (Альфа) — throw отменяет charge.
          onProviderPaymentId: async (providerPaymentId: string) => {
            const { error: linkErr } = await adminAny.from('payments')
              .update({ provider: providerId, provider_payment_id: providerPaymentId })
              .eq('id', paymentId)
            if (linkErr) throw new Error(`provider-link persist failed: ${linkErr.message}`)
          },
        })
      } catch (e) {
        // Деньги не списаны: гейт-отказ/транзиент. past_due + уведомление;
        // внутри грейса завтрашний прогон ретраит.
        stats.renew_failed += 1
        console.warn(`[billing-renewals] charge failed for sub ${sub.id}:`, e instanceof Error ? e.message : e)
        if (sub.status !== 'past_due') {
          await adminAny.from('subscriptions')
            .update({ status: 'past_due', updated_at: now.toISOString() })
            .eq('id', sub.id)
          try {
            await adminAny.from('notifications').insert({
              user_id:    sub.user_id,
              type:       'broadcast',
              title:      'Не удалось продлить подписку',
              body:       `Проверьте способ оплаты — доступ сохранится ещё ${GRACE_DAYS} дня, попытки продолжатся.`,
              action_url: '/settings/billing',
            })
          } catch { /* ignore */ }
        }
        continue
      }

      // ── Фаза B: бухгалтерия. Деньги УЖЕ двигались (или charge в пути) —
      // статус подписки НЕ трогаем, ошибки только логируем громко ─────────
      try {
        if (charge.alreadyCaptured) {
          // Альфа подтверждает синхронно — активируем сразу (идемпотентно
          // с возможным дублем от callback).
          await applyPaymentEvent(admin, {
            provider:          providerId,
            kind:              'payment.succeeded',
            providerPaymentId: charge.providerPaymentId,
          })
          stats.renewed += 1
        } else {
          // Capture асинхронный (ЮKassa) — довершит вебхук.
          stats.renew_pending += 1
        }
      } catch (e) {
        console.error(
          `[billing-renewals] CAPTURED but bookkeeping failed for sub ${sub.id}, ` +
          `charge ${charge.providerPaymentId} — reconcile manually:`,
          e instanceof Error ? e.message : e,
        )
      }
    }

    // ── 3a. cancel_at_period_end → cancelled ──────────────────────────────
    const { data: cancelledRows } = await adminAny.from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: now.toISOString(), updated_at: now.toISOString() })
      .in('status', ['active', 'trialing', 'past_due'])
      .eq('cancel_at_period_end', true)
      .lt('current_period_end', now.toISOString())
      .select('id, user_id')
    stats.cancelled = (cancelledRows ?? []).length

    // ── 3b. Грейс истёк (нет токена или past_due) → expired ──────────────
    const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 86400000).toISOString()
    const { data: expiredNoToken } = await adminAny.from('subscriptions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .in('status', ['active', 'trialing'])
      .eq('cancel_at_period_end', false)
      .is('yookassa_payment_method_id', null)
      .lt('current_period_end', graceCutoff)
      .select('id')
    const { data: expiredPastDue } = await adminAny.from('subscriptions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('status', 'past_due')
      .lt('current_period_end', graceCutoff)
      .select('id')
    stats.expired = (expiredNoToken ?? []).length + (expiredPastDue ?? []).length

    return NextResponse.json({ ok: true, ...stats })
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : String(e), ...stats,
    }, { status: 500 })
  }
}
