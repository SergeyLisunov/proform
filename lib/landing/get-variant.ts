/**
 * lib/landing/get-variant.ts — W15 Day 77.
 *
 * Server-side variant reader. Called from RSC HeroSection (`/` page).
 *
 * Contract: middleware (lib/supabase/middleware.ts) гарантирует, что
 * cookie `pf-landing-ab` присутствует к моменту request попадает в page
 * render. Этот reader просто читает cookie и coerce'ит к valid variant.
 *
 * Defensive: если cookie отсутствует (middleware skipped — например,
 * direct server-side test), default to 'A' control.
 */
import { cookies } from 'next/headers'
import {
  coerceVariant,
  LANDING_VARIANT_COOKIE,
  type LandingVariant,
} from './variants'

export function getLandingVariant(): LandingVariant {
  const store = cookies()
  return coerceVariant(store.get(LANDING_VARIANT_COOKIE)?.value)
}
