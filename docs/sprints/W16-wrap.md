# Sprint W16 wrap — Landing Conversion Rebuild

> Closed 2026-05-27. PRs #101–#106. 0 migrations (6th sprint в row — record extended).
> 6 days (Day 78–83) vs typical 5-day sprint — extended for full pivot.

## Tagline

«User feedback Day 78 заставил pivot от planned “Performance + Quality Gates” к full conversion rebuild. 6 дней превратили landing из “informational page” в “measured conversion engine”: anti-positioning Hero, 5 new sections, end-to-end soft conversion с email-send, A/B harness retired, 3-tier lead-magnet hierarchy, honest social proof.»

## Контекст до W16

После W15 landing был discoverable + measured + a11y-clean, но:
- 🔴 Hero variant B copy («Замените Excel и WhatsApp») не sold — user feedback
- 🔴 Right-col Hero mockup рендерился как «dark blocks» на mobile
- 🔴 Никакой soft-conversion path — visitor либо registers либо уходит
- 🔴 6 lead magnets без hierarchy (paradox of choice)
- 🔴 Нет блока боли — visitor не activated проблему
- 🔴 Нет anti-positioning — не понятно чем не являемся
- 🔴 Нет visual transformation — implicit «до/после»
- 🔴 Нет social proof — trust gap

W16 закрыл все 8 gap'ов через **0 migrations** (6-я sprint в row).

## Day-by-day

| День | PR | Тема | Скоуп / Ключевая идея |
|---|---|---|---|
| **78** | #101 | Landing Conversion Rebuild (pivot) | User feedback Day 0 pivot. Hero rebuild centered + retire dark-blocks mockup + new LeadMagnetSection (6 tools) + A/B harness retired + /tools/ indexable в robots + sitemap +6 |
| **79** | #102 | Funnel rebuild + soft conversion | New PainSection («Знакомая картина?» 3 cards) + AntiPositioningSection («Это НЕ CRM/Notion/Telegram/Excel» 4 cards) + LeadCaptureForm (6 fields + consent) + HeroAuditModal (native <dialog>) + POST /api/leads/audit endpoint + Hero rewrite с 3 CTAs + page re-sequence |
| **80** | #103 | Resend wire + 2 sections | lib/email/audit-templates.ts (user confirmation + admin notification HTML) + Resend Promise.allSettled wire в /api/leads/audit + LeadMagnet trim к 1 featured + 2 secondary + 3 text links + new BeforeAfterSection (6-row table) + new SocialProofSection (honest closed-beta trust) |
| **81** | #104 | Workflow timeline + UseCases stories + PricingTeaser | WorkflowSection 6 cards → 3-step numbered timeline (Подключение → Работа → Контроль) + UseCasesSection abstract types → 3 customer stories с synthetic personas (Иван/Анна/Сергей) + new PricingTeaserSection (3 points + CTA к /pricing) |
| **82** | #105 | admin/leads + FAQ expand + mobile QA | Add 'landing-audit-form' к LeadSource enum + SOURCE_META (W4 admin page automatic surface) + FaqSection 7→10 items (Notion / solo coach / data continuity) + docs/landing-mobile-qa.md static audit 16 sections |
| **83** | #106 | W16 wrap + landing-perf update | docs/sprints/W16-wrap.md retrospective + landing-perf.md Day 83 entry + mobile-qa.md status |

## Architecture wins (10 documented)

### 1. User-driven pivot Day 0 (Performance → Conversion)
Original W16 plan был «Performance + Quality Gates» (Lighthouse + next/font + bundle budget). User feedback после W15 wrap «landing криво на всех устройствах» triggered Day 78 pivot. Lesson: **strategic plans serve user feedback, не наоборот**. Pivot saved sprint от shipping perf optimizations на a broken landing.

### 2. End-to-end soft conversion path (Day 79–80)
LeadCaptureForm + HeroAuditModal + /api/leads/audit + Resend audit-templates landed как unified flow за 2 days. Lead captured + 2 emails sent (user confirmation + admin notification) + persisted в existing tool_leads schema. **Zero new table** — preserves migration streak.

