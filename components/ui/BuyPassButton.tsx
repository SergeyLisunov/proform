'use client'

import { useState } from 'react'

/**
 * Button that starts a Stripe Checkout session for a coach_pass_plan and
 * redirects the athlete to the hosted page. On success Stripe returns them
 * to /calendar?pass=success and the webhook creates the athlete_pass row.
 */
export default function BuyPassButton({
  passPlanId,
  priceLabel,
  disabled,
  children,
  className,
}: {
  passPlanId: string
  priceLabel?: string
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passPlanId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        setError(json.error ?? `HTTP ${res.status}`)
        setBusy(false); return
      }
      window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={busy || disabled}
        className={className
          ?? 'inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50'}
      >
        <i className="ki-filled ki-credit-cart text-xs"/>
        {busy ? 'Переходим к оплате…' : (children ?? (priceLabel ? `Купить за ${priceLabel}` : 'Купить абонемент'))}
      </button>
      {error && (
        <div className="text-[11px] text-red-600">Ошибка: {error}</div>
      )}
    </div>
  )
}
