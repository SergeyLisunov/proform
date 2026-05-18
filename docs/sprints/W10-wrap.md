# Sprint W10 — Engagement Loops + Real Saves (Wrap)

**Dates:** 2026-05-18 → 2026-05-22 (5 working days: 48, 49, 50, 51, 52)
**Theme:** Закрыть feedback loops, начатые в W9 (reviews → response), и убрать оставшиеся demo-placeholder'ы (admin invite + diary cleanup).

## Заявленная стратегия (на старте W10)

- Day 48 — Coach response к reviews
- Day 49 — Athlete review prompt после exhaust pass
- Day 50 — Diary edit/save real flow
- Day 51 — Admin invite flow через Resend magic-link
- Day 52 — W10 wrap + 2 tech-debt quick wins

## Отчёт

| День | PR | Скоуп | Размер | Статус |
|---|---|---|---|---|
| Day 48 | #69 | `coach_response` + `coach_response_at` + inline reply UI | M | Merged |
| Day 49 | #70 | `<AthleteReviewPrompt>` + batched my-reviews lookup | M | Open |
| Day 50 | #71 | Removed orphan `CoachDiary` (audit found dead code) | S (-126 lines pure) | Open |
| Day 51 | #72 | `admin_user_invites` + endpoint + modal + list | L | Open |
| Day 52 | #73 | Register hook + stripe column drop + wrap doc | M | **This PR** |

**Total PRs landed in W10:** 5 (PR #69–#73).

## Поверхности и контракты

### Новые таблицы / колонки

- `coach_reviews.coach_response` + `coach_response_at` (W10 Day 48, migration 073). RLS: coach updates own.
- `admin_user_invites` (W10 Day 51, migration 074). RLS: admin-only ALL. UNIQUE token, status enum, 30d expiry.
- Dropped: `subscriptions.stripe_*`, `payments.stripe_*`, `invoices.stripe_*` (W10 Day 52, migration 075). Tech-debt cleanup from W6 RU/CIS pivot.

### Новые сервисы

- `services/coach-reviews.service.ts::replyToReview()` (W10 Day 48)
- `services/coach-reviews.service.ts::getMyReviewsByCoachIds()` (W10 Day 49 — batched lookup)
- `services/admin-invites.service.ts` (W10 Day 51 — list + revoke)

### Новые компоненты

- `components/athlete/AthleteReviewPrompt.tsx` (W10 Day 49) — inline form on `/athlete/passes`
- (UI extensions inside admin/page.tsx + diary/page.tsx)

### Новые routes

- `POST /api/admin/invite` (W10 Day 51) — create invite + send email
- `POST /api/admin/invite/claim` (W10 Day 52) — claim invite after signup

### Удалённый код

- `function CoachDiary()` (122 lines + import + 2 constants) — unreachable dead code from W7

## Метрики до/после

| Метрика | До W10 | После W10 |
|---|---|---|
| Reviews two-way (coach can reply) | ❌ | ✅ |
| Athletes prompted after exhausted pass | ❌ | ✅ |
| Admin can invite new users via UI | ❌ | ✅ |
| Demo close-modal placeholders from PR #63 | 4 | 0 (последний закрыт Day 51) |
| Dead `CoachDiary` orphan | exists (122 lines) | removed |
| Stripe legacy columns | 5 (across 3 tables) | 0 |
| Migrations | 72 | 75 |
| TS errors | 0 | 0 |
| Build status | ✅ | ✅ |

## Архитектурные решения W10

1. **Column on coach_reviews для coach_response** (not separate table) — 1:1 с review, MVP не нуждается в истории. ALTER позже если нужен multi-reply.
2. **Empty-trimmed response → null fields** — delete-by-empty pattern, no separate clearReply call.
3. **One-prompt-per-coach** на `/athlete/passes` — buying 3 passes от одного coach'а не порождает 3 prompt'а.
4. **Session-only dismissal** — «Позже» не permanent, reappears на next visit (light grace, no DB column needed).
5. **Distinct table `admin_user_invites`** vs reuse of `email_invites` — разные семантики (W3 invites = connections; W10 invites = onboarding new users).
6. **`admin` НЕ в target_role list** — admin privileges issued manually, защита от privilege escalation.
7. **Idempotent invite endpoint** — reuses pending invite для (email, role) pair → защита от spam-кликов.
8. **Token-only claim auth** — at signup time the new user isn't yet authenticated; token possession (from email Resend delivered) is the auth signal. Single-use enforced via `WHERE status='pending'` in update.

## Surprise of W10

**Day 50 was a 1-hour delete instead of a 1-day rebuild.** The «Сохранить запись» dead button from PR #63 audit lived inside an entire orphan component (`CoachDiary` function in `app/diary/page.tsx`) that was **never reached at runtime** — the real coach diary is `<CoachDiaryClient />` which already supports full CRUD via existing service. Day 50 reclaimed budget went to Day 52 wider scope (register hook + stripe cleanup + wrap doc).

## Risks / debt пройденные через W10

- ✅ Reviews были one-way → теперь two-way conversation
- ✅ Reviews recall captured at coldest moment (email N days later) → теперь captured fresh on /athlete/passes
- ✅ Admin не мог пригласить нового user'а через UI → теперь magic-link flow
- ✅ Stripe columns остались с W6 RU/CIS pivot → dropped
- ✅ Dead `CoachDiary` orphan → удалён

## Что НЕ вошло в W10 (явный scope cut)

- **Marketplace booking flow** — заблокирован ЮKassa Split Payments approval (external blocker). Когда unblock → W11 Day 0.
- **Mobile PWA** scaffold — отложен в W11+.
- **Email cron** to nudge unreviewed coaches after N days — Day 49 закрыл первичный prompt at /athlete/passes; cron-вариант когда понадобится.
- **Bulk invite** (CSV upload) — single-email at a time достаточно для admin scenarios.
- **Coach response email notification** к athlete — when coach replies, athlete получает email. Не критично пока маленький volume.

## Следующий sprint (W11) — предлагаемые темы

1. **Athletes list filter** (`/athletes`) — реальный фильтр по риску/готовности (PR #63 audit followup)
2. **Marketplace booking flow** — если ЮKassa Split Payments approval придёт
3. **Org analytics dashboard** — extend W7 funnel pattern для org-tier metrics
4. **Coach response email notification**  
5. **Garmin OAuth integration** — если Health API Partner Program approval придёт
6. **Athlete dashboard adherence widget** — pull recent nudges from `workout_nudges` (W8)
7. **Mobile PWA scaffold** — offline cache + push notifications (P2)

## Метаданные

- **Sprint duration:** 5 days
- **Migrations applied:** 073, 074, 075
- **External cost increment:** $0
- **Verifications:** все 5 PRs прошли `npm run build` exit 0
- **Test coverage:** не менялось — отдельный долг