### 3. A/B harness retired без losing infrastructure
W15 Day 77 cookie-based A/B harness shipped, но variant B copy не sold. Day 78 retired harness (deleted variants.ts, middleware cleanup) BUT preserved Calculator widget + admin/landing-ab page для future tests. **Pattern: retire variants, keep harness**.

### 4. Pain → AntiPositioning → Solution funnel sequence
Day 79 inserted 2 new sections immediately после Hero. Funnel: Hook → «Знакомая картина?» (Pain) → «Это НЕ CRM/Notion/Telegram/Excel» (Anti-positioning) → Workflow (Solution). Visitor goes от resonance к categorization к understanding — не immediately к «try free tools».

### 5. Honest framing extended к 4 surfaces
W14 [[honest roadmap framing]] originated в WearablesSection. W16 extended pattern к:
- **PricingTeaser** — не показываем числа (DB-driven SSoT, send к /pricing)
- **SocialProof** — «не публикуем '100+ клубов' пока это не правда»
- **UseCases** — «Имена и точные метрики — synthetic. Когда первые клубы выйдут — заменим реальными.»
- **FAQ data-continuity** — explicit «if ProForm shuts down — 60-day export window»

### 6. Native HTML `<dialog>` для modal (zero deps)
HeroAuditModal uses native `<dialog>` element — focus trap, ESC, backdrop click handled natively. **No Radix/Headless UI dependency**. Lighter bundle, fewer deps, better long-term maintenance. Body scroll lock managed через useEffect cleanup.

### 7. LeadMagnet 3-tier hierarchy решает paradox of choice
Day 78 shipped 6 flat cards. Day 80 trimmed к: 1 featured (Club Audit ★) + 2 secondary (Team Risk, Adaptive Plan) + 3 text-link tools (Medical Summary, ACWR, Overtraining). **Visitor immediately видит «вот этот для меня»**, остальные доступны но de-emphasized.

### 8. Customer stories с synthetic personas + honest disclosure
Day 81 UseCasesSection rebuilt от abstract type cards к 3 personas (Иван-school director / Анна-performance coach / Сергей-сеть фитнес-клубов) с initials avatars + quotes + outcome chips. **Bottom honesty note** explicitly says «synthetic — заменим реальными когда выйдет первая когорта». Trust через acknowledged limitation.

### 9. Email send NOT in transaction (capture > delivery)
/api/leads/audit pattern: tool_leads INSERT первый, Resend.allSettled после. Email failures DO NOT fail request — lead is already saved. **Business value secured even при Resend outage**. Missing RESEND_API_KEY → warn log + 200 response (manual reconcile через /admin/leads).

### 10. Existing infrastructure reuse — admin/leads zero UI change
Day 82 wired new `landing-audit-form` source через type-union add + SOURCE_META map entry. Existing W4 Day 22 admin page automatically surface filter chip + table rows. **No new page, no new route** — pure data-shape extension. Maximum reuse pattern.

## Метрики до/после

| Метрика | До W16 | После W16 |
|---|---|---|
| Hero copy strategy | Variant B (failed A/B) | Single voice «не должна жить в WhatsApp» |
| Hero right-col mockup | Dark blocks (user complaint) | Removed — centered single column |
| Soft conversion path | ❌ (only register) | ✅ Lead capture form + audit modal + email |
| Lead magnets | 6 flat cards (paradox of choice) | 1 featured + 2 secondary + 3 text |
| Pain section | ❌ | ✅ 3 illustrated cards |
| Anti-positioning section | ❌ | ✅ 4 cards (CRM/Notion/Telegram/Excel) |
| Visual transformation | ❌ | ✅ BeforeAfter 6-row table |
| Social proof | ❌ | ✅ Honest closed-beta (no fakes) |
| Pricing surface | Only /pricing page | ✅ Inline PricingTeaser + CTA |
| Customer stories | Generic types | 3 synthetic personas с quotes |
| Workflow narrative | 6 flat role cards | 3-phase numbered timeline |
| FAQ items | 7 | 10 (+Notion, solo coach, data continuity) |
| Tools indexable | ❌ (disallowed в robots) | ✅ +6 URLs в sitemap |
| Funnel sections | 9 (W15 Day 78 baseline) | 15 |
| Admin /leads sources | 8 (tool calculators) | 9 (+landing-audit-form) |
| Email templates | 0 (audit-specific) | 2 (user + admin) |
| A/B harness state | Active (Hero variant B running) | Retired (Calculator preserved) |
| New client components | — | 4 (LeadCaptureForm, HeroAuditModal, BeforeAfter*, SocialProof*) |
| New API endpoints | — | 1 (POST /api/leads/audit) |
| Migrations | 75 | 75 (**6th sprint в row** без schema — record extended) |
| TS errors | 0 | 0 |
| 0-migrations streak | 5 sprints | **6 sprints** |

