# Sprint W13 — Plan: «Production Trust + Engagement Coverage»

**Proposed dates:** 2026-05-26 → 2026-05-30 (5 working days)
**Theme:** Direct response to W12 post-mortem incident («3 дня ghost-merged») + долговременные engagement polish items от W12 Day 60. Не вводим новых migrations — продолжаем harvest mode (3 sprint'а подряд без schema changes).

## Стратегический выбор

После W12 у нас:
- ✅ 9 PR'ов задеплоены (hotfix #84 unlocked 8 ghost-merged)
- 🟡 Main branch **БЕЗ branch protection** — incident может повториться завтра
- 🟡 W12 Day 60 wired in-app notifications, но пользователь не видит count без visit /notifications
- 🟡 W7 Day 35 drip A/B test работает 4+ weeks — winner decision pending

W13 закрывает trust gap (3 дня production blind) + добавляет visibility surface поверх W12 работы.

## Дневной план

### Day 0 (contingent) — Marketplace Booking Flow

Только если ЮKassa Split Payments approval придёт в течение sprint window.

### Day 63 — CI Gate: Vercel Deploy Required для main merge

**Goal:** Закрыть «merged ≠ deployed» trust crisis. Sufficient: PR не может слиться без зелёного Vercel build + tsc + lint.

**Что:**
- Update `.github/workflows/code-review.yml` — drop `continue-on-error: true` from TS check; add `npm run build` step (catches SWC-level duplicate exports что tsc может пропустить)
- Document GitHub branch protection setup в `docs/ops/vercel-deploy-gate.md`
- Add runbook `docs/ops/debug-red-vercel-build.md`
- Don't auto-set protection — это workflow change, user approves manually через gh CLI

**Размер:** S

### Day 64 — ESLint Rule + One-shot Duplicate Exports Audit

**Goal:** Catch W11 Day 55 «insert-near-old» pattern locally before push.

**Что:**
- Custom ESLint rule (или `eslint-plugin-import` с `no-duplicate-exports` strict) для detecting duplicate `export function X` в same file
- One-shot full scan всех services + app dirs для existing duplicates
- Add to `npm run lint` pre-commit hook
- Document rule + rationale в `docs/ops/duplicate-exports-rule.md`

**Размер:** M (custom rule может потребовать AST writing + tests)

### Day 65 — Bell Badge в top-nav (W12 Day 60 surface coverage)

**Goal:** W12 Day 60 wired in-app notifications, но user не видит signal без явного visit. Bell badge = always-visible.

**Что:**
- New client component `<NotificationBell>` — periodic poll `getUnreadCount()` (10s)
- Embed в existing top-nav / sidebar
- Badge показывает count если >0; click → `/notifications`
- Optional: subtle animation на новый signal

**Размер:** M

### Day 66 — Drip A/B Winner Review + Action

**Goal:** W7 Day 35 запустил 3-touch drip A/B. К W13 sample size должен быть достаточным.

**Что:**
- Service helper `getDripABStats()` — counts per variant per source
- Admin section `/admin/ab-tests` (extend existing)
- Decision threshold: ≥100 sends per variant per source, statistical significance
- Если winner — switch default в cron route
- Optional: launch next A/B (B vs C)

**Размер:** M

### Day 67 — W13 Wrap + 2 tech-debt quick wins

**Goal:** W13 retro + 2 picks from backlog.

**Что:**
- `docs/sprints/W13-wrap.md`
- Pick 2 from:
  - Normalize `Offering.price_cents` scale (W8 workaround — still pending)
  - Email cron для unreviewed coaches (secondary nudge через 7d)
  - In-app notification preferences UI (email-yes / in-app-no toggle)
  - Activity feed pagination (W7 Day 37 cap=50)
  - Sprint wrap automation (CLI команда что runs `vercel ls` + `git log` + generates wrap.md skeleton)

**Размер:** S+S

## Что НЕ в W13 (явный scope cut)

| Тема | Почему |
|---|---|
| Marketplace booking | ЮKassa external blocker (Day 0 contingent only) |
| Mobile PWA scaffold | Нужен confirmed user demand сначала; P3 |
| Org analytics deep dive | Health Snapshot покрывает MVP; cohort/retention = W14+ |
| Garmin OAuth | External blocker (Health API Partner Program) |
| Coach group sessions | Multi-athlete batch UI — W14+ |
| Multi-language email | Нужно когда sales targeting non-RU |

## Pre-requisites для W13

| Item | Status |
|---|---|
| All W11/W12 PRs merged + deployed | ✅ После hotfix #84 |
| Production верифицирована на актуальном commit | ✅ `19b24b6` Ready |
| Vault обновлён W12 + post-mortem | ✅ |

## Архитектурные ставки

- **Day 63 GitHub branch protection** проще чем custom Vercel webhook — leverages existing infra
- **Day 64 custom ESLint rule** — `eslint-plugin-import::no-duplicate-exports` ловит re-exports но не duplicate function decls в одном файле; custom rule нужен
- **Day 65 client-side polling 10s** — простой; upgrade к Supabase Realtime в W14+ если нужно
- **Day 66 defer A/B continuation если data NOT enough** — лучше honest «sample too small» chip чем premature decision

## Risks

| Risk | Mitigation |
|---|---|
| Day 63 branch protection breaks team merge workflow | Document migration path; manual activation; ensure admin override |
| Day 64 custom ESLint rule complex | Fallback: grep-based pre-commit hook (less polished но functional) |
| Day 65 polling waste bandwidth | 10s = 6 req/min — acceptable. Upgrade Realtime если volume растёт |
| Day 66 A/B data insufficient | Defer winner decision, ship dashboard для visibility |
| ЮKassa unblock mid-sprint | Pause Day 65 OR Day 66 → Day 0 marketplace booking |

## Метрики целевые

| После W13 | Цель |
|---|---|
| «Merged ≠ deployed» risk | ❌ → ✅ (CI gate blocks duplicate-export bug class) |
| Visible in-app notification signals | URL-only → bell badge + URL |
| Drip A/B test status | running (winner unknown) → decision OR «need more data» chip |
| Duplicate exports в codebase | unknown → audited, 0 |

## W14 предлоги

- Marketplace booking (если ЮKassa)
- Supabase Realtime для notifications
- Multi-language email infra
- Org analytics deep dive
- Mobile PWA scaffold
- Coach group sessions
- /admin/users CRUD edit/suspend
