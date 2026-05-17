# Sprint W9 — Coach Economy Operational + Social Proof (Wrap)

**Dates:** 2026-05-14 → 2026-05-17 (5 working days: 43, 44, 45, 46, 47)
**Theme:** Закрыть buy → manage → USE → discover loop для coach-economy + добавить social proof (отзывы + verified badge).

## Заявленная стратегия (на старте W9)

- Day 43 — useSession UI binding (закрыть use-loop)
- Day 44 — coach reviews (social proof: UGC rating)
- Day 45 — verified coach badge (social proof: admin-issued trust)
- Day 46 — marketplace sort by rating + verified filter (discovery)
- Day 47 — dashboard polish + W9 wrap

## Отчёт

| День | PR | Скоуп | Статус |
|---|---|---|---|
| Day 0 | #61 | Regen `types/database.ts` + Resend Pro ops note | Merged |
| Day 0 | #62 | Cleanup 11 latent TS errors revealed by #61 | Merged |
| (pre) | #63 | Clickability audit — 9 dead buttons + /legal/terms | Merged |
| Day 43 | #64 | `/coach/passes` page + `listMyIssuedPasses()` service | Merged |
| Day 44 | #65 | `coach_reviews` table, write form, marketplace rating badges | Merged |
| Day 45 | #66 | `is_verified` column + admin tab + VerifiedBadge component | Готов к merge |
| Day 46 | #67 | `OfferingSort.rating_desc` + `verifiedOnly` filter + UI chip | Готов к merge |
| Day 47 | #68 | CoachReputationCard + AthleteDiscoverCTA + empty-state polish + wrap doc | **Этот PR** |

**Total PRs landed in W9:** 8 (PR #61–#68).

## Поверхности и контракты

### Новые таблицы / колонки

- `coach_reviews` (W9 Day 44) — `(coach_id, athlete_id, rating 1..5, comment, created_at, updated_at)`. UNIQUE per pair. RLS: read open, write own.
- `coach_review_summary` VIEW (W9 Day 44) — батч-агрегат avg+count для marketplace.
- `users.is_verified` + 3 meta-колонки (W9 Day 45). Sparse partial index. RLS: admin-only UPDATE.

### Новые сервисы

- `services/athlete-passes.service.ts::listMyIssuedPasses()` (W9 Day 43)
- `services/coach-reviews.service.ts` — list/upsert/delete + batched summaries (W9 Day 44)
- `services/admin-verifications.service.ts` — admin list + toggle (W9 Day 45)
- `services/marketplace.service.ts::OfferingSort+verifiedOnly` (W9 Day 46)

### Новые компоненты

- `components/ui/VerifiedBadge.tsx` — 3 size presets, reusable
- `components/profile/CoachReviewsBlock.tsx` — write form + list on profile
- `components/coach/CoachReputationCard.tsx` — coach dashboard self-view
- `components/athlete/AthleteDiscoverCTA.tsx` — empty-state CTA when 0 connections

### Новые страницы

- `/coach/passes` (W9 Day 43) — coach use-session UI

### Tab additions

- `/admin` → «Верификация» tab (W9 Day 45)

## Метрики до/после

| Метрика | До W9 | После W9 |
|---|---|---|
| Buy → USE loop работает | ❌ (UI отсутствовал) | ✅ |
| Trust signals на marketplace | 0 | 2 (rating + verified) |
| Способов discovery на marketplace | role/type/specialty/price/format | + rating_desc sort + verified filter |
| Coach видит свою репутацию | ❌ | ✅ (новая reputation card) |
| Athlete без коучей попадает в funnel | ❌ | ✅ (discover CTA) |
| Migrations | 70 | 72 |
| Routes | ~101 | ~102 (`/coach/passes`) |
| TS errors | 0 | 0 |
| Build status | ✅ | ✅ |

## Архитектурные решения W9

1. **Coach-side useSession, не self-use** — защита от мошенничества; RLS-policy `athlete_passes_coach_all` enforce'ит на уровне БД.
2. **VIEW, не materialized** для `coach_review_summary` — на сотнях отзывов copy-on-read дешевле maintenance. Переход на MV при росте >10k.
3. **Two-axis trust** — `rating` (UGC, 5 звёзд) + `verified` (admin, binary). Не пересекаются.
4. **Sparse partial index** на `is_verified=true` — только ~5% юзеров будут verified, индекс остаётся крошечным.
5. **Rating-sort client-side, verified-filter server-side** — `coach_pass_plans`/`coach_services` не имеют rating-колонки (сложный join); `users.is_verified` доступен в 1 round-trip.
6. **Optimistic-lock pattern** в `useSession()` (с W8) обеспечивает atomic decrement без serializable transactions.

## Risks / debt пройденные через W9

- ✅ `useSession()` сервис без UI consumer'а (pre-W9 audit findings) → closed Day 43
- ✅ Нет trust signals на marketplace (закладка для conversion) → closed Day 44+45
- ✅ Нет приоритизации в marketplace (browser-only, no relevance) → closed Day 46
- ✅ Coach не видит свою репутацию (миссинг feedback loop) → closed Day 47

## Что НЕ вошло в W9 (явный scope cut)

- Self-claim verification flow (athlete-side request с document upload) → W11+
- Materialized view с trigger refresh → когда >10k отзывов
- «Featured + rating» combined sort → не нужен, featured уже отдельный carousel
- Coach response к отзывам → W10+

## Следующий sprint (W10) — предлагаемые темы

1. **Diary edit/save flow** — закрыть демо-режим из PR #63
2. **Admin user invite flow** — magic-link через Resend
3. **Coach response к reviews** — диалог под каждым отзывом
4. **Athlete filter `/athletes`** — реальный фильтр по риску/готовности
5. **Marketplace booking flow** — заявка → coach approval → ЮKassa link
6. **Подсчёт + графика engagement** в org dashboard

## Метаданные

- **Sprint duration:** 5 days
- **Migrations applied:** 071, 072
- **External cost increment:** $0 (no new infra; Resend Pro switch was W9 Day 0 prerequisite)
- **Verifications:** все 5 PRs прошли `npm run build` exit 0
- **Test coverage:** не менялось (нет unit-тестов в проекте — отдельный долг)