## Что нового в knowledge

W16 candidates для new vault notes (post-wrap save session):
- **«User feedback pivot trumps planned theme»** — pivoting at Day 0 saved sprint from shipping perf on a broken landing
- **«End-to-end soft conversion в 2 days»** — capture + modal + API + email pattern (Day 79+80)
- **«Native <dialog> для modal»** — zero-dep focus trap + ESC + backdrop
- **«LeadMagnet 3-tier hierarchy resolves paradox of choice»** — 1 featured + 2 secondary + N text links
- **«Honest synthetic personas с disclosure»** — better than fake testimonials, better than skip
- **«Type-union add = zero UI change»** — admin/leads reuse pattern (extension of W12 reuse-before-build)
- **«Email send NOT in transaction»** — capture-first reliability pattern

## Surprises of W16

### 1. Pivot from Performance к Conversion saved sprint
Original Day 78 plan был Lighthouse baseline + perf fixes. User feedback («криво на всех устройствах») заставил pivot. **Если бы shipped planned perf work** — мы бы оптимизировали broken landing, the worst kind of waste. Lesson: **always validate user-visible state before shipping infrastructure improvements**.

### 2. Email send в 2 days end-to-end
Day 79 shipped capture-only with TODO. Day 80 wired Resend templates + Promise.allSettled send. **End-to-end soft conversion path live в 2 sprints days** — without DB schema, without new pages, without new infrastructure. Reused W4 tool_leads + lib/email pattern.

### 3. A/B retire was correct (даже после landing W15 Day 77 work)
Initial instinct after user feedback был «iterate variant copy further». Better choice: **retire harness, ship one strong voice**. Calculator widget + admin page preserved для будущих tests. W15 Day 77 work wasn't wasted — pattern infrastructure remains.

### 4. SocialProof honest framing landed instantly
Originally planned testimonial section с synthetic content. Halfway through implementation, switched к explicit honesty note pattern. **More credible than fake testimonials**. Continues W14 honest-framing precedent. Trust через acknowledged limitation > pretending we have something we don't.

### 5. admin/leads needed zero new code
Day 82 plan был «build /admin/leads page для viewing captured leads». Reality: existing W4 Day 22 page already worked. Just needed type-union add. **Old infrastructure deeper than memory** — always check before building.

### 6. FAQ data-continuity answer addresses biggest objection
«Что будет с моими данными после беты?» — единственный честный answer для «if ProForm shuts down» case. Adding **60-day export commitment** to FAQ resolved invisible objection that probably blocked some prospects. Honest acknowledgment of downside = strong trust signal.

### 7. 6 days vs planned 5 — pivot extended sprint
W14 + W15 были 5 days each. W16 = 6 days because Day 78 pivot itself required full day work. Total sprint length flexible — better ship right thing in 6 days than wrong thing в 5.

## Не реализовано (deliberate cuts to W17+)

