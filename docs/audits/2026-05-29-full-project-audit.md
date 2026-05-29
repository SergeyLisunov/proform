# ProForm — Full Project Audit (2026-05-29)

> Method: static code audit of the live codebase (Next 16.2.6 / React 19 / Supabase, production live).
> 4 parallel specialized agents (architecture / security / code-quality / frontend-UX) + tsc/lint/build/bundle.
> **Limitation:** no browser, no direct prod-DB access — pixel-level layout and runtime trigger behavior NOT verified
> (flagged inline). Market analysis is preliminary (no fresh internet data).
> Follows the W18 Day 93 parallel-agent audit pattern. Post-dates W18 fixes + W19 (TS/CI) + W20 (Next 16) + W21 Day 1-2.

## Verdict

- **Readiness to build on: 8/10** — mature, secure, clean architecture; tsc clean, 0 npm vulns, production stable. Remaining issues are narrow + fixable.
- **Readiness to sell: 6/10** — three things hurt the demo story: (1) fake demo data on production pages, (2) athlete card is a vanity profile not a dossier, (3) doctor can't proactively author a recommendation in-UI.
- **Show to first users:** yes, after removing prod demo data.
- **Collect leads:** yes (honest landing + working lead magnets).
- **Take payments:** no — ЮKassa not connected (per project constraint).

## 5 critical blockers (fix first, in order)

1. 🔴 Fake DEMO data on `/analytics` + `/calendar` in production (real users see "Sara K.", "Marcus W.")
2. 🔴 Athlete card doesn't show recommendations/status/history — coach clicks athlete, gets a profile
3. 🔴 inquiry→recommendation conversion sends NO notification (relies on a non-existent AFTER INSERT trigger)
4. 🔴 5 cron routes fail-open when `CRON_SECRET` unset (mass email / data mutation by anon)
5. 🔴 C4 regression: 12+ API routes leak `error.message`

## Inventory

| Area | Stack | Location | Status | Risk |
|---|---|---|---|---|
| Frontend | Next 16.2.6 App Router, React 19.2 | `app/` (93 pages) | live | mega-files (calendar 2443 lines) |
| Backend | Next API routes (80) + services (43) | `app/api/`, `services/` | ok | duplicated notification logic |
| DB | Supabase Postgres + RLS | `supabase/migrations/` (66 files → 078) | ⚠️ | **base schema 001-008 missing** |
| Auth | Supabase Auth + `proxy.ts` (ex-middleware) | `proxy.ts`, `lib/supabase/` | ok | — |
| RBAC | RLS `get_my_user_id()` (40 migrations) | migrations | strict | — |
| Styles | Tailwind + Metronic CSS `@import` | `app/globals.css` | ⚠️ | `--webpack` workaround (W21 Turbopack debt) |
| Tests | Playwright | `tests/e2e/smoke.spec.ts` (1 spec) | ⚠️ | minimal coverage |
| Build/CI | Vercel + GitHub Actions | `.github/workflows/`, `vercel.json` | ok | **`npm run lint` broken under Next 16** |

## Security (security-reviewer agent)

