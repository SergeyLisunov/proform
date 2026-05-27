# Landing performance & a11y baseline

> Living doc. Owned by W15 Day 74. Update on every landing-touching PR.

## Цель

Public landing (`/`) — first prospect-facing surface. Метрики качества
напрямую влияют на: conversion rate (Perf), SEO ranking (Perf + SEO),
доступность для assistive tech (A11y), безопасность (Best Practices).

## Tooling — как мерять

### 1. Lighthouse в Chrome DevTools (рекомендуется для dev)
```
DevTools → Lighthouse tab → Mobile + Desktop separately
→ Categories: Performance / Accessibility / Best Practices / SEO
→ Run на Vercel preview URL (НЕ на localhost — bundle размер другой)
```

### 2. PageSpeed Insights (для shared report)
```
https://pagespeed.web.dev/analysis?url=https://<vercel-preview>.vercel.app
→ Shareable URL, captures field data когда есть traffic
```

### 3. web.dev/measure (quick check)
```
https://web.dev/measure?url=https://<preview>
→ Same engine, friendly UI, lazy-by-default
```

## Target baselines (Day 74 launch)

| Категория | Mobile target | Desktop target | Acceptable floor |
|---|---|---|---|
| Performance | ≥ 85 | ≥ 95 | 70 / 85 |
| Accessibility | ≥ 95 | ≥ 95 | 90 |
| Best Practices | ≥ 95 | ≥ 95 | 90 |
| SEO | 100 | 100 | 95 |

### Core Web Vitals

| Метрика | Good (target) | Needs improvement |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5s – 4.0s |
| INP (Interaction to Next Paint) | < 200ms | 200ms – 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1 – 0.25 |

LCP element на нашей странице = `<h1>` в HeroSection ("Тренер, спортсмен…").

## Day 74 fix manifest (static pre-audit, без live Lighthouse run)

Эти исправления landed Day 74 **до** первого Lighthouse run потому что
они flag almost certainly будут:

| # | Категория | Issue | Fix |
|---|---|---|---|
| 1 | A11y | Skip-link отсутствует — Lighthouse SC 2.4.1 | New `<SkipToContent />` к `/` (target `#main-content`) |
| 2 | A11y | StickyNav logo Link — icon-only на mobile, no accessible name | `aria-label="ProForm — на главную"` + `<div aria-hidden>` на icon wrapper |
| 3 | A11y | StickyNav top container — нет landmark role | `<nav aria-label="Главная навигация">` |
| 4 | A11y | HeroSection decorative gradient orbs + mockup cards читались screen reader'ом как «div» | `aria-hidden="true"` на right-col composition |
| 5 | A11y | `/auth/login`, `/pricing`, `/legal/terms` — wrapper `<div>` вместо `<main>` | All 3 → `<main id="main-content">` |

## Known gaps (НЕ fixed Day 74 — deferred с rationale)

| Issue | Why deferred | Target sprint |
|---|---|---|
| `next/font` migration для Bebas Neue / DM Sans (CSS-loaded via `/assets/css/styles.css`) | Large refactor + risk to existing dashboards using same fonts. Need full font audit first. | W16+ |
| Bundle-size budget (`@next/bundle-analyzer` + CI gate) | Layer 7 на 6-layer CI defence model. Worth own PR. | W16 |
| Image optimization (если landing получит mockup screenshots в W15-W16) | Landing currently uses 0 raster images. N/A. | When images land |
| Real-user-monitoring (RUM) field data | Нужен Vercel Analytics или PostHog wiring. | W15 Day 76 |
| ARIA live regions для form submissions (login/pricing) | Out of W15 landing-perf scope. | W17+ |

## Audit checklist (для каждого landing-touching PR)

Перед merge любого PR, который трогает `/` или `components/landing/*`:

- [ ] Все icon-only Link/Button имеют `aria-label`
- [ ] Все decorative SVG/icons имеют `aria-hidden="true"`
- [ ] Page wrapper использует `<main id="main-content">` (НЕ `<div>`)
- [ ] Heading hierarchy: один `<h1>` per page, `<h2>` per section, `<h3>` per item внутри секции
- [ ] Color contrast `text-muted-foreground` на любом цветном bg проверен через DevTools color-picker
- [ ] CLS check: новые компоненты с image/video имеют explicit width/height
- [ ] Никаких `<img>` без `alt` (используем lucide-react SVG icons — already a11y-aware)
- [ ] Никаких bare `<button>` без visible text или `aria-label`
- [ ] Lighthouse Mobile run на Vercel preview → score не ниже floor outlined above

## Run log

| Date | URL | Mobile Perf | Mobile A11y | Mobile BP | Mobile SEO | Notes |
|---|---|---|---|---|---|---|
| TBD (post-Day 74 deploy) | https://proform-delta.vercel.app/ | — | — | — | — | First baseline. Fill после Vercel preview rebuilt с Day 74 changes. |
| TBD (post-W16 Day 83) | https://proform-delta.vercel.app/ | — | — | — | — | Landing fully rebuilt W16 (Days 78-83) — Hero anti-positioning, Pain, AntiPositioning, BeforeAfter, SocialProof, PricingTeaser sections added. Lighthouse run needed post-deploy с browser. |

## W16 sprint context (Day 83 update)

Landing structure после W16:

- 15 sections (was 9 после W15)
- 4 new client components: LeadCaptureForm, HeroAuditModal, BeforeAfterSection (no client state), SocialProofSection (no client state)
- 1 new API: `POST /api/leads/audit`
- 2 new email templates: user confirmation + admin notification
- A/B harness retired (Calculator widget preserved)
- Lead-magnet hierarchy: 1 featured + 2 secondary + 3 text links

**Perf concerns from W16 to verify в Lighthouse:**
- New section count = more HTML output. Verify First Load JS не bloated.
- `<dialog>` element + form в HeroAuditModal = additional client JS. Lazy-load potential.
- Email-template helpers — server-only, no client impact.
- Hero rebuild used identical CSS gradient pattern (W14 Day 71 origin) — no new heavy deps.

## Links

- [Lighthouse docs](https://developer.chrome.com/docs/lighthouse/overview/)
- [web.dev a11y guide](https://web.dev/learn/accessibility/)
- [WCAG 2.4.1 Bypass Blocks](https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks)
