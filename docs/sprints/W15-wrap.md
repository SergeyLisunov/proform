# Sprint W15 wrap — Landing Measure + Trust Pages

> Closed 2026-05-26. PRs #96–#100. 0 migrations (5th sprint в row — record extended).

## Tagline

«W14 построил landing. W15 сделал его discoverable, fast, audit-ready,
legally complete, и measured. Public marketing surface превратился в
measured conversion engine с typed event taxonomy и A/B framework.»

## Контекст до W15

После W14:
- ✅ Public `/` landing live (9 sections + footer)
- ❌ Нулевой SEO — no metadata, no sitemap, no robots, no OG image
- ❌ Lighthouse baseline неизвестен — нет skip-link, нет main landmark на 3 страницах
- ❌ Footer ссылается в никуда — `/about` `/contacts` `/privacy` все 404
- ❌ Никакого conversion tracking — клики по CTA не измеряются
- ❌ Никакого A/B framework — copy iteration основан на guessing

W15 закрыл все 5 gap'ов через **0 migrations**.

## Day-by-day

| Day | PR | Тема | Скоуп / Ключевая идея |
|---|---|---|---|
| **73** | #96 | SEO foundation | metadataBase + title template + WHOOP fix в meta + sitemap.xml (5 URLs) + robots.txt (25+ disallows) + dynamic og-image (1200×630 at edge) + per-route metadata для 4 client pages через server layout wrappers |
| **74** | #97 | Lighthouse pass | Static pre-audit без live run: `<SkipToContent />` skip-link + `<main id="main-content">` на 3 client pages + StickyNav `aria-label` + `<nav>` landmark + HeroSection decorative `aria-hidden` + `docs/landing-perf.md` baseline procedure |
| **75** | #98 | Footer pages | 3 new public pages (`/about` `/contacts` `/legal/privacy`) — 152-ФЗ-aligned + extracted `<SiteFooter>` shared + `<StaticPageShell>` wrapper + sitemap → 8 URLs |
| **76** | #99 | Conversion tracking | `@vercel/analytics` + `@vercel/speed-insights` mounted + typed `trackEvent()` wrapper с discriminated union + 7 events instrumented (6 CTAs + FAQ) + privacy policy updated + taxonomy doc |
| **77** | #100 | Hero A/B harness + W15 wrap | Cookie-based variant assignment в middleware + variant copy в `lib/landing/variants.ts` + variant-aware HeroSection + `/admin/landing-ab` dashboard + Z-test extracted к `lib/stats/ztest.ts` + Calculator client widget + W15 wrap doc |

## Architecture wins

### 1. SEO foundation как single source of truth
`metadataBase` set один раз в root layout, OG image URLs resolve cross-host автоматически. Title template `%s · ProForm` означает subpages устанавливают только свою часть. Stack scales — adding 4th public page = ~30 lines metadata.

### 2. App Router metadata pattern — server layout wrappers
Client components (`'use client'`) не могут export `metadata`. Решение: minimal 4-line server layout wraps each client page (`/auth/login/layout.tsx`, `/auth/register/layout.tsx`, `/pricing/layout.tsx`). Cheaper чем refactoring к RSC.

### 3. Static pre-audit before live Lighthouse
Day 74 ship 5 fixes которые ANY landing audit flag'нет first без waiting на browser Lighthouse run. «Pre-audit-first» pattern — applied baseline-clean changes до того, как numerical baseline measured. Saves cycle.

### 4. SiteFooter — single source of truth для navigation
Extracted from `app/page.tsx` to `components/layout/SiteFooter.tsx`. 4 pages (landing + 3 static) consume same component. Adding new footer link = edit 1 file.

### 5. StaticPageShell — DRY для static surfaces
3 new pages (Day 75) использовали shared shell. Adding 4-я static page (e.g. `/faq`, `/security-disclosure`) = ~80 lines page.tsx, no layout boilerplate.

### 6. Typed analytics taxonomy через discriminated union
`LandingEvent` discriminated union в `lib/analytics/track.ts` — typo в event name = compile error, не silent miss. Required props (e.g. `question` для FAQ, `variant` для hero CTAs) — TypeScript enforces caller.

### 7. Wrapper component pattern для tracking
`TrackedCtaLink` / `TrackedFaqItem` keep tracking isolated. Provider swap (Vercel → PostHog → Plausible) = edit 2 wrappers, не 7 landing components.

