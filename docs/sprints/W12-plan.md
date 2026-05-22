# Sprint W12 — Plan: «Operations Depth + Visibility»

**Proposed dates:** 2026-05-21 → 2026-05-25 (5 working days)
**Theme:** Завершить W10/W11 unfinished UI wiring + добавить operational visibility (in-app feed, PDF export) + один полноценный feature (in-app notifications surface).

## Стратегический выбор

После W11 у нас:
- ✅ 4 sales-ready demo surfaces shipped
- ✅ All PR #63 audit findings retired
- ✅ Review + retention loops замкнуты end-to-end
- 🟡 **Bulk invite endpoint** shipped, UI consumer отсутствует
- 🟡 **Health Snapshot** existing — но без PDF export для offline forward
- 🟡 **In-app notifications table** существует с W3 — но **никто не пишет в неё для review replies, mark-session, и т.д.**
- 🟡 **/admin/onboarding-funnel** показывает данные, но без pagination и filters

W12 закрывает эти 4 операционных gap'а + 1 visibility lever (PDF export).

## Дневной план

### Day 0 (contingent) — Marketplace booking flow

Только если ЮKassa Split Payments approval придёт в течение sprint window.

### Day 58 — Bulk invite UI consumer

**Goal:** Wire W11 Day 57 `/api/admin/invite/bulk` endpoint в admin modal.

**Что:**
- Extend existing admin invite modal с toggle «Single | Bulk»
- Bulk mode: textarea для newline-separated emails (CSV paste friendly)
- Submit → POST `/api/admin/invite/bulk` → render summary table:
    - `sent: 3`, `reused: 1`, `user_exists: 1`, `invalid: 0`, `failed: 0`
- Per-email status chips in result list
- Validate up to 50 emails client-side (matches server max)

**Размер:** S

### Day 59 — PDF export для Org Health Snapshot

**Goal:** Forwardable PDF — sales-rep emails one-pager к decision-maker'у без forcing их в систему.

**Что:**
- Option A (preferred): server-side render via Puppeteer или @react-pdf/renderer → returns PDF blob
- Option B (fallback): browser print stylesheet + ручная export через Cmd+P
- Если A — new route `GET /api/org/health/pdf` с auth + RLS check
- «Скачать PDF» button next to «Поделиться отчётом» на /org/health
- Snapshot date/time + watermark «Generated for {org_name} — RLS verified»

**Размер:** M (зависит от PDF lib choice)

### Day 60 — In-app notifications surface

**Goal:** Существующая `notifications` table (W3) под-используется. Wire 3 key event types:
- Coach reply → notification к athlete (parallel к Day 55 email)
- New review → notification к coach (parallel к /coach/passes surface)
- Pass session used → notification к athlete (confirmation)

**Что:**
- New service `services/in-app-notifications.service.ts` — lookup unread + mark-read
- New page `/notifications` — list view (server-rendered)
- Bell icon component для top nav с unread badge count
- Hook into 3 server-side write paths (existing endpoints) — write notification on event
- Mark-as-read на click / on visit

**Размер:** L (3 write hooks + new page + nav badge)

### Day 61 — /admin/onboarding-funnel pagination + filters

**Goal:** W7 Day 36 funnel показывает данные, но без pagination падает на больших объёмах.

**Что:**
- Cursor-based pagination (load-more pattern)
- Filter by role + by completion status
- Click-to-filter on event_type
- Sortable columns (created_at, current_step, role)

**Размер:** M

### Day 62 — W12 wrap + tech-debt quick wins

**Goal:** W12 retro + 1-2 picks from backlog.

**Что:**
- `docs/sprints/W12-wrap.md`
- Pick 1-2 from:
    - Drip cadence A/B winner review (если data сэйплов хватает)
    - Normalize `Offering.price_cents` scale (W8 workaround)
    - Activity feed pagination (extending W7 Day 37)
    - Email cron для unreviewed coaches (secondary nudge через 7d)
    - In-app notification preferences UI (parallel email/in-app toggle per channel)

**Размер:** S+S

## Что НЕ в W12 (явный scope cut)

- **Marketplace booking flow** — Day 0 contingent (ЮKassa external blocker)
- **Mobile PWA scaffold** — отложен в W13+, нужен confirmed user demand сначала
- **Org analytics deep dive** (cohort analysis, retention curves) — отдельный sprint W13+
- **Garmin OAuth** — external blocker (Health API Partner Program)
- **Multi-language email templates** — RU sufficient текущему рынку
- **Coach group sessions** (batch session marking) — W13+

## Pre-requisites для W12

| Item | Status |
|---|---|
| PR #74-#78 merged into main | ✅ Done |
| Vercel deploy from main | ✅ Auto-deployed |
| W11 wrap doc | ✅ Done |
| Resend Pro plan active | ✅ Done (W9 Day 0) |

## Архитектурные ставки

- **Day 58 modal toggle вместо separate page** — keep admin UI tight; single modal с mode-switch проще mental model для admin'а
- **Day 59 server-side PDF preferred** — clipboard/print fallback fragile across browsers; native PDF = consistent forward
- **Day 60 reuse existing `notifications` table** — W3 schema уже подходит, не нужны migrations. Backfill: только новые events (no retroactive notifications)
- **Day 61 cursor pagination, не offset** — proper для funnel scale (~10k onboarding events за месяц)

## Risks

| Risk | Mitigation |
|---|---|
| Day 59 PDF lib choice = big install / bundle size | Lazy-import — PDF generation runs in route handler only, не shipped в browser bundle |
| Day 60 backfill confusion: athletes don't see old events | Acceptable — notifications are forward-only signal; messaging «новые события появятся здесь» на empty state |
| ЮKassa approval приходит в середине sprint'а | Day 58/59 не блокируют — pause + переключиться на booking flow, потом вернуться |

## Метрики целевые

| После W12 | Цель |
|---|---|
| Endpoint coverage UI | 100% (bulk invite UI закроет последний gap) |
| Forwardable formats для Health Snapshot | 2 (URL + PDF) |
| In-app notification surfaces | 3 (coach reply / new review / pass used) |
| Admin funnel scale-ready | ✅ Pagination + filters |

## W13 предлоги

- Marketplace booking (if ЮKassa)
- Org analytics deep dive
- Mobile PWA scaffold
- Coach group sessions
- Garmin OAuth (if Health API approval)
- Drip A/B winner action
- Activity feed pagination
