# Diary History And Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the athlete diary history into a stronger review workspace with grouped timeline presentation and a more useful detail drawer.

**Architecture:** Keep all changes inside `app/diary/page.tsx` for this pass to avoid structural churn. Add small client-side helpers for grouped history and selection summary, then recompose the athlete-only history UI and detail drawer around the existing workout data and Supabase flows.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind utility classes, Supabase browser client

---

### Task 1: Add history summary and grouping helpers

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] Add small helper functions for grouped timeline labels and same-week detection.
- [ ] Derive current-selection summary values from `filtered` workouts inside `AthleteDiary`.
- [ ] Keep all calculations client-side and reuse existing `fmtDate`, `fmtDuration`, and `parseDate` helpers.

### Task 2: Recompose the athlete history toolbar and list/grid presentation

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] Replace the flat filter row with a denser history toolbar that includes active result count and a quick action.
- [ ] Rebuild list view into grouped sections `Сегодня`, `Эта неделя`, `Ранее`.
- [ ] Strengthen list and grid cards with clearer metric chips, better hierarchy, and short context previews.
- [ ] Improve loading and empty states to match the redesigned athlete shell.

### Task 3: Upgrade the workout detail drawer

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] Rework `ViewEditDrawer` header into a summary hero with date, activity, and key workout metrics.
- [ ] Recompose view mode into clearer sections for timing, effort, physiology, and notes.
- [ ] Preserve existing edit/save/delete logic and data payloads.
- [ ] Keep edit mode functional while improving spacing and consistency with the new quick-add drawer.

### Task 4: Verify, document, and commit

**Files:**
- Modify: `docs/progress-log.md`

- [ ] Add a new progress-log entry for the history/detail pass.
- [ ] Run `./node_modules/.bin/eslint app/diary/page.tsx`.
- [ ] Run `npm run build`.
- [ ] Commit the pass with a focused message after verification succeeds.
