# Sprint W19 wrap — Quality Debt Paydown + CI Hardening

> Closed 2026-05-28. PRs #123–#124 (+ wrap). Theme: Mixed Debt + Security.
> Next.js upgrade (Day 4) deferred к W20 after risk assessment.

## Tagline

«W18 закрыл security audit но оставил visible CI pain — 25 TS errors маскировались
stale types + флагом ignoreBuildErrors, красный check на каждом PR. W19 закрыл
debt: types regenerated (25→0), build tsc-gate enabled, CI Layers 3+7 wired
на PR-уровень. Next 14→16 upgrade оказался runtime-security-critical (14.x EOL)
но 2-major risk — deferred к dedicated W20.»

## Контекст

W18 wrap candidates: TS build errors, C7 Next upgrade, Lighthouse, GitHub Actions.
User выбрал «Mixed: Debt + Security». Day 1-3 shipped clean; Day 4 (Next upgrade)
после assessment перенесён в W20 (runtime-critical, заслуживает dedicated sprint).

## Day-by-day

| Day | PR | Тема |
|---|---|---|
| 1-2 | #123 | Regenerate Supabase types + fix 25 TS errors + flip `ignoreBuildErrors → false` |
| 3 | #124 | Wire `lint:duplicates` (Layer 3) + `check:bundle` (Layer 7) в PR checks |
| 4 | — | Next 14→16 assessment → **deferred к W20** (runtime-critical, 2-major risk) |

## Architecture wins

### 1. Stale types масштаб skрытого debt revealed
`types/database.ts` отставал от миграций 071 (coach_reviews) / 072 (users.is_verified) /
074 (admin_user_invites). 21 из 25 TS errors были просто type checker'ом корректно
flagging код использующий несуществующие-в-stale-types колонки. Regenerate из live
БД через Supabase MCP — 21 ошибка исчезла автоматически.

### 2. `as any` workaround стал self-defeating после fix
Оставшиеся 4: 1 missing import (useMemo) + 3 одинаковых `.select('...' as any)`.
`as any` был добавлен когда колонок не было в типах — теперь он деградировал
return type к `GenericStringError[]` (TS2352). Убрал `as any` → proper inference.

### 3. Build tsc-gate enabled — закрыт red CI на каждом PR
`next.config.mjs typescript.ignoreBuildErrors: true → false`. Первый зелёный
«TypeScript & Security Review» check после серии красных на всех W18 PR. ESLint
флаг оставлен (real rules-of-hooks debt — отдельная careful работа).

### 4. CI Layers 3 + 7 подняты с local-only к PR-level
Layer 3 (duplicate exports) + Layer 7 (bundle budget) раньше работали только
локально (Husky Layer 0 + manual). Теперь enforced в code-review.yml. `check:bundle`
сам запускает `next build` → служит И SWC parity И budget gate в одном build.

### 5. tee-reuse отвергнут эмпирически
Сначала попробовал tee build output → SKIP_BUILD reuse, но `next build` wipes
`.next` mid-build (unlink'ает teed log). `check:bundle`'s own build — clean
single-build path. Local test перед commit поймал бы fragile подход.

### 6. Meta-PR валидирует workflow на себе
Day 3 workflow change прогнался ON its own PR — зелёный check доказал что новые
шаги работают в CI до merge. Verification by construction.

## Метрики до/после

| Метрика | До W19 | После W19 |
|---|---|---|
| TS errors (tsc --noEmit) | 25 | **0** |
| types/database.ts | stale (миграции 071/072/074 missing) | regenerated from live БД |
| `next build` tsc gate | `ignoreBuildErrors: true` | **false** (enforced) |
| CI «TypeScript & Security Review» | 🔴 red на каждом PR | 🟢 green |
| Layer 3 (duplicate exports) в CI | local-only (Husky) | + PR-level |
| Layer 7 (bundle budget) в CI | local-only (manual) | + PR-level (176 routes) |
| ESLint gate | ignoreDuringBuilds: true | same (deferred — real debt) |
| Migrations | 78 | 78 (**0 — back to streak after W18's forced 3**) |
| Next.js | 14.2.35 (EOL 14.x) | 14.2.35 (upgrade → W20) |

## Surprises of W19

### 1. 21 из 25 TS errors закрылись одной командой
Type regen из live БД resolved большинство — они были не «bugs to fix» а
«stale types lying to type checker». Reframe: TS debt был type-sync debt.

### 2. `as any` оказался причиной а не workaround'ом
3 ошибки имели `as any` на `.select()` для обхода старых типов. После regen
`as any` сам деградировал тип к GenericStringError[]. Removal = fix.

### 3. Next 14.2.35 — последний 14.x (EOL по security)
Day 4 research: нет более нового 14.x патча. 14 runtime advisories (DoS via
Image Optimizer remotePatterns, HTTP smuggling в rewrites, middleware cache-
poison, XSS App Router, SSRF WebSocket) фиксятся ТОЛЬКО в 15.x/16.x. Изначально
я неточно оценил как build-time — на деле «high» это Next core, runtime.

### 4. Next upgrade breaking surface меньше чем казалось
Только 5 server components нуждаются в async params migration (14 client
используют useParams() — unaffected). cookies() — 1 site, уже awaited. Но
React 18→19 + supabase/ssr compat + 2-major (если 16) = заслуживает dedicated
sprint, не end-of-W19 rush.

## Pre-wrap deploy verification

- [x] #123 merged — CI green (2m41s), Vercel green
- [x] #124 merged — CI green (2m39s), new layers validated on own PR
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run build` (ignoreBuildErrors:false) → green
- [x] `npm run check:bundle` → 176 routes, 0 violations
- [x] `npm run lint:duplicates` → clean

## W20 candidates

| Кандидат | Скоуп | Приоритет |
|---|---|---|
| **Next.js upgrade (15 → optionally 16)** | EOL 14.x + 14 runtime vulns. React 19 + async params×5 + codemod. Research в project memory. | 🔴 HIGH (security) |
| **ESLint gate enable** | Flip ignoreDuringBuilds → false. Fix rules-of-hooks errors (conditional hooks app/org/health, useSession в coach/passes) + unescaped entities | medium |
| **Lighthouse numerical baseline** | 6-sprint defer. Browser session | low |
| **I2 — org_admin medical redaction в DB VIEW** | audit carryover | medium |
| **I5 — duplicate notification logic refactor** | audit carryover | medium |
| **C4/C6 functional tests** | Vitest auth + multi-org seed | low |
| **Marketplace booking flow** | ЮKassa Split Payments blocked | Day 0 если unblock |

## Связанные

- [[2026-05-28 Sprint W18 закрыт]] ← audit + 7 critical fixes
- [[functional verify не равен structural verify]] ← W18 pattern, applied W19 (local test caught tee fragility)
- [[схема прод и локальные миграции расходятся]] ← stale types той же природы
- [[Sprint W20 план]] ← Next upgrade headline
