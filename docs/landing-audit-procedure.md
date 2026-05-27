# Landing Visual Audit — Procedure

> Added W18 Day 90. Multi-viewport screenshot capture via Playwright.
> Closes 4-sprint gap (W15-W17) where browser-required visual verification
> consistently deferred.

## Why

User feedback («landing выглядит криво на mobile») requires actual visual
verification, не just static class audit. Earlier sprints documented
mobile-QA procedures but lacked tooling для real screenshot capture.

Day 90 ships `scripts/audit-landing.mjs` — standalone Playwright script
что captures full-page screenshots across 5 viewports × 6 routes (30
images total per run).

## Setup (one-time)

```bash
# Chromium binary (если ещё не installed)
npx playwright install chromium
```

Project уже has `@playwright/test` в devDependencies (W14 E2E setup).

## Usage

### Against production
```bash
npm run audit:screenshots
```
Defaults к `https://proform-delta.vercel.app`.

### Against local dev server
```bash
npm run dev                       # in one terminal
LANDING_URL=http://localhost:3000 npm run audit:screenshots
```

### Against Vercel PR preview
```bash
LANDING_URL=https://proform-delta-pr-N.vercel.app npm run audit:screenshots
```

## Output

Screenshots saved к `.screenshots/` (gitignored, regenerable):

```
.screenshots/
├── mobile-iphone-se__landing.png       (375×667 + full-page)
├── mobile-iphone-se__about.png
├── mobile-iphone-se__pricing.png
├── mobile-iphone-se__contacts.png
├── mobile-iphone-se__legal-terms.png
├── mobile-iphone-se__legal-privacy.png
├── mobile-pixel-6__landing.png         (412×915)
├── ... etc ...
├── tablet-ipad-mini__landing.png       (768×1024)
├── desktop-1280__landing.png           (1280×800)
└── desktop-1440__landing.png           (1440×900)
```

Naming: `{viewport-name}__{route-slug}.png`

## Viewports covered

| Name | Dimensions | Purpose |
|---|---|---|
| `mobile-iphone-se` | 375×667 | Smallest common mobile (most cramped layout) |
| `mobile-pixel-6` | 412×915 | Mid mobile (most common Android) |
| `tablet-ipad-mini` | 768×1024 | Tablet breakpoint transition |
| `desktop-1280` | 1280×800 | Standard desktop (most common) |
| `desktop-1440` | 1440×900 | Premium displays |

## Routes covered

- `/` — landing (15 sections)
- `/about` — О платформе
- `/pricing` — Тарифы
- `/contacts` — Контакты
- `/legal/terms` — Условия использования
- `/legal/privacy` — Политика конфиденциальности

Adding routes: edit `ROUTES` array в `scripts/audit-landing.mjs`.

## Workflow

### Iterating on visual quality

1. **Capture baseline:**
   ```bash
   npm run audit:screenshots
   cp -r .screenshots .screenshots-before
   ```

2. **Make visual changes** в `components/landing/*` или `app/page.tsx`.

3. **Re-capture после fix:**
   ```bash
   npm run audit:screenshots
   ```

4. **Compare visually** — open both `.screenshots-before/` и `.screenshots/`
   в Finder side-by-side OR use macOS Preview's multi-image view.

5. **Iterate** OR ship.

### Against Vercel PR preview (validate before merge)

1. Push PR, wait для Vercel preview build (1-2 min)
2. Get preview URL from PR comment
3. Run:
   ```bash
   LANDING_URL=https://proform-delta-pr-N.vercel.app npm run audit:screenshots
   ```
4. Review screenshots — если visually OK, merge PR.

## Lighthouse runs (Day 91+)

Lighthouse Mobile + Desktop runs still TBD across W15-W18 wraps. Options:

### Option 1: Lighthouse CLI
```bash
npx lighthouse https://proform-delta.vercel.app/ \
  --output html \
  --output-path .lighthouse/landing-mobile.html \
  --form-factor mobile \
  --chrome-flags='--headless'
```

### Option 2: PageSpeed Insights API
```bash
curl 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://proform-delta.vercel.app&strategy=mobile' \
  | jq '.lighthouseResult.categories'
```

### Option 3: web.dev/measure
- Manual run, shareable URL
- https://web.dev/measure?url=https://proform-delta.vercel.app

Pick what's fastest для current session.

## Common visual issues to look for

When reviewing `.screenshots/*` после run:

| Issue | Where to check | Fix location |
|---|---|---|
| H1 wraps awkwardly | `mobile-iphone-se__landing.png` Hero | `components/landing/HeroSection.tsx` |
| Sections look cramped | All mobile screenshots, vertical scroll | Padding pattern (`py-16 → sm:py-20 → lg:py-24`) |
| Cards overlap или have wrong spacing | All viewports | Tailwind gap-N classes |
| Text overflow horizontal scroll | Mobile screenshots | Container max-width, overflow handling |
| Buttons too small для touch | Mobile screenshots, interactive areas | Min 44×44px tap target |
| Color contrast issues | Any dark-on-dark или light-on-light | WCAG AA+ (4.5:1 normal text) |
| Misaligned grid items | Tablet/desktop screenshots | Tailwind grid-cols-N classes |

## Performance baseline

Capture timing: ~30 seconds для full 5 viewports × 6 routes = 30 screenshots.
Network throttling not applied (production CDN sufficient).

## Integration с CI (future, W19+ candidate)

Could add к GitHub Actions:
```yaml
- name: Visual audit
  run: |
    npx playwright install chromium --with-deps
    LANDING_URL=${{ env.VERCEL_PREVIEW_URL }} npm run audit:screenshots
    # Upload .screenshots/ as workflow artifact
```

Day 90 ships local-only — CI integration W19+ when GitHub Actions workflow lands.

## Related

- `scripts/audit-duplicate-exports.sh` — W13 Day 64 (CI Layer 3)
- `scripts/bundle-budget-check.mjs` — W17 Day 86 (CI Layer 7)
- `docs/landing-perf.md` — W15 Day 74 (Lighthouse procedure — still TBD numerical)
- `docs/landing-mobile-qa.md` — W16 Day 82 (static class audit, predecessor)
- `docs/bundle-budget.md` — W17 Day 86 (Layer 7 reference)