### 8. Middleware-based A/B assignment, cookie-only
Day 77 A/B harness — variant assigned в `lib/supabase/middleware.ts` на first `/` visit, persisted 30 дней через cookie. **No DB schema change** (preserving 5-sprint zero-migration streak). HeroSection reads cookie via `cookies()` from `next/headers`, renders variant copy from single source of truth (`lib/landing/variants.ts`).

### 9. Z-test extraction для cross-page reuse
`pooledZTest` was inlined в `app/admin/ab-tests/page.tsx` (W13 Day 66). Day 77 extracted к `lib/stats/ztest.ts` shared lib — same math, two consumers now (`/admin/ab-tests` drip-email A/B + new `/admin/landing-ab` Hero copy A/B). Pattern: extract math primitives на second use.

### 10. «Что НЕ tracked» / «Что НЕ обещаем» как design discipline
Both Day 75 (`/about` «Что не обещаем») и Day 76 (`docs/conversion-events.md` «Что НЕ tracked») explicitly list deliberate cuts с rationale. Continues W14 «honest framing» convention applied к product surfaces.

## Метрики до/после

| Метрика | До W15 | После W15 |
|---|---|---|
| Public marketing landing | ✅ (W14) | ✅ |
| SEO metadata (title/desc/OG) | ❌ stub + WHOOP в meta | ✅ comprehensive, WHOOP removed |
| sitemap.xml | ❌ | ✅ 8 URLs |
| robots.txt | ❌ | ✅ allow public + disallow 25+ auth-required |
| Dynamic OG image | ❌ | ✅ 1200×630 next/og edge runtime |
| Per-route metadata | 0 | 5 (`/`, `/auth/login`, `/auth/register`, `/pricing`, `/legal/terms`) + 3 W15 new pages |
| `<main>` landmarks | 1 of 4 public pages | 4 of 4 |
| Skip-link | ❌ | ✅ via `<SkipToContent />` |
| Decorative `aria-hidden` | partial | comprehensive |
| Public footer pages | 0 (`/legal/terms` only) | 4 (`/about`, `/contacts`, `/legal/terms`, `/legal/privacy`) |
| Vercel Analytics | ❌ | ✅ mounted, 7 events |
| Vercel Speed Insights | ❌ | ✅ mounted (field data start collecting post-deploy) |
| Typed event taxonomy | ❌ | ✅ discriminated union, 7 variants |
| A/B framework | drip-email only (W13) | + landing Hero copy (W15) |
| Admin A/B surfaces | 1 (`/admin/ab-tests`) | 2 (+ `/admin/landing-ab`) |
| Migrations | 75 | 75 (5th sprint в row без schema changes — record extended) |
| TS errors | 0 | 0 |
| 0-migrations streak | 4 sprints | **5 sprints** |

## Что нового в knowledge

W15 candidates для new vault notes (post-wrap save session):
- «cookie-based A/B variant assignment в middleware — zero-DB pattern»
- «App Router metadata через server layout wrappers для client pages»
- «App Router OG image через next/og — единая Hero brand surface»
- «Static pre-audit before Lighthouse — fix high-confidence issues без waiting на live run»
- «Wrapper components изолируют analytics concern для provider portability»
- «Honest framing convention extended за product copy — «что НЕ tracked», «что НЕ обещаем»»
- «Extract math primitive на second use — Z-test refactor pattern»

## Surprises of W15

### 1. Whoop остался в `<meta description>` после W14 Day 68 stale-string surgery
W14 Day 68 успешно убрал WHOOP из visible HTML, но 2-line stub `app/layout.tsx` metadata содержал «с поддержкой данных WHOOP» в description. Не появилось в W14 grep потому что grep was visual-content focused. Day 73 caught + fixed как часть SEO refresh. **Lesson:** grep also `metadata` blocks в layout.tsx файлах, не только JSX.

### 2. Day 74 принципиально нельзя shipped с live Lighthouse data
Lighthouse requires browser + live preview URL — out of session capability. Решение: static pre-audit fixes которые ANY audit flagнет first + `docs/landing-perf.md` baseline procedure для post-deploy capture. **Pattern:** ship deterministic-safe fixes Day 74, fill numerical baseline Day 77 wrap or async.

### 3. Static pages share footer = unexpected cleanup win
Day 75 plan was «3 new pages + shared shell». Extraction `<SiteFooter />` was bonus — но превратилось в SSoT для всех 4 prospect-facing pages. Adding footer link сейчас = 1 file edit. **Pattern:** if a piece of UI лежит в 2+ pages, extract immediately, не «когда-нибудь refactor».

