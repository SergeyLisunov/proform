# Landing mobile QA — W16 Day 82

> Static audit of landing components for mobile-first responsive correctness.
> Performed без live Lighthouse run (out of session capability) — same
> pattern as W15 Day 74 [[static pre-audit before live Lighthouse run]].

## Цель

Visitor должен видеть landing без horizontal scroll, без cramped text, без
overlapping elements на:

- iPhone SE (375×667)
- iPhone 14 Pro (393×852)
- Pixel 6 (412×915)
- iPad Mini (768×1024)
- Desktop 1280+

## Audit checklist

### Hero (W16 Day 79 rewrite + Day 78 base)
- [x] Single-column centered, max-w-4xl
- [x] Mobile-first padding `py-16 → sm:py-20 → lg:py-28`
- [x] H1 `clamp(2rem, 5.5vw, 4rem)` — scales smoothly viewport-wise
- [x] CTAs `flex-col sm:flex-row` — stack mobile, side-by-side desktop
- [x] CTAs `w-full sm:w-auto` — full-width mobile
- [x] Soft-conversion card `flex-col sm:flex-row` — stacks mobile
- [x] Value chips `flex-wrap justify-center gap-3` — wrap gracefully
- [x] Eyebrow chip readable at 320px (Building2 icon + текст fit)
- ⚠ Action: confirm на real iPhone SE 375×667 после deploy

### PainSection (W16 Day 79)
- [x] Grid `md:grid-cols-3` — 1 col mobile, 3 col tablet+
- [x] Cards rounded-3xl с consistent padding
- [x] Persona-coded icon hue (orange/blue/red)
- [x] Bridge link «смотреть как →» footer
- [x] Bridge anchor `#how-it-works` resolves к WorkflowSection

### AntiPositioningSection (W16 Day 79)
- [x] Grid `md:grid-cols-2` — 1 col mobile, 2×2 desktop
- [x] Strike-through icon visual works на mobile
- [x] Card content: «Почему не подходит» + «ProForm вместо» distinct
- [x] Text не overlaps strike-through line

### WorkflowSection (W16 Day 81 refactor)
- [x] 3 cards `lg:grid-cols-3` — vertical mobile, horizontal desktop
- [x] ArrowRight connectors `hidden lg:block` — only desktop, no mobile clutter
- [x] Number badge `pf-num text-5xl sm:text-6xl` — readable but не оверlapping content
- [x] Role-tagged bullets readable at mobile width

### RoleSection (W14 base, unchanged)
- ⚠ Currently 5 cards в grid — на mobile = 5 vertical stack
- ⚠ Action: consider horizontal carousel на mobile (W17+ enhancement)

### BeforeAfterSection (W16 Day 80)
- [x] Desktop `lg:grid-cols-[2fr_1fr_1fr]` — 3-col layout
- [x] Mobile stacks: topic header → Before card → After card
- [x] Mobile «До / После» inline labels visible (`lg:hidden`)
- [x] Cards icon + text properly aligned

### LeadMagnetSection (W16 Day 80 trim)
- [x] Featured card full-width, lg:flex-row для desktop split
- [x] Featured card mobile: icon top + content below (lg:flex-row)
- [x] Secondary 2 cards `sm:grid-cols-2` — stacked mobile, side-by-side tablet
- [x] «+3 ещё инструмента» chip footer wraps gracefully

### SocialProofSection (W16 Day 80)
- [x] Beta chip readable at 320px
- [x] 3 trust blocks `md:grid-cols-3` — stack mobile
- [x] Honesty note `max-w-3xl` — wraps without horizontal scroll

### BenefitsSection (W14 base, unchanged)
- ⚠ Currently 9 benefits в grid — на mobile = long scroll
- ⚠ Action: consider trim к 6 benefits + visual icons (W17+ enhancement)

### UseCasesSection (W16 Day 81 refactor)
- [x] 3 story cards `md:grid-cols-2 lg:grid-cols-3`
- [x] Persona avatar (initials + icon overlay) works at all sizes
- [x] Quote blockquote responsive
- [x] Outcome chip readable

