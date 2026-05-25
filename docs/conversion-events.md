# Conversion Events Taxonomy

> Living doc. Owned by W15 Day 76. Update when adding/removing tracked events.

## Что измеряем

Все public landing surfaces emit'ят typed events в Vercel Analytics. Цель:
данные для A/B тестов (Day 77+), funnel analysis, и data-driven copy
iterations без guessing.

## Tech stack

- **Vercel Analytics** — cookieless page views + custom events. GDPR-aligned,
  152-ФЗ compatible (без PII). Free tier на Hobby: 25K events/mo (Pro: 100K).
- **Vercel Speed Insights** — Real User Monitoring (Core Web Vitals из field
  data, не lab). Auto-collected, не requires custom events.
- **Wrapper:** `lib/analytics/track.ts` — typed `trackEvent()` с discriminated
  union для event names + props.

## Event taxonomy

### Landing CTA clicks

| Event | Where | Props | Conversion stage |
|---|---|---|---|
| `landing.hero_cta_primary_click` | HeroSection — primary CTA | `variant: 'A' \| 'B'` (W15 Day 77 A/B) | TOFU → conversion intent |
| `landing.hero_cta_demo_click` | HeroSection — demo CTA | `variant: 'A' \| 'B'` (W15 Day 77 A/B) | TOFU → exploration |
| `landing.sticky_login_click` | StickyNav — «Войти» (returning user) | — | RETURN |
| `landing.sticky_register_click` | StickyNav — «Создать аккаунт» (always-visible CTA) | — | CONSIDER → conversion intent |
| `landing.final_cta_register_click` | FinalCtaSection — «Создать организацию» | — | CONVERT (after full read) |
| `landing.final_cta_demo_click` | FinalCtaSection — «Demo как организация» | — | CONVERT (exploration) |

**Variant prop (W15 Day 77):** Hero CTA events carry `variant: 'A' | 'B'` for downstream A/B analysis. Variant assigned by middleware on first `/` visit via cookie `pf-landing-ab` (30-day persistence). См. `lib/landing/variants.ts` для current copy table, `/admin/landing-ab` для verdict calculator.

### Engagement

| Event | Where | Props |
|---|---|---|
| `landing.faq_open` | FaqSection — `<details>` expand | `question` (string) — раскрытый вопрос |

## Naming convention

`<surface>.<element>_<action>` lowercase snake_case.

- `<surface>` — page or section name (landing, pricing, dashboard)
- `<element>` — specific component (hero_cta, sticky_register, faq)
- `<action>` — user verb (click, open, close, submit)

Examples ✅:
- `landing.hero_cta_primary_click`
- `pricing.tariff_buy_click` (когда landed)
- `dashboard.workout_create_submit` (когда landed)

Anti-patterns ❌:
- `clicked_button` (no surface context)
- `hero` (no action)
- `Landing.HeroCTA` (wrong case)

## Type safety

Все events typed через `LandingEvent` discriminated union в
`lib/analytics/track.ts`. Adding event:

1. Add variant к union:
   ```ts
   export type LandingEvent =
     | { name: 'landing.new_event' }
     | { name: 'landing.new_event_with_props'; tariff_code: string }
   ```
2. Emit в component:
   ```ts
   import { trackEvent } from '@/lib/analytics/track'
   trackEvent({ name: 'landing.new_event' })
   ```

TypeScript забракует typo в name OR missing required prop.

## Wrapping convention

### Links → TrackedCtaLink
Replace `<Link href="...">` with `<TrackedCtaLink href="..." event={{...}}>`.
Server components могут импортировать — Next.js handles client/server boundary.

### Native `<details>` → TrackedFaqItem
Replace `<details className="...">` с `<TrackedFaqItem className="..." question="...">`.
Only fires event on **open** transition (curiosity), не на close (churn).

### Form submissions
**Не tracked в W15 Day 76** — login/register forms имеют existing redirect-based
flow что трудно instrument без race conditions. Day 77+ candidate когда нужна
auth funnel analysis.

## Dashboard query (Vercel Analytics)

1. Vercel Dashboard → ProForm project → **Analytics** tab
2. **Custom Events** subsection — list всех unique event names с counts
3. Click event → drill-down с filtering по UTM, country, page URL, etc.
4. **Speed Insights** tab — Core Web Vitals (LCP/INP/CLS) с percentile
   breakdown + page-by-page

### Useful queries для W17+ planning

- **Conversion funnel:** `hero_cta_primary_click` count / page views — top-of-funnel CTR
- **CTA placement test:** ratio of `hero_cta_*` vs `final_cta_*` clicks — какой CTA position работает лучше
- **FAQ engagement:** total `faq_open` count + top 3 questions — какие вопросы prospects больше всего интересуют
- **Demo vs register:** ratio of `*_demo_click` / `*_register_click` — exploration vs commitment ratio
- **Returning users:** `sticky_login_click` count / page views — на каком объёме returning traffic

## Privacy

- Vercel Analytics — **cookieless**, generates session ID through page fingerprint
  (hashed). Не identifies конкретного user.
- Speed Insights — sampled (~10% of sessions), aggregated.
- Both disclosed в `/legal/privacy` Section 3.

## Что НЕ tracked (deliberate)

| Surface | Reason |
|---|---|
| Login/register submits | Existing flow has redirect race; need refactor first |
| Pricing tariff selection | Day 77+ candidate когда will use данных для копи iteration |
| Footer link clicks | Low signal, добавим если drill-down нужен |
| RoleSection card clicks | Cards только display-only, не CTA |
| Mobile vs desktop scroll depth | Out of W15 scope; needs scroll observer |

## Run log

| Date | Event | Notes |
|---|---|---|
| 2026-05-26 | All taxonomy seeded | Day 76 deploy — first events начнут collect'ить после Vercel preview rebuild |

## Roadmap для events

| Sprint | Addition |
|---|---|
| W15 Day 77 | A/B variant tracking — `landing.hero_variant_view` props variant ID |
| W16 | Pricing surface events — `pricing.tariff_view` (intersection), `pricing.tariff_buy_click` |
| W16+ | Auth funnel events — `auth.register_step_complete` props step name |
| W17+ | Form-level events — login/register error reasons, drop-off step |
