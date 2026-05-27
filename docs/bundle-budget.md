# Bundle-Size Budget — Layer 7 CI Defence

> Living doc. Owned by W17 Day 86. Update when adding routes or
> intentionally raising budget.

## Цель

Prevent accidental bundle bloat from reaching production. Каждый route
имеет explicit **First Load JS budget** (в kB). If a PR pushes any route
over its budget, `npm run check:bundle` fails — blocking merge через CI.

Builds on W15 Day 74 [[static pre-audit before live Lighthouse run]] pattern
applied к performance: ship enforcement before numerical Lighthouse data
arrives.

## Layer 7 в CI defence model

Extends W13 6-layer model к **8 layers** (with W17 Day 87 Husky = Layer 0):

| Layer | Defence | Scope | Catches |
|---|---|---|---|
| 0 | Husky pre-commit (W17 Day 87) | Local | Broken commits до push |
| 1 | ESLint (next lint) | CI + local | Style + a11y + react-hooks rules |
| 2 | TypeScript compile (tsc) | CI + local | Type errors |
| 3 | Duplicate-exports script | CI + npm | W12 ghost-merge class |
| 4 | Branch protection | GitHub | No merge без passing checks |
| 5 | Vercel build SWC parity | CD | Local-only-passing PRs caught |
| 6 | sprint-wrap-check.sh | Manual sprint-end | Production commit alignment |
| **7** | **bundle-budget-check.mjs (this)** | **CI + npm** | **Accidental bundle bloat** |

## Budget table (W17 Day 86 baseline)

Budget = First Load JS per route, в kB. Values selected с 20-30% headroom
over current measured baseline (allows minor additions без trigger).

### Public marketing surfaces (perf-critical)

| Route | Budget | Why |
|---|---|---|
| `/` | 200 kB | Landing — primary conversion surface. Hero + 15 sections. |
| `/about` | 130 kB | Static page. Mostly text. |
| `/contacts` | 130 kB | Static page. Contact form layout. |
| `/legal/terms` | 120 kB | Static text-only. |
| `/legal/privacy` | 130 kB | Static text-only. |
| `/pricing` | 180 kB | Client component — tariff fetch + filtering. |

### Public auth

| Route | Budget | Why |
|---|---|---|
| `/auth/login` | 200 kB | Form + 5 demo accounts + validation |
| `/auth/register` | 200 kB | Form + role selection |

### Public lead-magnet tools

| Route | Budget | Why |
|---|---|---|
| `/tools/team-risk` | 140 kB | Form + result display |
| `/tools/adaptive-plan` | 140 kB | Form + AI result display |
| `/tools/club-audit` | 140 kB | Form + dashboard-style output |
| `/tools/medical-summary` | 140 kB | Multi-step form |
| `/tools/acwr` | 140 kB | Calculator с chart |
| `/tools/overtraining` | 140 kB | 10-question wizard |

### SEO infrastructure

| Route | Budget | Why |
|---|---|---|
| `/sitemap.xml` | 20 kB | Auto-generated. Should be ~0. |
| `/robots.txt` | 20 kB | Auto-generated. Should be ~0. |
| `/opengraph-image` | 20 kB | Edge-rendered. |

### Default (auth-required + dynamic)

| Scope | Budget | Why |
|---|---|---|
| All other routes | **250 kB** | Auth-required surfaces (admin/dashboard/coach/athlete/org/doctor/settings/...) have heavier client state + tables + charts. More generous, но not unbounded. |

### Hard ceiling

| Scope | Limit | Why |
|---|---|---|
| ANY route | **400 kB** | Catches case где developer добавил generous budget (500 kB) что should never ship. Independent guard. |

## How to run

### Locally — verify before push
```bash
npm run check:bundle
```
Runs `next build` + parses output + checks against budget. Exits 1 на violation.

### Skip build (faster iteration)
```bash
npm run build           # capture output
SKIP_BUILD=1 node scripts/bundle-budget-check.mjs
```

### Visualize bundle composition
```bash
npm run analyze
```
Wraps build с `@next/bundle-analyzer` — generates HTML reports в
`.next/analyze/` showing chunk composition per route. Use это чтобы
identify WHAT's bloated when budget violated.

### CI — automatic
Run via `npm run check:bundle` step в CI workflow (W18+ когда GitHub
Actions wired). Vercel build already includes implicit check через build
output что surfaces sizes.

## How to raise budget (with discipline)

If a route legitimately needs more space:

1. **Investigate first** — `npm run analyze` → identify biggest chunks
2. **Try shrink before raise** — dynamic import? lazy boundary? smaller lib?
3. **If raise необходим** — update BUDGET_KB map + this table + commit message documenting why
4. **Code review** — reviewer asks «what justifies +X kB?» as standard question

Anti-pattern: silently bumping budget to "make CI pass". Каждый bump
должен be documented + reviewed.

## Adding new routes

When new route lands:

1. Run `npm run build` локально
2. Note route's First Load JS column from build output
3. Add к BUDGET_KB map в `scripts/bundle-budget-check.mjs` с 20-30% headroom
4. Update budget table в this doc
5. Commit both files together

Routes без explicit entry fall under `_default` (250 kB). Caught когда
new route exceeds.

## Run log

| Date | Trigger | Routes checked | Violations | Notes |
|---|---|---|---|---|
| TBD post-Day 86 deploy | Initial CI gate landing | TBD | — | First баseline run. Budget map calibrated against current main. |
| TBD post-Day 84+85 merge | Re-baseline expected | TBD | — | After perf wins land, baseline lower. Update budget map с new headroom если significant deltas. |

## Related

- W13 Day 64 — `audit-duplicate-exports.sh` (Layer 3 sibling)
- W13 Day 65 — branch protection docs (Layer 4 sibling)
- W17 Day 84 — next/font migration (perf win, separate from budget)
- W17 Day 85 — LeadCaptureForm lazy-load (chunk split, will lower / budget)
- [[layered CI defence — each layer catches independently]] (origin pattern)
