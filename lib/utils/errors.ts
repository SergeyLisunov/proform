/**
 * lib/utils/errors.ts — W21 audit fix (catch-any cleanup).
 *
 * Safely extract a user-facing message from an unknown caught value. Replaces
 * `catch (e: any) { ... e.message ... }` — which shows "undefined" in the UI
 * when a non-Error is thrown — with typed `catch (e: unknown)` narrowing.
 */
export function getErrorMessage(e: unknown, fallback = 'Произошла ошибка'): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string' && e.trim()) return e
  return fallback
}
