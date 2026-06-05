# SPORTEO: Strategy vs Reality — Codebase Gap Analysis

> Founder briefing · 2026-06-05 · grounded in repo audit + live prod DB (`hhyjihbctidtucvpgjzv`) + registrar/trademark research.
> Produced by a 9-agent audit workflow (6 codebase dimensions + 2 brand-research + synthesis) against `sporteo-strategy-v3.md`.

---

## 1. Executive Summary

- **The product is broadly on-strategy in shape, but "partial" in every audited dimension.** All five engineering dimensions (access/tenancy, monetization, ACWR/ML, doctor↔coach clearance, RLS isolation) and positioning landed at **partial maturity** — the scaffolding is real and often well-engineered, but the load-bearing pieces that turn scaffolding into a sellable, defensible product are missing.
- **The #1 differentiator is the weakest claim.** The "ML injury-risk model, AUC ≈ 0.75, validated" exists **only as marketing copy on two landing components** with **zero backing code** (no model artifact, no training pipeline, no AUC computation anywhere in the repo). What's real is the well-known **ACWR heuristic** (correctly implemented) plus LLM-narrated prose. This is both a product gap and a **material honesty/legal risk** on a public page.
- **Monetization is the most-built non-core area but is not P1-ready and bills no one.** A clean YooKassa integration, a 6-tier catalog, and a genuinely complete webhook activation backbone exist — but **no YooKassa keys are configured** (every checkout returns `503`), **recurring auto-renewal has zero callers**, there's **no expiry janitor and no renewal reminders**, and the **register flow grants paid status for free**. Revenue today would be one-shot at best, and is not provable end-to-end at all.
- **The "organization" is not a real tenant, and the access model lives in two unsynchronized systems.** `organizations.id == owner users.id` (1:1, no `owner_id`, no co-owners). `connections` and `org_members` drift: invite-link members never appear in the org roster the UI reads. The coach↔athlete access backbone (`trainer_athletes`) **was silently broken in prod until June 3** (migration 085) — coaches could see none of their athletes' data.
- **The moat's clearance workflow is well-built plumbing with no "светофор" and no enforcement — and zero production usage.** The diagnosis-hiding privacy model is genuinely implemented (`coach_only` visibility), but there is **no discrete light/medium/full/ban state**, **no "before next training" gating**, and **every relevant table is empty in prod** (0 recommendations, 0 clearances, 0 inquiries). The flow is deployed but has never carried real data.
- **The brand "Sporteo" is a liability.** Every premium domain is taken (`.com/.io/.co/.app/.pro/.ru`), only `.ai` ($160/2yr) and `.team` ($7.99/yr) are free, and the name collides with an **active, well-funded sports-marketing agency** (Sporteo Int. Sportmanagement, now TGI Sport) plus 3–4 other "Sporteo" brands. The name is weakly distinctive and hard to defend. **Recommendation leans rename.**

---

## 2. Reality Table

| Dimension | Maturity | One-line gap |
|---|---|---|
| Tenant / roles / access graph | **Partial** | Org isn't a real tenant (`id==users.id`); `connections` and `org_members` drift — invite-link members never hit the org roster. |
| Monetization | **Partial** | Integration is built but **no YooKassa keys**, no auto-renewal, no expiry janitor, no reminders; register grants paid status free. |
| Predictive ACWR + ML | **Partial** | ACWR is real & correct; the advertised **"ML, AUC ≈ 0.75" has zero backing code** — it's a fabricated landing claim. |
| Doctor↔coach clearance | **Partial** | Privacy model real, but **no traffic-light state, no training-gating, 0 rows in prod** — never used. |
| RLS / tenant isolation | **Partial** | Relationship-edge isolation (no `org_id` on core tables); **one real `workouts` UPDATE leak** + heavy dead-policy sprawl. |
| Positioning / AI lead-gen | **Partial** | AI tools & club-audit are **real**, but #1 landing persona is "СШОР" (state school) — contradicts the strategy; TTV copy conflicts (5 min vs 60 sec). |

---

## 3. Moat Reality Check (Differentiator #1)

The strategy stakes the moat on three things: **ACWR/ML injury-risk prediction**, the **doctor→coach clearance "светофор"**, and the doctor role. Honest status of each **today**.

