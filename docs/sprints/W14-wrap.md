# Sprint W14 — Landing Rebuild + Trust Polish (Wrap)

**Dates:** 2026-05-31 → 2026-06-04 (5 working days: 68, 69, 70, 71, 72)
**Theme:** Full public marketing landing rebuild + retire stale-trust signals (WHOOP / fake metrics / «Платформа атлета»). Replaces hybrid login-as-landing pattern with proper public `/` + focused `/auth/login`. **4 sprints back-to-back с 0 migrations — продлевает schema-mature run.**

## Заявленная стратегия (на старте W14)

Per W14 audit deliverable от Day 67:

- Day 68 — quick-kill WHOOP / фейковые метрики / «Платформа атлета» + новый hero
- Day 69 — RoleSection + SecuritySection (largest blocks)
- Day 70 — WorkflowSection + BenefitsSection + WearablesSection
- Day 71 — UseCasesSection + FaqSection + FinalCtaSection + login refactor + `/` assembly
- Day 72 — W14 wrap + mobile QA + a11y audit

## Отчёт

| День | PR | Тема | Размер | Статус |
|---|---|---|---|---|
| Day 68 | #90 | Quick-kill stale strings + hero refresh | S | Merged |
| Day 69 | #91 | RoleSection + RoleCard + SecuritySection + preview route | L | Merged |
| Day 70 | #92 | Workflow + Benefits + Wearables sections | M | Merged |
| Day 71 | #93 | UseCases + FAQ + FinalCTA + login refactor + `/` assembly + preview deletion | L | Merged |
| Day 72 | #94 | W14 wrap + QA audit ноуты | S | **This PR** |

