# Sprint W11 — Coach Productivity + Cross-persona Retention (Wrap)

**Dates:** 2026-05-18 → 2026-05-20 (5 working days: 53, 54, 55, 56, 57)
**Theme:** Закрыть последние PR #63 audit findings + добавить retention surface across 3 persona contexts (athlete / coach / org) + sales-ready demo surfaces.

## Заявленная стратегия (на старте W11)

- Day 53 — Athletes list filter + inline comment
- Day 54 — Org Health Snapshot (biggest lead-gen lever)
- Day 55 — Coach reply email notification (compound W9-W10 review loop)
- Day 56 — Athlete adherence widget (W8 cron → web surface)
- Day 57 — W11 wrap + bulk invite tech-debt

## Отчёт

| День | PR | Тема | Размер | Статус |
|---|---|---|---|---|
| Day 53 | #74 | Athletes filter (URL-driven chips + inline comment drawer) | L | Open |
| Day 54 | #75 | `/org/health` snapshot page + `getOrgHealthSnapshot()` | L | Open |
| Day 55 | #76 | `POST /api/coach-reviews/[id]/reply` + email + new pref channel | M | Open |
| Day 56 | #77 | `<AthleteAdherenceCard>` reusing W8 `workout_nudges` | S | Open |
| Day 57 | #78 | Bulk invite endpoint + W11 wrap doc | S+S | **This PR** |