### 3a. ACWR — REAL and largely correct ✅
This is the genuine, defensible asset.
- Proper rolling **7-day acute : 28-day chronic** windows (`app/load/page.tsx` via `rollingAvg`, `services/acwr.service.ts`, `components/widgets/TrainingLoadWidget.tsx`).
- Literature-aligned zone thresholds **0.8 / 1.3 / 1.5** (Gabbett/Bourdon), correctly-implemented **monotony** (mean/stddev).
- Powers an athlete traffic-light, a coach "at-risk athletes" list, and a public lead-magnet calculator (`lib/acwr/calc.ts`).
- **Caveats:** the load proxy is weak (`duration_min*0.1` fallback; no validated **session-RPE = duration × RPE**); `acwr.service.ts` divides by fixed 7/28 even on sparse data; and the public/team tool uses `current_week / avg_4w` (`lib/ai/team-risk.ts`), **not** the same true rolling 7:28 — so the in-app and public "ACWR" disagree.

### 3b. ML injury-risk model — DOES NOT EXIST ❌ (central honesty problem)
- The claim **"ML-модель ... AUC ≈ 0,75 на валидации"** appears in exactly two places: `components/landing/SocialProofSection.tsx` and `components/landing/UseCasesSection.tsx`. A repo-wide grep for `AUC / logistic / sigmoid / onnx / sklearn / predict` returns **only those two landing files**.
- There is **no model artifact** (`.pkl/.onnx/.joblib/.h5`), **no Python/notebook**, **no trained weights, no feature vector, no train/test split, no AUC/ROC computation** anywhere.
- The `injuries` table (`migration 027`) — the only outcome label that could ever train a model — is **never joined to load features**. No feature store, no `risk_scores`/`model_predictions` table in any migration.
- Everything the product calls "risk" is either a **deterministic ACWR threshold** (rule-based) or an **LLM asked to narrate anomalies** (`lib/ai/team-risk.ts` self-describes as "rule-based heuristic / deterministic stub"; `app/api/ai/anomaly-check/route.ts` is a Claude prompt). No probabilities, no calibration, no explainability.

**Verdict:** The "predictive ML" moat **does not exist today**. Publishing a specific fabricated AUC on a public landing page is a real reputational/regulatory risk and should be fixed **immediately**, independent of any roadmap decision.

### 3c. Doctor→coach clearance — WELL-BUILT PLUMBING, NO "СВЕТОФОР", NEVER USED ⚠️
- **What's real:** the diagnosis-hiding privacy model. `recommendations` (`migration 052`) carries `category` (incl. a `clearance`/"Допуск" category), `severity`, and `visibility_level` (`athlete_only/coach_only/coach_and_athlete/org_full`). `coach_only` lets a doctor restrict a coach **without** the athlete seeing it — enforced by RLS + app-layer redaction, hardened against tampering (`migration 076`). A richer channel, `doctor_inquiries` (`migration 064`), has `question_type` `load_clearance`/`return_to_play`.
- **What's missing vs. the strategy's specific "светофор допуска":**
  1. **No discrete state machine.** No green/yellow/full/ban; clearance is just 1 of 9 free-form recommendation categories with a generic 4-level severity. A coach **cannot read a single canonical "can this athlete train, and how hard?" signal.**
  2. **No "before the next training" gating.** Nothing in workout/`calendar_events` creation checks for an active restriction. The coach surfaces (`PersistentRestrictionsPanel`, `CoachRestrictionsWidget`) are **informational only**.
  3. **Zero production usage.** Live prod counts are **all 0**: recommendations, clearance-category, `coach_only`, shared medical-diary rows, `doctor_inquiries`, `trainer_athletes`.
- **Naming trap:** the strategy references `training_marks` as part of clearance — but the actual `training_marks` table is a **coach-owned workout color-tag**, unrelated to doctor clearance. Reconcile this.

### What "credible" looks like (honest path)
1. **Now:** strip/soften the AUC claim → "научно обоснованный ACWR-мониторинг (Gabbett)." Market the real asset: correct multi-surface ACWR + monotony + doctor-clearance workflow + wearable ingestion.
2. **Data foundation:** feature pipeline joining `workouts` (load, strain, HRV, recovery, monotony, ACWR history) to `injuries` as labels; add a `risk_scores`/`model_predictions` table.
3. **Honest v0:** ship a **transparent, explainable** logistic/heuristic ensemble (ACWR + monotony + strain-spike + low-recovery streak) with documented thresholds and **per-factor contribution display** — *before* using the word "ML."
4. **Only after** enough labeled injury outcomes: train, **honestly** validate on a real held-out set, store `model_version`, surface calibrated probabilities. Until then, **no AUC number in product copy.**
5. **Integrate the moat:** wire ACWR/risk into the clearance "светофор" so workload risk **informs** clearance — today they are two disconnected systems.