| # | Sev | Finding | Location | Fix |
|---|---|---|---|---|
| H1 | HIGH | 5 cron routes fail-open without `CRON_SECRET` (`if(secret){...}` skips when unset) | `api/cron/{adherence-nudge,expire-inquiries,expire-stale-pending,leads-digest,org-weekly-digest}/route.ts` | fail-closed: 503 if missing (copy `expire-recommendations` pattern) |
| H2 | HIGH | C4 regression — `error.message` leaked in 12+ routes added after W18 | `org/teams/route.ts:59`, `org/teams/[id]/route.ts:92,116`, `recommendations/route.ts:83`, `recommendations/[id]/route.ts:62`, `recommendations/[id]/ack/route.ts:50`, `billing/cancel/route.ts:65`, `challenges/[id]/route.ts:32`, `connections/route.ts:99,118`, `cron/expire-inquiries:41`, `cron/expire-recommendations:39` | `→ 'server_error'` + console.error |
| M1 | MED | PostgREST filter injection via unsanitized `ilike` interpolation | `notes/route.ts:36`, `directory/route.ts:25-60`, `search/users/route.ts:36`, `search/suggest/route.ts:57+` | strip `,.()"\` from user input |
| M2 | MED | challenge `org_id` accepted without org-membership check | `challenges/route.ts:60-70` | verify `org_members` before insert |
| M3 | MED | `sync_athlete_pass_usage` SECURITY DEFINER missing `search_path` | `022_coach_passes_sessions.sql:87` | `SET search_path=public,pg_temp` |
| M4 | MED | `should_send_notification` callable for any `user_id` | `065_users_notification_prefs.sql:57` | REVOKE FROM authenticated (cron uses admin client) |
| M5 | MED | No Content-Security-Policy header (comment claims it; absent) | `next.config.mjs:35-47` | add CSP-Report-Only |
| L1-3 | LOW | coach_reviews `USING(true)`, coach_review_summary→anon, challenges visible to all authenticated | migrations 071, 013 | likely by-design (marketplace transparency); document |

W18 fixes verified intact: C1 demo gate, C4 (36 original routes), C5 immutability trigger, C6 doctor cross-org scope, I4 headers (except CSP), N3 search_path. No hardcoded secrets; admin client server-only; service-role not in browser; ЮKassa webhook IP-allowlist + idempotency.

## Architecture / Backend / Data (architect agent)

| Sev | Finding | Location | Fix |
|---|---|---|---|
| HIGH | inquiry→recommendation conversion sends NO notification (route comment claims migration-052 trigger does it, but that trigger is BEFORE UPDATE, only sets updated_at/status — no AFTER INSERT notify) | `convert-to-recommendation/route.ts:19,126-152`; `052_recommendations.sql:217-241` | inline fan-out like `recommendations/route.ts:89-161` (extract shared helper) |
| HIGH | Base schema missing — migrations start at 009; `users/organizations/org_members/trainer_athletes/calendar_events/workouts` never defined in repo → fresh `db reset` can't rebuild | `supabase/migrations/` (earliest 009) | generate `000_baseline.sql` from prod `pg_dump --schema-only` |
| MED | `OrgMemberRole` type stale (`'athlete'\|'coach'`, DB allows 6: org_owner/org_admin/coach/doctor/specialist/athlete) | `types/org.types.ts:1`; `org.service.ts:34` | widen union |
| MED | Dead role label `=== 'admin'` (DB value is `org_admin`) → org admin shown as "атлет" in activity feed | `org-activity.service.ts:161,326` | `'admin'`→`'org_admin'` |
| MED | Duplicated notification fan-out (service vs route, already drifted on titles) | `recommendations.service.ts:213-281` vs `recommendations/route.ts:89-161` | one server-side dispatch helper |
| LOW | 34/43 services bound to browser supabase client → can't reuse in Server Components/Actions, forces route duplication | `services/*.ts` | inject client incrementally |

Solid (don't touch): recommendations RLS hardening 076/078 (immutability trigger SECURITY DEFINER + locked search_path), server/admin client separation, marketplace 2-table merge (documented pragmatism), no orphan FKs.

## Code quality (code-reviewer agent)

| Sev | Finding | Location |
|---|---|---|
| HIGH | Hardcoded DEMO data shipped to prod (`DEMO_ATHLETES` "Sara K."/"Marcus W.", DEMO_WEEKLY/DAILY/HRZ/SESSIONS) — not env-gated | `app/analytics/page.tsx:13-18,156-693`, `app/calendar/page.tsx:5,116-117`, `lib/utils/data.ts` |
| HIGH | `calendar/page.tsx` 2443 lines; also diary 1586, settings 1217, admin 1179, dashboard 1174, register 1131, athletes 1117, MedicalDiaryClient 1312, CoachDiaryClient 1184 (>800 ceiling) | multiple |
| MED | 3 dead components: `BuyPassButton`, `ProfileShell`, `RecommendationForm` | `components/` |
| MED | `knip.json:20` references `middleware.ts` (renamed `proxy.ts`) | knip.json |
| MED | `catch (e: any)` ×9 without narrowing → "undefined" in toasts | settings:305,573,597,613; register:387,423; org/members:85; profile/[id]:192; WorkoutPDFExport:400 |
| LOW | client-side console.* (~75), dead exports DEMO_CYCLES/DEMO_DIARY, `medical-summary-demo.ts` misnamed (it's prod) | multiple |

Positives: dynamic imports for dashboards, structured server-log prefixes, correct error narrowing in API routes, all 43 services imported, demo login env-gated.

## Frontend / UX / Roles (frontend agent, code-level only)

- **Dashboards (5/5 coherent):** athlete/coach/doctor/org/admin all have a sensible post-login home. Issues: CoachDashboard N+1 metric fetch; DoctorDashboard `activeInjuries` count is platform-wide not doctor-scoped (`DoctorDashboard.tsx:130`); AdminDashboard "schema map" is dev noise.
- **🔴 Athlete card = vanity profile (biggest UX gap):** `app/athletes/[id]` → redirect → `app/profile/[id]` shows avatar/bio/stats but NOT recommendations, medical status, training history, coach/doctor/org relationships, or quick actions. A coach expecting a dossier gets a profile.
- **Recommendation flow half-broken:** service excellent (4 visibility tiers + app-layer org redaction). Real path: coach AskDoctor → doctor inquiry → convert-to-recommendation (visibility set correctly). BUT coach side has no UI — `PersistentRestrictionsPanel` never mounted; notification deep-links to `/athletes/{id}` → profile with no recommendations. Two parallel doctor→coach systems (structured recs + free-text `medical_diary.is_shared_with_coach`). `RecommendationForm` (doctor proactive create) is dead — doctor can't initiate a recommendation in-UI.
- **Strong:** empty/loading/error states (12 pages checked, all have CTA), clickability (0 dead buttons, honest "скоро" disclaimers), public pages (about/pricing/contacts/legal present), honest landing (Parent correctly removed, demo accounts → real dashboards).
- **Mild overpromise:** landing sells doctor recommendations as headline, but doctor can only create via answering a coach inquiry, not proactively.

## Tests & build

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ green (Next 16 --webpack) |
| `check:bundle` | ✅ shared 527/650 kB, total 3762/4600 kB |
| `npm run lint` | 🔴 BROKEN — `next lint` removed in Next 16 (`no such directory: /lint`). ESLint Layer 1 effectively OFF (+ ignoreDuringBuilds:true) |
| e2e | ⚠️ 1 smoke spec — no RBAC-isolation coverage |

## Market (preliminary, no fresh data)

| Alternative | Why used | Weakness | ProForm advantage |
|---|---|---|---|
| Telegram/WhatsApp | free, familiar | chaos, no structure, lost history, no roles | unified card + role access + medical contour |
| Excel/Sheets | flexible | no realtime, no roles, manual | automation + RLS isolation |
| Notion | structure | not sports domain, no medical logic | coach-doctor-athlete domain model |
| Club CRM (Mindbody etc.) | billing/scheduling | no coach-doctor-athlete loop, not RU | medical recommendations + 152-ФЗ + RU hosting |

Anchor niche: sports schools / academies / performance centers with doctor + coach + parent-recipient. Differentiator: **isolated medical contour** (no chat alternative offers this).

## Recommended minimal test set (currently missing)

- org sees only its members; coach sees only own athletes (accepted); doctor only assigned; athlete only own; parent only own child (recipient)
- doctor creates recommendation → coach sees it on athlete card
- protected route blocked unauthenticated; API rejects cross-org id

## Fix order (each a separate PR, W18-W21 style)

1. Remove DEMO data from `/analytics` + `/calendar` (env-gate `NEXT_PUBLIC_DEMO_MODE` or real queries)
2. Athlete card: add recommendations + status + history + quick actions for linked coach/doctor/org
3. Notification fan-out in convert-to-recommendation (or verify trigger on prod)
4. Cron fail-closed (5 routes) + C4 regression (12+ routes)
5. Fix `npm run lint` (ESLint flat config / `eslint .` instead of `next lint`)

Then medium: org_admin mislabel, mega-file split (calendar/diary first), CSP header, base schema baseline, PostgREST filter sanitize.
