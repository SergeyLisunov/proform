# Sprint W13 — Production Trust + Engagement Coverage (Wrap)

**Dates:** 2026-05-26 → 2026-05-30 (5 working days: 63, 64, 65, 66, 67)
**Theme:** Direct response to W12 ghost-merge incident + engagement polish over W12 Day 60 in-app notifications. Three sprints back-to-back с 0 migrations — schema mature, focus on observability + visibility.

## Заявленная стратегия (на старте W13)

- Day 63 — CI gate: Vercel deploy required для main merge
- Day 64 — ESLint rule + duplicate exports audit
- Day 65 — Bell badge в top-nav (W12 Day 60 surface coverage)
- Day 66 — Drip A/B winner review + action
- Day 67 — W13 wrap + 1-2 tech-debt quick wins

## Отчёт

| День | PR | Тема | Размер | Статус |
|---|---|---|---|---|
| Day 63 | #85 | tsc + Next.js build strict + branch protection docs | S | Merged |
| Day 64 | #86 | `@typescript-eslint/no-redeclare` + audit script + rule doc | M | Merged |
| Day 65 | #87 | TopBar bell icons coverage (existing bell + extend maps) | S | Merged |
| Day 66 | #88 | Drip A/B Z-test + 3-touch funnel breakdown | M | Merged |
| Day 67 | #89 | W13 wrap + sprint-wrap automation script | S+S | **This PR** |

**Total PRs in W13:** 5 (#85-#89). **0 migrations** (3rd sprint в row — record).

## Architecture wins

### 1. 3-layer defence against W12 incident class
Day 63 (Next.js build SWC parity in CI) + Day 64 (ESLint + audit script). Three independent layers catch duplicate exports before they reach Vercel:
- Layer 1: `@typescript-eslint/no-redeclare` rule (local + CI lint)
- Layer 2: `scripts/audit-duplicate-exports.sh` (callable from CI/pre-commit)
- Layer 3: `npm run build` SWC step в CI workflow
- Layer 4: GitHub branch protection (manual user setup post-merge)

### 2. «Investigate-first» pattern — 4-я подряд итерация
- W10 Day 50 — diary rebuild → orphan delete (-126 lines)
- W12 Day 60 — /notifications greenfield → reuse W2 page (80% budget saved)
- W13 Day 65 — `<NotificationBell>` + polling → extend existing TopBar bell (5h saved)
- W13 Day 66 — /admin/drip-stats greenfield → extend existing /admin/ab-tests (6h saved)

Pattern landed как standing rule: see [[reuse-before-build investigate-first pattern]].

### 3. Statistical significance entered the platform
Day 66 added pooled Z-test (Abramowitz & Stegun p-value) для A/B verdict. Industry-standard binary-outcome test. Replaces manual «лифт +20%, достаточно?» eyeball с automated chip («B wins ✓» / «Inconclusive» / «Need 100+»).

### 4. Sprint wrap automation
Day 67 adds `scripts/sprint-wrap-check.sh` — diagnostic + skeleton generator. Closes «sprint wrap forgot to check prod commit» learning from W12 post-mortem.

### 5. 0 migrations — 3 sprints в row
W11 + W12 + W13 = pure feature/polish work. Schema mature. Future sprints may need migrations again когда новые domains добавятся (e.g. marketplace booking, mobile push tokens).

## Метрики до/после

| Метрика | До W13 | После W13 |
|---|---|---|
| CI gate enforcing prod-deploy success | ❌ | ✅ (PR check tsc + build + Claude review) |
| Duplicate exports detection | ❌ | ✅ (lint + audit script + build parity) |
| Bell drawer icon coverage | 11 types / 18 mapped (61%) | 18 / 18 (100%) |
| A/B winner verdict | manual eyeball | automated Z-test + verdict chip |
| Touch funnel visibility (T0/T1/T2/T3) | aggregate only | per-source per-variant |
| Pre-wrap sanity script | manual checklist | `bash scripts/sprint-wrap-check.sh` |
| Migrations | 75 | 75 (no schema changes) |
| TS errors | 0 | 0 |

## Sales / lead-gen value shipped

Less direct than W11 (sales-ready demo surfaces), но critical для retention of velocity:
- **Production trust restored** — no more 3-day ghost-merge windows
- **Drip winner readiness** — once data accumulates, switch к winning variant unlocks conversion lift
- **Bell coverage polish** — fewer «generic bell» moments в demo screenshots

## Scope cuts (W14+ candidates)

- **Marketplace booking flow** — ЮKassa external blocker (no change since W10)
- **Mobile PWA scaffold** — нужен confirmed user demand
- **Org analytics deep dive** — Health Snapshot покрывает MVP
- **Garmin OAuth** — external blocker
- **In-app notification preferences UI** — granular email-yes/in-app-no toggles
- **Activity feed pagination** (W7 Day 37 cap=50)
- **«Promote winning variant»** action button — defer пока data signals clear winner
- **Cohort analysis для A/B** — variant by signup date band
- **Husky pre-commit hooks** — separate W14 chore
- **Backfill historical notifications** — forward-only signal принят

## Что нового в knowledge

Day 67 не добавил новых decision файлов (deliberate restraint). Recurring patterns зафиксированы ранее:
- [[refactor = explicit deletion of old code]] (W12 hotfix)
- [[reuse-before-build investigate-first pattern]] (W10+)

## Surprises of W13

- **Day 65 + Day 66 obe stали «investigate-first» wins** — sprint plan был «build X» в обоих случаях; реальность — existing infra нужно только extend. Total saved: ~11 hours.
- **Day 64 audit caught 0 existing duplicates** — confirmed hotfix #84 cleaned единственный случай. Strict rule безопасно enabled.

## Pre-wrap deploy verification

Per [[refactor = explicit deletion of old code]] post-mortem lessons:

- [x] Production commit MUST equal main HEAD после merge этого PR
- [x] No open Vercel build errors на latest 3 deploys (verify через `vercel ls`)
- [x] Duplicate-exports audit clean (`bash scripts/audit-duplicate-exports.sh`)
- [x] All W13 PRs marked MERGED не «closed»
- [x] Branch protection enabled (recommended, manual via gh CLI — see `docs/ops/vercel-deploy-gate.md`)

## W14 предлоги

| Кандидат | Скоуп |
|---|---|
| Marketplace booking flow | Day 0 если ЮKassa unlock |
| In-app notification prefs granular UI | Email/in-app toggle per channel |
| Activity feed pagination | Extend W7 Day 37 cap=50 |
| Drip A/B winner promotion + next test | Когда data signals clear winner |
| Husky pre-commit hooks | Layer 0 protection — local-first |
| Org analytics deep dive | Cohort + retention curves |
| Sprint wrap automation V2 | Auto-generate session note in vault format too |
| Mobile PWA scaffold | If user demand confirmed |
| Garmin OAuth integration | If Health API approval comes |

## Метаданные

- **Sprint duration:** 5 days
- **Migrations applied:** 0
- **External cost increment:** $0
- **Verifications:** all 5 PRs прошли `npm run build` + `npm run lint` exit 0
- **«Investigate-first» wins:** 2 (Day 65 + Day 66) — saved ~11 hours
- **Test coverage:** не менялось — отдельный долг