---

## 4. Brand Risk Verdict

**Risk: HIGH on domains, MEDIUM-HIGH on trademark. Recommendation: strongly consider renaming.**

**Domains** (Vercel registrar, live 2026-06-05): `.com`, `.io`, `.co`, `.app`, `.pro` all **taken**; `.ru` **taken** (live Irkutsk retailer "Спортео," web-confirmed). Only **`.ai` ($160/2yr)** and **`.team` ($7.99/yr)** free.

**Trademark / collision** — the name is crowded with ≥5 distinct "Sporteo" entities:
- **Sporteo Int. Sportmanagement AG** — active sports-marketing/sponsorship agency, Liechtenstein, **acquired by TGI Sport (May 2025)**. Well-capitalized, same sports vertical, likely holds EU/DACH marks. **Primary risk.**
- **Sporteo App** (Quebec team-management app) — "deadpooled" but still occupies the app-store name and the closest *functional* niche.
- **Sporteo.com** (merchandise directory), **Sporteo.ma** (Moroccan sports marketplace) — active commercial uses.
- "sport + -eo" is **weakly distinctive** — multiple independent parties landed on it.

**Russian-market note:** *market-confusion* risk inside RU is **low** (no in-market "Sporteo"/"Спортео" training app). But *trademark* status in RU/EU/WIPO is **UNVERIFIED** (Роспатент/FIPS, EUIPO, TMview are anti-bot gated; web search is not authoritative).

**Verdict & next steps:**
- **Lean rename** to a distinctive, ownable, `.com`-available name (re-clear each; avoid plain "-eo").
- If "Sporteo" must stay: (1) commission a **professional trademark clearance** (Роспатент classes 9/41/42, WIPO Madrid, EUIPO) **before any branding spend**; (2) confirm whether the TGI-owned mark extends to RU/those classes; (3) grab `sporteo.team` now, optionally `.ai`; (4) rebrand if any live RU/EU mark in overlapping classes surfaces.

---

## 5. Prioritized Action Plan

Effort: **S** ≈ ≤1 day · **M** ≈ 2–5 days · **L** ≈ 1–3 weeks.

### P0 — Integrity & truth-in-advertising (this week, blocks nothing)
| Action | Effort | Step |
|---|---|---|
| Remove fabricated AUC claim | **S** | `components/landing/SocialProofSection.tsx` + `UseCasesSection.tsx` → "научно обоснованный ACWR-мониторинг (Gabbett)." Drop "патентный поиск без аналогов." |
| Fix СШОР positioning conflict | **S** | `UseCasesSection.tsx` `STORIES[0]` "Спортшкола, СШОР" → private-segment language. |
| Unify TTV copy | **S** | Hero "5 минут" vs `LeadMagnetSection` "60 секунд" — pick one. |
| Fix `workouts_update` RLS leak | **S** | Split policy: athlete-self + coach-via-`trainer_athletes`; add `WITH CHECK`; remove blanket `get_my_role()='coach'`. **Security.** |

### P1 — Monetization (make revenue real & provable)
| Action | Effort | Step | Dep |
|---|---|---|---|
| YooKassa **test** shop + one full sandbox txn | **S** | Add `YOOKASSA_SHOP_ID`/`SECRET_KEY`; drive checkout→webhook→active. Unblocks all billing verification (every checkout = `503` today). | — |
| Fix register "plan" step | **S–M** | Stop granting `pro`/`team` `trial` free; default `free`, route paid → `/pricing`→`createPaymentIntent` with real tariff codes. | keys |
| Recurring auto-renewal | **M** | Vercel cron → `provider.chargeRecurring()` (zero callers today); `past_due`+dunning on fail. | live keys, cron |
| Expiry janitor + renewal reminders | **M** | Cron flips `status` on `current_period_end`; honor `cancel_at_period_end`; T-3d Resend reminder. | cron |
| Seat/limit enforcement | **M** | Read `tariffs.max_athletes/max_coaches` (seeded, read nowhere) in invite/add paths; 402. | catalog (done) |
| Org-level billing | **L** | No org→subscription link; Club tier targets this. **Blocked by tenant refactor.** | org tenant |
| Attendance→pass deduction | **M** | Mirror `sync_athlete_pass_usage()` for `org_session_participants → attended`. | group pass |
| Marketplace pass purchase (un-stub) | **M–L** | `checkout` returns `503`; wire payment.succeeded → create `athlete_passes`. | live keys |

