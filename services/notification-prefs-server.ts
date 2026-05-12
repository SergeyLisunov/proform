/**
 * Server-side notification preferences helper — Sprint W6 Day 29.
 *
 * Pure function variant of the client-side prefs service in
 * `notification-prefs.service.ts`. Used by cron routes + email
 * dispatch paths so we don't pull in the client supabase wrapper
 * unnecessarily on server-only call sites.
 *
 * Mirrors the semantics of the SQL RPC `should_send_notification`
 * from Migration 065:
 *   - prefs missing / null              → ALLOW (fail-open)
 *   - prefs object missing the channel  → ALLOW
 *   - channel value is not boolean      → ALLOW
 *   - channel value is explicitly false → BLOCK
 *
 * Why a JS mirror instead of always RPC'ing? Cron routes fetch a
 * batch of users; per-row RPC would mean N+1 round-trips. We
 * already SELECT `notification_prefs` along with `email` in the
 * batch query — checking in-process is essentially free.
 *
 * Keep this in sync with `services/notification-prefs.service.ts`
 * (which is client-side and also gates UI rendering).
 */

export type PrefsBag = Record<string, unknown> | null | undefined

/**
 * Returns true if the channel is allowed for the user given their
 * stored JSONB prefs. Fail-open default — matches `should_send_notification`
 * RPC in Migration 065. Channel keys are loose strings to avoid forcing
 * a type import on every call site.
 */
export function isChannelAllowed(prefs: PrefsBag, channel: string): boolean {
  if (!prefs || typeof prefs !== 'object') return true
  const v = (prefs as Record<string, unknown>)[channel]
  // explicit false = blocked. Anything else (missing key, true,
  // null, non-boolean) = allowed.
  return v !== false
}
