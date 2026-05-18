# Sprint W10 — Plan: «Engagement Loops + Real Saves»

**Proposed dates:** 2026-05-18 → 2026-05-22 (5 working days)
**Theme:** Закрыть feedback loops, начатые в W9 (reviews → response), и убрать оставшиеся demo-placeholder'ы (diary save, admin invite).

## Стратегический выбор

После W9 у нас:
- ✅ Coach economy buy→use→sell loop работает
- ✅ Social proof (reviews + verified) на месте
- ✅ Discovery (sort + filter) на месте
- 🟡 Reviews **односторонние** — coach не может ответить
- 🟡 Несколько UI с «demo close-modal» вместо реального save (после W9 audit)
- 🟡 Athletes без coaches попадают в discovery CTA, но flow дальше прерывается на marketplace booking (Split Payments всё ещё заблокирован)

W10 закрывает эти три gap'а через короткие 1-day tasks.

## Дневной план

### Day 48 — Coach response к reviews

**Goal:** Каждый отзыв позволяет тренеру (subject) оставить **один** ответ. Ответ виден всем.

**Что:**
- Migration 073: `coach_review_replies` table или просто колонка `coach_response TEXT` + `coach_response_at TIMESTAMPTZ` на `coach_reviews`
- Service: `replyToReview(reviewId, response)` — only by `coach_id`
- UI: внутри `<CoachReviewsBlock>` показать reply под отзывом; форма ответа для coach's own reviews

**Размер:** S (1 миграция, 1 файл сервиса, edit 1 компонента)

### Day 49 — Athlete review prompt после использования сессии

**Goal:** Когда athlete видит что pass exhausted (used_sessions >= total_sessions), показать prompt «Оцените тренера» с pre-filled данными.

**Что:**
- Edit `app/athlete/passes/page.tsx` — в expired section показывать banner если для coach'а нет review от current athlete
- Reuse существующий write-form из `<CoachReviewsBlock>` (extract как `<InlineReviewForm>` если не вынесен)
- Optional: cron что отсылает email через 3 дня после exhaust pass

**Размер:** M (small migration optional, 1 component refactor, page edit)

### Day 50 — Diary edit/save real flow

**Goal:** Close demo placeholder from PR #63. Athlete может сохранить запись в дневник реально (создание + редактирование).

**Что:**
- Migration 074 (если нужна — проверить existing schema; вероятно есть `observation_diary` или `athlete_diary` table)
- Service `services/athlete-diary.service.ts` (если ещё нет): createEntry, updateEntry, listMyEntries
- Wire реальный save в `app/diary/page.tsx::1200` button (сейчас close-modal demo)
- Wire edit для pencil icon на line 1174

**Размер:** M (schema check + service + 2 UI edits)

### Day 51 — Admin invite flow

**Goal:** Close demo placeholder from PR #63. Admin может пригласить нового пользователя через email magic-link.

**Что:**
- Route `POST /api/admin/invite` — принимает email + role, отсылает magic-link через Resend
- Admin UI tab «Пользователи» → enable button «Новый пользователь» (сейчас disabled)
- Modal: email + role select; submit → success toast + список pending invites
- Optional: store pending invites в `email_invites` table (existing W3 pattern)

**Размер:** M (1 API route + UI edit + Resend template)

### Day 52 — W10 wrap + tech debt cleanup

**Goal:** W10 retrospective + 2 quick wins from backlog.

**Что:**
- `docs/sprints/W10-wrap.md`
- Pick 2 from:
  - `stripe_*` columns drop в users/subscriptions tables
  - Normalize `Offering.price_cents` scale (W8 workaround → unified cents)
  - Mobile PWA manifest + service worker scaffold
  - Coach response email notification (когда athlete leaves review → coach gets email)

**Размер:** S+S

## Что НЕ делаем в W10 (явно)

- **Marketplace booking flow** — заблокирован ЮKassa Split Payments approval (внешний). Когда unblock'нется — W11 Day 0.
- **Garmin live OAuth** — ждём Health API approval (3-6 недель). Independent track.
- **Mobile native iOS** — P3.
- **Org analytics dashboard** — отдельный sprint W11+.

## Pre-requisites

- ✅ W9 PRs #66, #67, #68 должны быть merged до старта W10 Day 48 (Day 48 затрагивает CoachReviewsBlock — конфликт неприемлем)
- ✅ Resend Pro switched (cron volume comfort)

## Архитектурные ставки

- **coach_response как колонка**, не отдельная таблица — 1:1 association с review, не нужна история (если pivot to multi-reply → ALTER позже)
- **`<InlineReviewForm>` extraction** — если повторим UI в трёх местах (profile, athlete/passes prompt, потенциально email link) → вынести в `components/profile/InlineReviewForm.tsx`
- **Magic-link для admin invite** — переиспользовать существующий Supabase auth flow, не строить custom

## Risks

| Risk | Mitigation |
|---|---|
| Day 48 коллизия с PR #68 | Merge #68 до старта Day 48 |
| Day 50 diary schema fragmented across tables | Сначала 1h research (observation_diary vs athlete_diary vs notes); скорректировать scope |
| Day 51 invitee email deliverability на free Resend | Pro plan уже куплен (Day 0 W9) → 5k/day room |

## Метрики целевые

| После W10 | Цель |
|---|---|
| Buttons с demo close-modal | 0 (close дневник + admin) |
| Coaches с возможностью отвечать на reviews | 100% |
| Migrations | 72 → 74 (Day 48 + Day 50 если нужна) |
| Engagement loops complete | Reviews уже не one-way |

## Next next (W11 предлоги)

- ЮKassa Split Payments approved → marketplace booking flow
- Athletes list filter (PR #63 audit)
- Org analytics
- Mobile PWA