### 4. Vercel Analytics + Speed Insights — zero-cookie privacy без cookie banner
Important для RU/CIS market — нет legal requirement в opt-in cookie banner для Vercel Analytics. Это unlock'нуло simpler privacy story в `/legal/privacy` Section 3.

### 5. A/B harness landed без DB schema change
Initial design instinct was «add `landing_ab_assignment` table — variant per session_id». Cookie-based assignment removes DB hop entirely. Tradeoff: variant data ephemeral (cookies могут быть cleared), но **acceptable для marketing copy A/B** где decision happens on aggregate dashboard data, не per-user retroactive analysis. Preserved 5-sprint zero-migration streak.

## Не реализовано (deliberate cuts to W16+)

| Cut | Why W15 | Target sprint |
|---|---|---|
| Lighthouse numerical baseline filled в `landing-perf.md` | Requires live Vercel preview rebuild post-deploy | Day 78 follow-up или W16 |
| `next/font` migration (Bebas Neue / DM Sans) | Large refactor + risk to dashboards using same fonts | W16+ |
| Bundle-size budget + CI gate (Layer 7) | Own PR — methodology + CI config | W16 |
| Husky pre-commit hooks (Layer 0) | Own PR — local-first protection | W16 |
| Form-level events (login/register error reasons) | Existing redirect race needs refactor first | W17+ |
| Mobile PWA scaffold | Wait until landing получит meaningful traffic | After traffic |
| Multi-language email infra | No demand signal yet | Conditional |

## Pre-wrap deploy verification

Used Day 67 sprint-wrap-check.sh script (W13 automation):

- [x] All 5 W15 PRs MERGED (not «closed»)
- [x] Production commit alignment confirmed
- [x] No Vercel build errors на latest deploys
- [x] Duplicate exports audit clean
- [x] WHOOP grep across project except `whoop` integration code + docs — 0 occurrences in user-facing surfaces

## Verification matrix (post-deploy QA — Day 78 follow-up)

- [ ] `curl https://<preview>/sitemap.xml` → valid XML с 8 URLs
- [ ] `curl https://<preview>/robots.txt` → expected allow/disallow rules
- [ ] `curl https://<preview>/opengraph-image` → 1200×630 PNG
- [ ] Open Graph debugger (https://www.opengraph.xyz) на preview → image renders
- [ ] Twitter Card validator → summary_large_image preview works
- [ ] View `/auth/login` page source → title contains «Войти · ProForm»
- [ ] Tab через `/` — skip link появляется first focusable
- [ ] Click landing CTA → verify event в Vercel Analytics tab
- [ ] Open FAQ item → verify `landing.faq_open` с question prop
- [ ] Cookie inspector — verify `pf-landing-ab` set на first `/` visit
- [ ] Refresh page 10× — variant остаётся consistent (cookie persistence)
- [ ] Lighthouse Mobile run → fill `landing-perf.md` run log
- [ ] PageSpeed Insights shareable URL → archive в docs

## W16 candidates (живые после W15)

| Кандидат | Скоуп |
|---|---|
| **Lighthouse baseline filled + perf fixes** | Run on `/` preview, address Performance/A11y findings, document в `landing-perf.md` |
| **next/font migration** | Bebas Neue + DM Sans через `next/font/google` или local. Eliminate render-blocking CSS font fetch. |
| **Bundle-size budget + CI gate (Layer 7)** | `@next/bundle-analyzer` + per-route budget + CI enforcement |
| **Husky pre-commit hooks (Layer 0)** | Local lint/build/type before push — catch issues до PR cycle |
| **Pricing tariff conversion tracking** | `pricing.tariff_view` (intersection observer) + `pricing.tariff_buy_click` (props: tariff_code) |
| **Marketplace booking flow** | Day 0 priority если ЮKassa Split Payments unlock пришёл |
| **OG-image variants per route** | Pricing-specific OG, About-specific OG (currently inherit от root) |
| **Multi-language email infra** | Conditional — only если sales targeting non-RU |

## Связанные

- [[2026-06-04 Sprint W14 закрыт]] ← W14: landing rebuild + trust polish
- [[honest roadmap framing]] ← W14 pattern, extended through W15 Day 75 «что НЕ обещаем»
- [[reuse-before-build investigate-first pattern]] ← W12 pattern, applied на Day 77 (Z-test extraction)
- [[Sprint W16 план]] ← следующий sprint