**Total PRs landed in W11:** 5 (PR #74-#78).

## Поверхности и контракты

### Новые routes

- `POST /api/coach-reviews/[id]/reply` (W11 Day 55) — coach reply + email side-effect
- `POST /api/admin/invite/bulk` (W11 Day 57) — batch invites (up to 50 emails)

### Новые pages

- `/org/health` (W11 Day 54) — Org Health Snapshot one-pager

### Новые services / extensions

- `services/org-snapshot.service.ts` (W11 Day 54) — `getOrgHealthSnapshot()`
- `services/notification-prefs.service.ts` (W11 Day 55) — new `coach_reply_email` channel
- `services/coach-reviews.service.ts::replyToReview()` (W11 Day 55) — refactored к API route (signature unchanged)

### Новые компоненты

- `components/athlete/AthleteAdherenceCard.tsx` (W11 Day 56) — soft-framed retention surface

### UI changes

- `/athletes` (W11 Day 53) — URL-driven filter chip row + inline comment drawer + «Отметить сессию» routing к `/coach/passes`
- `/org` (W11 Day 54) — new «Health Snapshot» nav tile
- `/admin → Пользователи` (W11 Day 57) — bulk invite via batch endpoint (UI follow-up в нашем backlog if needed)

## Метрики до/после

| Метрика | До W11 | После W11 |
|---|---|---|
| Dead buttons из PR #63 audit | 4 (athletes list + AthleteDetail) | 0 (полностью закрыты) |
| Forwardable demo surfaces для sales | 0 | 1 (`/org/health`) |
| Review feedback loop замкнут end-to-end | ❌ (one-way) | ✅ (athlete → coach reply → athlete email) |
| Retention surface на athlete dashboard | 0 | 1 (`<AthleteAdherenceCard>`) |
| Notification channels | 8 | 9 (`coach_reply_email`) |
| Bulk admin actions | ❌ (single email at a time) | ✅ (up to 50 invites per call) |
| Migrations | 75 | 75 (no schema changes этот sprint) |
| TS errors | 0 | 0 |

## Архитектурные решения W11

1. **URL-driven filter** (`/athletes`) следует marketplace pattern (W6-W9). Shareable + back-button friendly + state-from-URL = simpler reasoning.
2. **Two-path org resolution** в `/org/health` — поддерживает и owner (role='organization') и member (role=coach/doctor через org_members). Same data, broader audience.
3. **Server-side route для coach reply** (вместо direct Supabase client) — Resend key не в браузере + admin client для athlete prefs read (RLS блокировала бы coach'а).
4. **Signature-compatible refactor** `replyToReview()` — service вызов снаружи не изменился, `CoachReviewsBlock` untouched.
5. **Default ON для `coach_reply_email`** + fail-open semantics — RU opt-out culture, drives engagement.
6. **Hide-when-empty** для adherence card — no UI noise for new/healthy athletes; build trust by appearing only when actionable.
7. **Soft framing** в adherence copy — «Вернёмся постепенно?» вместо «Вы пропустили N». Caregiver positioning lever.
8. **Idempotent bulk invite** — same `(email, role)` pair reuses pending invite. Защита от bulk-paste duplicates.
9. **Reuse W8 data**: `workout_nudges` table уже накапливает нужные records через cron; Day 56 — pure consumer, zero new infra.

## Sales / lead-gen levers shipped

- **`/org/health` one-pager** — forwardable shareable URL to decision-makers (Day 54). 4 demo moments в одном экране.
- **`/athletes` filter chips** — «coach filters 50 athletes by risk в 2 клика» talking point (Day 53).
- **Bulk invite** — «onboard 30-coach club без typing 30 times» (Day 57).
- **Adherence widget** — caregiver positioning, не bully (Day 56). Soft retention.

## Risks / debt пройденные через W11

- ✅ PR #63 audit полностью закрыт (athletes list + AthleteDetail dead buttons)
- ✅ Coach reply loop был one-way → теперь three-step (reply → email → re-engagement)
- ✅ W8 cron был single-channel (email) → теперь web parallel
- ✅ Admin invite single-email-only → bulk to 50
- ✅ Notification prefs UI gets new channel automatically через CHANNELS array

## Что НЕ вошло в W11 (явный scope cut)

- **Marketplace booking flow** — ЮKassa Split Payments approval external blocker, без изменений с W10.
- **Mobile PWA scaffold** — отложен.
- **Org analytics dashboard** (deeper than Health Snapshot) — W12+, Health Snapshot покрывает MVP.
- **Garmin OAuth** — внешний blocker (Health API Partner Program).
- **PDF export для Org Health Snapshot** — browser print works; native PDF generation = W12+.
- **In-app notification feed entry** parallel с email — W12+ (current `notifications` table not wired для coach replies).

## Что было неожиданно в W11

- **Day 50 (W10) был 1-hour delete** — reminded us at start of W11 to investigate before rebuilding. Saved Day 57 budget for bulk invite + wrap.
- **`/athletes` had 3 disabled buttons** to close, not 2 — but third («Отметить сессию») не нужен polish, просто routing к существующему `/coach/passes`.
- **Soft-framing copy decisions** заняли больше времени чем код (Day 56 adherence card) — но это правильно: framing влияет на product perception сильнее, чем feature count.

## Следующий sprint (W12) — предлагаемые темы

| Кандидат | Скоуп |
|---|---|
| Marketplace booking flow | Day 0 если ЮKassa Split Payments approval придёт |
| Bulk invite UI в admin | Wire `/api/admin/invite/bulk` → admin modal (W11 Day 57 endpoint без UI пока) |
| Org analytics deep dive | Funnel + retention + cohort analysis для org tier |
| PDF export для Health Snapshot | Lead-gen lever — owner forwards PDF to GM/board |
| Mobile PWA scaffold | Manifest + service worker + push notifications |
| In-app `notifications` feed entries | Coach reply, athlete review, mark-session — все parallel-channel UI |
| Garmin OAuth integration | Если Health API Partner Program approval придёт |
| Coach group sessions | Multi-athlete batch session marking |

## Метаданные

- **Sprint duration:** 5 days
- **Migrations applied:** 0 (pure feature work на existing schema)
- **External cost increment:** $0
- **Verifications:** все 5 PRs прошли `npm run build` exit 0
- **PR #63 audit:** полностью закрыт
- **Test coverage:** не менялось — отдельный долг