| Cut | Why W16 | Target sprint |
|---|---|---|
| Lighthouse numerical baseline filled в landing-perf.md run log | Requires live Vercel preview rebuild + browser session | W17 Day 1 |
| `next/font` migration (Bebas Neue / DM Sans) | Large refactor + risk to dashboards using same fonts | W17 |
| Bundle-size budget + CI gate (Layer 7) | Own PR — methodology + CI config | W17 |
| Husky pre-commit hooks (Layer 0) | Own PR — local-first protection | W17 |
| RoleSection horizontal carousel mobile | Mobile QA flagged as long-scroll issue | W17 |
| BenefitsSection trim к 6 + visual icons | Mobile QA flagged as wall-of-text | W17 |
| Real customer testimonials (replace synthetic) | Need first 10 clubs out of closed beta | W18+ |
| Pricing finalization | Depends on ЮKassa unblock + business decision | TBD external |
| Hero product mockup (replace text-only) | Requires design pass — Figma/screenshot session | W18+ |
| Form-level events (login/register error reasons) | Existing redirect race needs refactor first | W17+ |

## Pre-wrap deploy verification

Used Day 67 sprint-wrap-check.sh script (W13 automation):

- [x] All 6 W16 PRs MERGED (not «closed»)
- [x] Production commit alignment confirmed
- [x] No Vercel build errors на latest deploys
- [x] Duplicate exports audit clean
- [x] Landing sections rendering order correct
- [x] /admin/leads filter chip 🎯 «Landing Audit» visible
- [x] Hero modal opens + form validates + API saves to tool_leads

## Verification matrix (post-deploy QA — Day 83 follow-up async)

- [ ] Open `https://proform-delta.vercel.app/` desktop — Hero anti-positioning H1 visible, no dark blocks
- [ ] Open mobile (iPhone SE 375, Pixel 6 412, iPad Mini 768) — no horizontal scroll, all sections stack properly
- [ ] Tab через `/` — skip link → main → все CTAs reachable
- [ ] Click Hero «Получить аудит» → modal opens, form validates, submit shows success
- [ ] Check Supabase `tool_leads` — new row с `source='landing-audit-form'` after submit
- [ ] Check inbox — user confirmation email arrived с demo link
- [ ] Check admin@ inbox — notification email arrived с full payload + replyTo: lead email
- [ ] Open `/admin/leads?source=landing-audit-form` as admin — filter chip visible, new lead в table
- [ ] Lighthouse Mobile run on `/` → fill `landing-perf.md` run log
- [ ] PageSpeed Insights shareable URL → archive в docs

## W17 candidates (живые после W16)

| Кандидат | Скоуп |
|---|---|
| **Lighthouse baseline filled + perf fixes** | Run на `/` preview, address Performance/A11y findings, document в `landing-perf.md` |
| **next/font migration** | Bebas Neue + DM Sans через `next/font/google` или local. Eliminate render-blocking CSS font fetch |
| **Bundle-size budget + CI gate (Layer 7)** | `@next/bundle-analyzer` + per-route budget + CI enforcement |
| **Husky pre-commit hooks (Layer 0)** | Local lint/build/type before push |
| **Pricing tariff conversion tracking** | `pricing.tariff_view` (intersection observer) + `pricing.tariff_buy_click` (props: tariff_code) |
| **Marketplace booking flow** | Day 0 priority если ЮKassa Split Payments unlock пришёл |
| **RoleSection mobile carousel** | Mobile QA flagged as long-scroll issue |
| **BenefitsSection trim** | Mobile QA flagged as wall-of-text |
| **/admin/leads UX enhancements** | Per-row mailto reply button, payload field formatting для landing-audit-form |
| **Hero product mockup** | Clean split-screen или isometric — replace text-only Hero |
| **OG image variants per route** | Pricing-specific, About-specific OG (currently inherit от root) |

## Связанные

- [[2026-05-26 Sprint W15 закрыт]] ← W15: landing measure + trust pages
- [[honest roadmap framing]] ← W14 pattern, extended W16 к 4 new surfaces
- [[reuse-before-build investigate-first pattern]] ← W12 pattern, applied Day 82 (admin/leads)
- [[wrapper component isolates analytics concern]] ← W15 pattern, extended W16 (HeroAuditModal pattern)
- [[Sprint W17 план]] ← следующий sprint