### P2 — Access graph (org→coach/doctor/athlete, parent↔child, athlete↔trainer)
| Action | Effort | Step | Dep |
|---|---|---|---|
| Converge the two access systems | **M** | Make invite claims upsert `org_members` (or derive roster from `connections`). Today org roster silently misses invite-link members. | — |
| Real tenant entity | **L** | `organizations` own id + `owner_id` FK (decouple from `id==users.id`); owner `org_members` row at signup. Unblocks co-owners + org billing. | converge |
| Org "on-behalf" edge creation | **M** | API + RLS so org owner/admin can create `coach_athlete`/`doctor_athlete` edges. Currently impossible. | tenant |
| Parent↔child (youth) | **L** | No parent role/guardian/consent flow. Read-limited views (no medical). | tenant |
| Athlete↔personal-trainer (B2C) | **M** | First-class link distinct from org coaches; B2C onboarding without an org. | — |
| Multi-org context | **M** | Active-org selector, or constrain one-org-per-user (`.limit(1)` mis-scopes dual-club users). | tenant |

### P3 — Deepen moat (mostly premature until data + P2)
Clearance state machine (`full/limited/light_only/banned`) · traffic-light UI + training-gating · consolidate doctor→coach channels · return-to-play staged plan · **honest ML data foundation + explainable v0 (premature to call "ML" until labeled data)** · public progress share.

### P4 — AI tools + club-audit lead-gen
Conversion CTA on audit result → org onboarding · differentiate instant-AI vs 24h-email audit · doctor/parent/trainer lead-magnet variants · (autonomous lead-gen premature).

### Cross-cutting infra debt (gates safe P1/P2 expansion)
- **Commit baseline schema + RLS to migrations** — `connections, organizations, org_members, users` + RLS were created via Supabase dashboard, **not in version control** → access/tenant model is unauditable & unreproducible (085 outage was invisible until prod broke). **M**
- RLS hardening: `WITH CHECK` on write-side (`recommendations_doctor_all` lets a doctor attribute clearance to **any** athlete). **S–M**
- De-dup dead `auth.uid()` policies (`organizations` 7+ overlapping). Standardize on `get_my_user_id()`. **M**
- Automated RLS isolation tests (2 synthetic orgs) in CI before P1/P2 expand. **M**
- `FORCE ROW LEVEL SECURITY` + audit 33 admin-client (RLS-bypass) sites. **M**

---

## 6. Start Here

**Highest-leverage next epic: "Make money real and provable" — P1 monetization, starting with the YooKassa test transaction + register-flow fix + recurring/expiry crons.**

- **Unblocked and cheap to start.** One **S** step — configure a YooKassa **test** shop and push one sandbox transaction through the already-built `checkout → confirmation_url → webhook → activate` path — moves the whole dimension from unverifiable to verifiable. Today every checkout returns `503`.
- **Backbone already exists** — `lib/payments/yookassa.ts`, complete idempotent webhook, `services/billing.service.ts`, seeded 6-tier catalog, working `/pricing` + `/settings/billing`. Wiring, not building.
- **Plugs an active revenue leak** — register self-grants `pro`/`team` free. Fixing is **S–M**.
- **Sequences the rest** — org-level billing (Club tier) bridges into the **P2 tenant refactor**, which unblocks the access graph. Monetization → org-entity → access-graph is the dependency spine.

**Do in parallel this week (independent, near-zero cost):** the four **P0** integrity fixes — strip the fabricated AUC, fix the СШОР persona, unify TTV copy, patch the `workouts_update` RLS leak. Legal/security weight, block nothing.

**Explicitly defer (premature):** any "ML"/AUC framing (no labeled data), P3 clearance "светофор" & return-to-play (0 prod rows — prove existing flow first), org billing & Split Payments (blocked on tenant refactor), brand commitment (resolve trademark — lean rename — before branding spend).