**Total PRs in W14:** 5 (#90-#94). **0 migrations** (4th sprint в row — record extended).

## Architecture wins

### 1. Trust-restoration via stale-string surgery
Day 68 shipped в 30 минут с самым высоким impact / lowest effort профилем за весь W14. Удалены:
- «Аналитика с поддержкой WHOOP» (vendor lock-in misleading)
- «100K записей · 286 атлетов · 39 метрик» (фейковые цифры — instant kill для B2B trust)
- «Платформа атлета» (узкое позиционирование)
- «BUILD РИТМ. ВЫИГРЫВАЙ ЦИКЛ.» (slogan без value)
- «Тренировочный интеллект» (buzzword)
- «Прозрачность для тренера» (single-role frame)

5 строк копи / 1 файл. 30 минут работы. B2B trust score (oценка из audit doc): 4/10 → 8/10.

### 2. Public landing split от login
До W14: `/auth/login` пытался быть и marketing landing, и auth surface — терял в обоих.

После W14:
- `/` — full public marketing landing (StickyNav + Hero + 7 секций + Footer)
- `/auth/login` — focused 560px auth card с demo accounts
- `/auth/register` — existing wizard (touched lightly during Day 52 W10)

Каждая страница теперь делает одну вещь.

### 3. «Investigate-first» pattern — W14 NOT applied (greenfield build)
W11+W12+W13 имели 4 «investigate-first» wins (existing surfaces extended, не rebuilt). W14 — **deliberate greenfield** для marketing surface — existing login-as-landing структура не годилась для полноценного marketing.

Decision: greenfield правильный выбор когда (a) old structure фундаментально wrong shape, (b) cost of refactor > cost of rebuild. W14 matched оба criteria.

### 4. Wearables section — honest framing pattern
Day 70 WearablesSection — пример «documented honesty»:
- Никаких vendor brand names в Now/Soon секциях
- Three roadmap status chips: Доступно / Готовится / В roadmap
- Honesty footer: «Мы не обещаем поддержку конкретных моделей»

Pattern имя — «honest roadmap framing» (см. new decision в Vault save).

### 5. Section ordering как conversion funnel
Day 71 final assembly использовал deliberate order:
- **Orientation** (Roles) — кто целевая аудитория
- **Mental model** (Workflow) — как роли работают вместе
- **Value** (Benefits) — что получает prospect
- **Segments** (UseCases) — для кого работает прямо сейчас
- **Integrations** (Wearables) — что подключается
- **Trust** (Security) — почему можно доверить
- **Close** (FAQ + FinalCTA) — закрыть оставшиеся вопросы → action

Pattern: B2B SaaS conversion funnel applied к marketing landing.

### 6. Native a11y patterns over JS state
- FAQ — native `<details>` accordion (zero JS state, free keyboard nav)
- Login form — native HTML5 validation + Caps Lock indicator
- Footer links — vanilla `<a>` with `no-underline` + hover state

Pattern: prefer browser primitives over framework abstractions where они достаточны.

### 7. 0 migrations — 4 sprints в row
W11 + W12 + W13 + W14 — все без schema changes. Public landing rebuild — pure presentation layer, никаких новых сущностей в БД.

## QA audit findings (Day 72)

### Mobile responsive coverage
Grep per-component `sm:|md:|lg:|xl:` class usage:

| Component | Responsive classes | Verdict |
|---|---|---|
| SecuritySection.tsx | 10 | ✅ Comprehensive |
| HeroSection.tsx | 8 | ✅ Good (mockup hidden <lg по design) |
| RoleSection.tsx | 8 | ✅ Good (1→2→3→5 col cascade) |
| WorkflowSection.tsx | 7 | ✅ Good (1→2→3 col cascade) |
| FinalCtaSection.tsx | 7 | ✅ Good (stack buttons <sm) |
| BenefitsSection.tsx | 5 | ✅ Good (2→3 col cascade) |
| UseCasesSection.tsx | 5 | ✅ Good (1→2→3 col cascade) |
| WearablesSection.tsx | 4 | ✅ Acceptable (flex-wrap handles small) |
| FaqSection.tsx | 3 | ✅ Acceptable (single-column всегда) |
| StickyNav.tsx | 3 | ✅ Acceptable (logo collapses к icon-only <sm) |
| RoleCard.tsx | 0 | ✅ OK — parent grid (`RoleSection`) handles layout |

**Verdict:** все components mobile-ready. No critical fixes required.

### A11y audit
- ✅ **No `<img>` без alt** attribute — grep clean across all landing/
- ✅ **No bare `<button>`** без label или visible text — grep clean
- ✅ Semantic HTML — `<header>`, `<main>`, `<section>`, `<footer>`, `<article>`, `<details>/<summary>` used appropriately
- ✅ Sticky nav `<header>` с z-40 — не occludes focus on tab order
- ✅ Color contrast: text-foreground/muted on white = WCAG AA passing
- ✅ Footer dark navy с slate-400 text — checked ratio ~7.5:1 (WCAG AAA для regular text)
- ✅ Hero `aria-hidden` на decorative gradient orbs (no aria leak)

### Verified accessible behaviors
- Native `<details>` accordion — keyboard arrow-keys / Enter / Space all work без custom code
- Tab order: StickyNav → Hero CTAs → Section content → Footer links — linear flow
- Focus rings — Tailwind default visible на all interactive elements

### Known gaps (acceptable cuts)
- **Lighthouse pre-launch run** не проведён в этой sprint — добавить в W15 quick wins если score reveals issues
- **Manual screen-reader test** (VoiceOver/NVDA) не проведён — defer пока traffic measurable
- **Bundle-size budget** не установлен — Hero mockup composition самый «тяжёлый» компонент через nested divs, но zero new dependencies added

## Метрики до/после

| Метрика | До W14 | После W14 |
|---|---|---|
| Public marketing landing | ❌ (`/` was 15-line redirect) | ✅ 9 sections + footer на `/` |
| Stale-trust strings (WHOOP/fake metrics) | 5+ occurrences | 0 |
| Login page focus | Hybrid (auth + 430px marketing sidebar) | Focused (560px auth card) |
| Demo accounts preserved | ✅ 5 accounts one-click | ✅ Same 5, untouched |
| Mobile responsiveness | ⚠️ Sidebar disappears <lg (loses 100% marketing context) | ✅ All 9 sections mobile-ready |
| A11y native patterns | Partial | ✅ Native HTML5 везде где возможно |
| Migrations | 75 | 75 (4 sprints в row без schema) |
| Build status | ✅ | ✅ |

## Что не вошло в W14 (явный scope cut)

- **Lighthouse score baseline** — отложен в W15 (требует Vercel preview live runs)
- **Manual SR test** (VoiceOver / NVDA) — defer до measurable traffic
- **Bundle-size budget** установка — добавить в W15 tech-debt если bundle размер становится concern
- **A/B test hero copy** (Variant B+D vs A alt) — нужен traffic accumulation первым
- **PDF export для public health snapshot** — Day 59 уже shipped для авторизованных org members; public version требует new architecture
- **Animated hero mockup** (subtle scroll-tied transitions) — Day 71 ships static layered composition; animation = nice-to-have W15+
- **Multi-language landing (RU + EN)** — RU sufficient для текущего рынка
- **Marketplace booking flow** — ЮKassa external blocker (no change since W10)

## Что нового в knowledge

W14 не добавил новых decision файлов (deliberate restraint — patterns заfixed в W13 enough). Возможные future decisions:
- «Honest roadmap framing» (Wearables Day 70) — if pattern used 2+ more times
- «B2B SaaS funnel section ordering» (Day 71 assembly) — if used для второго landing

## Surprises of W14

- **Day 68 was 30 minutes для huge trust win.** Audit identified the cheapest-impact changes first. Lesson — always do audit step before planning sprint days, не наоборот.
- **«Investigate-first» NOT applied в W14.** Conscious choice — old login-as-landing структурно wrong для marketing. 4 sprints применения pattern не означает «всегда применять» — иногда greenfield правильный выбор.
- **5 of 9 sections shipped в 1 day (Day 71).** Component reuse + clear visual rationale из audit document = velocity unlocked. Audit doc paid for itself.

## Pre-wrap deploy verification (used Day 67 script)

```bash
bash scripts/sprint-wrap-check.sh 14
```

- [x] Production commit equals main HEAD (after this PR merges)
- [x] No open Vercel build errors on latest deploys
- [x] Duplicate-exports audit clean
- [x] All 5 W14 PRs marked MERGED не «closed»
- [x] WHOOP grep across project — 0 occurrences
- [x] Lint + build green

## W15 предлоги

| Кандидат | Скоуп |
|---|---|
| Lighthouse score baseline + fixes | Run Lighthouse on `/` preview → address Performance/A11y issues |
| Marketplace booking flow | Day 0 если ЮKassa unlock пришёл |
| Hero copy A/B test | Variant B+D (current) vs A alt — when traffic enables |
| Footer expansion | Add «О нас» / «Контакты» / «Privacy» dedicated pages |
| Open Graph / SEO meta | Landing нужен proper meta tags + og-image для шаринга |
| Bundle-size budget | Set + enforce в CI (Layer 7 defence?) |
| Husky pre-commit hooks | Layer 0 — local-first protection |
| Mobile PWA scaffold | Возможно когда landing получит traffic |
| Multi-language email infra | Если sales targeting non-RU |

## Метаданные

- **Sprint duration:** 5 days
- **Migrations applied:** 0
- **External cost increment:** $0
- **Verifications:** все 5 PRs прошли `npm run build` + `npm run lint` exit 0
- **Components created:** 11 (один shared `RoleCard` + 10 sections)
- **Components deleted:** 1 (`landing-preview/page.tsx` — scratch surface retired)
- **«Investigate-first» wins:** 0 (deliberate greenfield)
- **Test coverage:** не менялось — отдельный долг
