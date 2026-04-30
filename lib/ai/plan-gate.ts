import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Subscription gate for expensive AI endpoints — Sprint W1 Day 2.
 *
 * Background: prior to this gate, free-tier users could call any AI endpoint
 * (limited only by per-user/per-IP rate-limit). For "structured generation"
 * endpoints — adaptive-plan, weekly-plan, coach-briefing, medical-summary —
 * each call hits Anthropic Sonnet/Haiku and costs real money. With 30 calls/h
 * cap per user (chat) and no plan check, a free user could rack up ~720
 * AI calls per day at zero revenue. Audit flagged this as a COGS-leak.
 *
 * This gate runs AFTER auth + role-check but BEFORE rate-limit and the AI
 * call itself. On failure it returns HTTP 402 (Payment Required) with a
 * structured JSON body the client can use to render a paywall banner.
 *
 * Forward-compatibility: the audit proposes a 6-tier plan structure
 * (Pro Athlete / Pro Trainer / Pro Specialist / Team Trainer / Club /
 * Federation). The gate treats any plan whose name STARTS with "pro" or
 * "team" or equals "club"/"federation"/"enterprise" as paid, so adding
 * new plans later doesn't require touching this file.
 *
 * Fail-open behavior: if the subscriptions row can't be read (RLS error,
 * RPC down, etc.), we log a warning and ALLOW the request. Better to serve
 * a degraded experience than break a paying customer's flow over a
 * transient infra hiccup.
 *
 * Admin bypass: users with role='admin' always pass — they need access for
 * support / debugging.
 */

/** Plans that grant access to gated AI endpoints. Anything not in this set
 * (typically 'free' or NULL) gets a 402. */
const PAID_PLAN_PREFIXES = ['pro', 'team', 'club', 'federation', 'enterprise']

function isPaidPlan(plan: string | null | undefined): boolean {
  if (!plan) return false
  const lc = plan.toLowerCase()
  return PAID_PLAN_PREFIXES.some(prefix => lc === prefix || lc.startsWith(prefix + '_'))
}

export interface PaywallPayload {
  ok: false
  error: 'PAYMENT_REQUIRED'
  required_plan: 'pro' | 'team' | 'club'
  feature: string
  message: string
  upgrade_url: string
}

interface EnforcePlanOpts {
  /** Which feature is being gated (renders nicely on the paywall card). */
  feature: string
  /** Minimum plan required. Affects the "required_plan" hint in the response.
   * The gate itself accepts any paid plan; this just hints to the UI which
   * banner variant to show. Default: 'pro'. */
  requiredPlan?: 'pro' | 'team' | 'club'
  /** If true, role='admin' always passes through. Default: true. */
  allowAdmin?: boolean
}

/**
 * Returns:
 *   - `null` when the call is allowed — proceed normally.
 *   - a `NextResponse` (HTTP 402) when the user is on free / no plan — the
 *     caller should return it as-is.
 *
 * Caller passes the already-resolved user-id (the internal `users.id`,
 * NOT `auth_id`). Pass the same `sb` client used elsewhere in the route.
 */
export async function enforcePlanForAi(
  sb: SupabaseClient,
  userId: string,
  userRole: string | null,
  opts: EnforcePlanOpts,
): Promise<NextResponse<PaywallPayload> | null> {
  const allowAdmin = opts.allowAdmin ?? true
  if (allowAdmin && userRole === 'admin') return null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any)
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.warn('[ai-plan-gate] subscription lookup failed, failing open:', error.message)
      return null
    }

    const row = data as { plan: string | null; status: string | null } | null
    const plan = row?.plan ?? null
    const status = row?.status ?? null

    // status check — even if plan is paid but cancelled/expired, deny.
    const isActive = status === null || status === 'active' || status === 'trial'
    if (!isPaidPlan(plan) || !isActive) {
      const required = opts.requiredPlan ?? 'pro'
      return NextResponse.json<PaywallPayload>(
        {
          ok: false,
          error: 'PAYMENT_REQUIRED',
          required_plan: required,
          feature: opts.feature,
          message:
            required === 'club'
              ? 'Эта функция доступна на тарифе Club или выше. Свяжитесь с нами для перехода.'
              : required === 'team'
                ? 'Эта функция доступна на тарифе Team или выше. Перейдите на Team, чтобы продолжить.'
                : 'Эта функция доступна на тарифах Pro и выше. Перейдите на Pro, чтобы продолжить.',
          upgrade_url: '/pricing',
        },
        { status: 402 },
      )
    }

    return null
  } catch (e) {
    console.warn('[ai-plan-gate] unexpected error, failing open:', e instanceof Error ? e.message : e)
    return null
  }
}
