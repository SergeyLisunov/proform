import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Per-user + per-IP rate limit guard for AI endpoints. Each AI route
 * should call this BEFORE doing the expensive Claude call. Backed by the
 * `check_and_increment_ai_rate_limit` RPC (migrations 040, 043), which
 * atomically counts the user's calls and the IP's total AI calls inside
 * sliding windows and records the hit only if both limits pass.
 *
 * Returns:
 *   - `null` when the call is allowed — proceed normally.
 *   - a `NextResponse` (HTTP 429) when either cap is exceeded — the caller
 *     should return it as-is.
 *
 * On infrastructure errors (RPC unreachable, missing function, etc.) the
 * guard FAILS OPEN and returns null — we'd rather serve a degraded
 * experience than break a paid feature outright. Errors are logged via
 * console.warn for the operator to notice.
 *
 * Suggested limits:
 *   - chat-style (`ask`):                 30 / 3600s
 *   - structured generation (`adaptive-plan`, `medical-summary`,
 *     `coach-briefing`, `weekly-insights`, `weekly-plan/accept`,
 *     `workout-debrief`):                 10 / 3600s
 *   - lighter / per-event (`anomaly-check`, `coach-suggest`):
 *                                         20 / 3600s
 *
 * The IP cap is 60/hour total across all AI endpoints, so a botnet
 * running multiple accounts from one IP still hits the wall.
 */

/** Extract a representative client IP from request headers. Vercel sets
 * `x-forwarded-for` (comma-separated, leftmost = original client) and
 * `x-real-ip`. We prefer XFF first entry, fall back to x-real-ip, fall
 * back to a fixed sentinel that the RPC ignores. Lowercased + trimmed. */
function extractClientIp(req: Request | { headers: Headers }): string | null {
  const h = req.headers
  const xff = h.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim().toLowerCase()
    if (first) return first
  }
  const real = h.get('x-real-ip')
  if (real) return real.trim().toLowerCase()
  return null
}

/** Hash IP with a deploy-scoped pepper. The pepper prevents an attacker
 * who reads the rate-limits table (e.g. via SQL injection elsewhere) from
 * recovering raw IPs via rainbow-table lookup. Falls back to a fixed
 * literal so the function is still deterministic without pepper config —
 * the *value* of the hash matters less than its consistency for counting. */
function hashIp(ip: string): string {
  const pepper = process.env.AI_RATE_LIMIT_PEPPER ?? 'proform-default-pepper-2026'
  return createHash('sha256').update(`${pepper}::${ip}`).digest('hex')
}

interface EnforceOpts {
  /** Per-IP cap across all AI endpoints in the same window. Default 60. */
  ipMaxPerWindow?: number
  /** Window for the IP cap, in seconds. Default 3600. */
  ipWindowSeconds?: number
}

export async function enforceAiRateLimit(
  req: Request,
  sb: SupabaseClient,
  endpoint: string,
  maxPerWindow: number,
  windowSeconds: number,
  opts: EnforceOpts = {},
): Promise<NextResponse | null> {
  const ipMax       = opts.ipMaxPerWindow ?? 60
  const ipWindowSec = opts.ipWindowSeconds ?? 3600

  const ip       = extractClientIp(req)
  const ipHash   = ip ? hashIp(ip) : null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any).rpc('check_and_increment_ai_rate_limit', {
      p_endpoint:        endpoint,
      p_max_per_window:  maxPerWindow,
      p_window_seconds:  windowSeconds,
      p_ip_hash:         ipHash,
      p_ip_max:          ipMax,
      p_ip_window_secs:  ipWindowSec,
    })
    if (error) {
      console.warn('[ai-rate-limit] rpc error, failing open:', error.message)
      return null
    }
    if (data === false) {
      return NextResponse.json(
        {
          ok: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: `AI rate limit exceeded for ${endpoint}. Try again later.`,
          retry_after_seconds: windowSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(windowSeconds) } },
      )
    }
    return null
  } catch (e) {
    console.warn('[ai-rate-limit] unexpected error, failing open:', e instanceof Error ? e.message : e)
    return null
  }
}
