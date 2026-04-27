import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Per-user rate limit guard for AI endpoints. Each AI route should call
 * this BEFORE doing the expensive Claude call. Backed by the
 * `check_and_increment_ai_rate_limit` RPC (migration 040), which atomically
 * counts the user's calls inside a sliding window and records the hit.
 *
 * Returns:
 *   - `null` when the call is allowed — proceed normally.
 *   - a `NextResponse` (HTTP 429) when the cap is exceeded — the caller
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
 */
export async function enforceAiRateLimit(
  sb: SupabaseClient,
  endpoint: string,
  maxPerWindow: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any).rpc('check_and_increment_ai_rate_limit', {
      p_endpoint:       endpoint,
      p_max_per_window: maxPerWindow,
      p_window_seconds: windowSeconds,
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