### WearablesSection (W14 base)
- [x] 3 status chips wrap-friendly (flex-wrap gap)
- [x] Honesty footer readable

### PricingTeaserSection (W16 Day 81)
- [x] 3 pricing points `md:grid-cols-3` — stack mobile
- [x] Bottom CTA card `flex-col sm:flex-row` — stacks mobile
- [x] CTA button full readable at 320px

### SecuritySection (W14 base, unchanged)
- ⚠ Dark navy block с access matrix — needs visual confirmation at 320px
- ⚠ Action: spot-check matrix readability на real device

### FaqSection (W16 Day 82 expand)
- [x] Native `<details>` accordion — A11y free
- [x] 10 items (was 7, +3 W16 Day 82)
- [x] Single max-w-4xl column, no responsive issues
- [x] Summary + content padding consistent

### FinalCtaSection (W14 base)
- [x] CTAs responsive
- [x] Urgency line readable

### SiteFooter (W15 Day 75)
- [x] Logo + tagline + 2 link clusters
- [x] Mobile stacks vertical, desktop horizontal

### StickyNav (W14 base + W15 Day 74 a11y)
- [x] Logo + 2 CTAs
- [x] Mobile: logo icon-only (text hidden sm:block)
- [x] CTAs always visible
- [x] aria-label on logo for icon-only state

## Issues found (deferred к W17+ или Day 83)

| Section | Issue | Severity | Action |
|---|---|---|---|
| RoleSection | 5 cards = long mobile scroll | 🟡 medium | Consider horizontal scroll-snap carousel (W17+) |
| BenefitsSection | 9 benefits — wall of text mobile | 🟡 medium | Trim к 6, add icons (W17+) |
| SecuritySection | Access matrix readability на 320px | 🟢 low | Spot-check real device, fix if needed |
| Hero | Eyebrow chip 320px width fit | 🟢 low | Confirm post-deploy |
| All sections | Lighthouse Performance numerical baseline | 🟡 medium | Day 83 wrap — run on Vercel preview |

## Confirmed working (no action needed)

- Hero — single-column responsive, mobile-first padding
- Pain — 1→3 col grid stack
- AntiPositioning — 1→2 col stack
- Workflow (Day 81) — 1→3 col timeline, connectors desktop-only
- BeforeAfter — 3-col desktop, stacked mobile с inline labels
- LeadMagnet — featured + 2 secondary + 3 text links
- SocialProof — 3 trust blocks honest framing
- UseCases (Day 81) — 3 stories с personas
- PricingTeaser — 3 points + CTA card
- FAQ — native accordion 10 items
- Footer — single source of truth

## Post-deploy QA actions

Day 83 wrap will include:

- [ ] Open `https://proform-delta.vercel.app/` на iPhone SE size emulation (Chrome DevTools)
- [ ] Tab through entire page — no overflow, all focusables visible
- [ ] Open Hero audit modal — form fields fit без horizontal scroll
- [ ] Test all CTA navigations on mobile width
- [ ] Open `/admin/leads` as admin — verify `landing-audit-form` filter chip works
- [ ] Run Lighthouse Mobile + Desktop on `/` — document scores в `docs/landing-perf.md` run log
- [ ] PageSpeed Insights shareable URL — archive

## Run log

| Date | Viewport | Tested | Score | Notes |
|---|---|---|---|---|
| 2026-05-27 | Static class audit | All 16 sections | ✅ | Pre-deploy code review. Live QA Day 83 wrap. |
| TBD post-deploy | iPhone SE 375 | TBD | TBD | Manual emulation |
| TBD post-deploy | Pixel 6 412 | TBD | TBD | Manual emulation |
| TBD post-deploy | iPad Mini 768 | TBD | TBD | Manual emulation |
| TBD post-deploy | Desktop 1280 | TBD | TBD | Manual emulation |

## Links

- [W15 Day 74 — static pre-audit pattern](../knowledge/decisions/static%20pre-audit%20before%20live%20Lighthouse%20run.md)
- [W15 Day 73 — SEO foundation](/docs/sprints/W15-wrap.md)
- [Tailwind responsive design docs](https://tailwindcss.com/docs/responsive-design)
