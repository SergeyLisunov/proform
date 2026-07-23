import { NextResponse } from 'next/server'
import { resolveActor, buildCapabilities } from '@/lib/ai/assistant/gateway'
import { getAssistantProvider } from '@/lib/ai/assistant/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/assistant/capabilities — что доступно текущему пользователю:
 * роль, название ассистента, подсказки, лимит/остаток/дата сброса,
 * история, стриминг, причины недоступности, upgrade CTA.
 * Роль и тариф — только серверные (Role Policy + AISubscriptionGuard).
 */
export async function GET() {
  const res = await resolveActor()
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: res.status })

  const caps = await buildCapabilities(res.actor)
  // Провайдер не настроен → ассистент виден, но недоступен с причиной.
  if (caps.available && !getAssistantProvider().isConfigured()) {
    return NextResponse.json({
      ok: true,
      capabilities: {
        ...caps,
        available: false,
        unavailableReason: 'AI временно не настроен на сервере — загляните позже.',
      },
    })
  }
  return NextResponse.json({ ok: true, capabilities: caps })
}
