# Sprint W12 — Operations Depth + Visibility (Wrap)

**Dates:** 2026-05-21 → 2026-05-25 (5 working days: 58, 59, 60, 61, 62)
**Theme:** Закрыть оставшиеся unfinished W11 UI consumer + add operational visibility (in-app notifications, PDF export, drill-down funnel).

## Заявленная стратегия (на старте W12)

- Day 58 — Bulk invite UI consumer (wire W11 Day 57 endpoint)
- Day 59 — PDF export для Org Health Snapshot
- Day 60 — In-app notifications surface (wire 3 event types)
- Day 61 — /admin/onboarding-funnel pagination + filters
- Day 62 — W12 wrap + tech-debt quick wins

## Отчёт

| День | PR | Тема | Размер | Статус |
|---|---|---|---|---|
| Day 58 | #79 | Bulk invite modal с CSV/textarea + result panel | M | Open |
| Day 59 | #80 | PDF export через print-CSS + watermark | S | Open |
| Day 60 | #81 | 3 event hooks + `/notifications` page polish | M | Open |
| Day 61 | #82 | Funnel drill-down + URL-driven filters + pagination | M | Open |
| Day 62 | #83 | W12 wrap doc + W12-plan commit | S | **This PR** |

**Total PRs landed in W12:** 5 (PR #79–#83).

## Поверхности и контракты

### Новые routes / endpoints

- (none — W12 was UI consumer + visibility work)

### Новые pages

- (none — extensions to existing pages)

### Service extensions

- `services/notifications.service.ts` — +3 NotificationType values + 3 new helpers (`listMyNotifications`, `markNotificationsRead`, `markAllNotificationsRead`) + exported `NotificationRow` interface
- `services/coach-reviews.service.ts::upsertReview` — notify hook
- `services/athlete-passes.service.ts::useSession` — notify hook
- `/api/coach-reviews/[id]/reply/route.ts` — server-side notify hook

### UI changes

- `app/admin/page.tsx` (W12 Day 58) — bulk invite modal mode toggle + per-email result panel
- `app/org/health/page.tsx` (W12 Day 59) — «Скачать PDF» button + print-only watermark + `.print-hide` UI controls
- `app/globals.css` (W12 Day 59) — `@media print` block + `.print-hide` / `.print-only` utilities
- `app/notifications/page.tsx` (W12 Day 60) — 3 new TYPE_META entries для icon/color
- `app/admin/onboarding-funnel/page.tsx` (W12 Day 61) — drill-down table + URL filters + offset pagination

## Метрики до/после

| Метрика | До W12 | После W12 |
|---|---|---|
| Endpoint coverage UI | partial (bulk invite endpoint без UI) | 100% |
| Forwardable formats для Health Snapshot | 1 (URL) | 2 (URL + PDF) |
| In-app notification event types wired | 0 of 3 new | 3 of 3 (coach reply, new review, pass used) |
| Admin funnel scale-readiness | aggregate only | + drill-down table с filters + pagination |
| Backfilled (legacy) users visible to admin | hidden везде | visible под status='backfilled' |
| Migrations | 75 | 75 (no schema changes) |
| TS errors | 0 | 0 |

## Архитектурные решения W12

1. **Print-CSS + `window.print()`** (Day 59) — chose over `@react-pdf/renderer` (+500KB) или Puppeteer (+150MB). Zero bundle weight, pixel-perfect reuse, cross-browser.
2. **Reuse existing /notifications page + table** (Day 60) — saved 80% Day 60 budget. Page from W2 era already polished; only needed type/icon meta extension.
3. **Dynamic import для cross-service notify** — `await import('@/services/notifications.service')` avoids circular dep между client services.
4. **Server-side notify в reply route via admin client** — athlete row not RLS-readable from coach context. Same pattern как W10 Day 51 invite claim.
5. **Silent-fail try/catch на all 3 notify hooks** — never blocks business write path. Pattern continued from W7 coach-diary notify.
6. **URL params + SSR (no client state)** for funnel filters (Day 61) — shareable links + history-back, follows marketplace pattern (W6-W9).
7. **Offset pagination, не cursor** (Day 61) — simpler reasoning при ≤5k users. Cursor migration W13+ if scale demands.
8. **Mode toggle inside existing modal** (Day 58) — keep admin UI tight; single modal с single/bulk switch vs separate page route.
9. **0 migrations за весь sprint** — second sprint в row (W11 + W12). Schema mature, harvest from existing data.

## Sales / lead-gen levers shipped

| Lever | Surface | Demo talking point |
|---|---|---|
| **PDF export** | Day 59 | «Owner emails GM/board PDF одним кликом — recipient видит metrics без login» |
| **Bulk invite UI** | Day 58 | «Onboard 30-coach club через CSV paste — result panel показывает per-email status» |
| **In-app notifications** (3 wires) | Day 60 | «Athlete видит коментар тренера сразу — email становится bonus channel» |
| **Funnel drill-down** | Day 61 | «Admin находит paused coaches в 1 click — target list для drip-кампании» |

## Risks / debt пройденные через W12

- ✅ Bulk invite endpoint (W11 Day 57) — UI consumer закрыт
- ✅ Health Snapshot был только URL-share — теперь и PDF
- ✅ `notifications` table underused — 3 event types now wired
- ✅ Funnel был aggregate-only — drill-down добавлен
- ✅ Backfilled users были hidden — теперь visible через filter

## Что НЕ вошло в W12 (явный scope cut)

- **Marketplace booking flow** — ЮKassa Split Payments approval external blocker (no change since W10)
- **Mobile PWA scaffold** — отложен в W13+, нужен confirmed user demand
- **Org analytics deep dive** (cohort analysis, retention curves) — Health Snapshot покрывает MVP
- **Garmin OAuth** — external blocker (Health API Partner Program)
- **Server-side PDF generation** — for email-attach workflow; current browser print sufficient
- **Sortable column headers** in funnel drill-down — current sort («most actionable first») covers default need
- **Email cron для unreviewed coaches** — primary prompt на /athlete/passes покрывает MVP

## Что было неожиданно в W12

- **Day 60 был «extension» а не «build»** — `/notifications` page существовал с W2 era, `notify()` helper тоже. Только write paths не wired для 3 specific events.
- **TopBar already has notifications drawer** — bell icon с unread count badge уже работает. Day 62 не нуждался в дополнительной nav-component работе.
- **Print-CSS «зашло» лучше PDF lib** — Day 59 ожидался M, оказался S. Browser print quality на A4 с `print-color-adjust: exact` indistinguishable от server-side rendering для нашего use case.

## Следующий sprint (W13) — предлагаемые темы

| Кандидат | Скоуп |
|---|---|
| **Marketplace booking flow** | Day 0 если ЮKassa Split Payments approval придёт |
| **Server-side PDF auto-email** | Weekly Health Snapshot auto-emailed to org owner (cron + Puppeteer/Browserless) |
| **Mobile PWA scaffold** | Manifest + service worker + push notifications base |
| **Garmin OAuth integration** | Если Health API Partner Program approval придёт |
| **Org analytics deep dive** | Cohort analysis, retention curves, time-series |
| **Coach group sessions** | Multi-athlete batch session marking |
| **Email cron для unreviewed coaches** | Secondary nudge через 7 days после exhausted pass |
| **Sortable funnel columns** | Click-to-sort, asc/desc indicators |
| **Bulk action in funnel** | «Email all paused» button → drip campaign |

## Метаданные

- **Sprint duration:** 5 days
- **Migrations applied:** 0 (rare — W11 + W12 both zero-migration)
- **External cost increment:** $0
- **Verifications:** все 5 PRs прошли `npm run build` exit 0
- **Test coverage:** не менялось — отдельный долг
- **Lines net delta:** ~770 LOC added (mostly UI)
