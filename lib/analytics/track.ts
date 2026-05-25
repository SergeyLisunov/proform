/**
 * lib/analytics/track.ts — W15 Day 76.
 *
 * Typed wrapper над @vercel/analytics `track()`. Single source of truth
 * для event taxonomy на public surfaces.
 *
 * Зачем wrapper не raw `track(name, props)`:
 *   1. Event names typed как discriminated union — typo в name = compile
 *      error, не silent miss в dashboard
 *   2. Per-event props также typed (e.g. `landing.faq_open` requires
 *      `question` string) — нельзя забыть параметр
 *   3. Try/catch wraps SDK call — analytics никогда не должен ломать UX
 *   4. Single import path для всего проекта — easy to swap providers
 *      позже (PostHog, Plausible) без trawling каждый call site
 *
 * Naming convention: `<surface>.<element>_<action>` lowercase snake_case
 *   - `landing.hero_cta_primary_click`  — primary CTA on hero
 *   - `landing.faq_open` (props: question)
 *   - `pricing.tariff_buy_click` (props: tariff_code) — добавляется
 *     когда pricing tracking landed
 *
 * Vercel SDK auto-disables в development (NODE_ENV !== 'production'),
 * поэтому safe to call freely в local dev — счётчики не загрязняются.
 */
import { track } from '@vercel/analytics'

/**
 * Discriminated union для всех trackable events. Добавление нового
 * event = добавить variant сюда + emit call site.
 */
export type LandingEvent =
  | { name: 'landing.hero_cta_primary_click' }
  | { name: 'landing.hero_cta_demo_click' }
  | { name: 'landing.sticky_login_click' }
  | { name: 'landing.sticky_register_click' }
  | { name: 'landing.final_cta_register_click' }
  | { name: 'landing.final_cta_demo_click' }
  | { name: 'landing.faq_open'; question: string }

type EventProps = Record<string, string | number | boolean>

/**
 * Emit typed analytics event. Safe to call from client components —
 * SDK queues calls пока script loads, no race.
 *
 * @example
 *   trackEvent({ name: 'landing.hero_cta_primary_click' })
 *   trackEvent({ name: 'landing.faq_open', question: 'Сколько стоит?' })
 */
export function trackEvent(event: LandingEvent): void {
  try {
    const { name, ...rest } = event
    const props = Object.keys(rest).length > 0 ? (rest as EventProps) : undefined
    track(name, props)
  } catch {
    // Analytics никогда не должен ломать UX. Swallow ошибки SDK
    // (offline, blocked extension, и т.д.)
  }
}
