# Diary Comparison Cues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add same-type comparison cues to athlete diary cards so each workout can be read relative to the previous workout of the same type.

**Architecture:** Keep the pass inside `app/diary/page.tsx`. Derive previous-same-type relationships client-side from the already loaded workouts, then render compact comparison chips and neutral states in the existing list/grid cards.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Tailwind utility classes

---

### Task 1: Add client-side comparison helpers

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] Add helper types and functions for previous same-type workout lookup.
- [ ] Add compact comparison builders for strain, duration, and average heart rate.
- [ ] Keep thresholds simple and readable for athlete-facing UI.

### Task 2: Surface comparison cues in diary cards

**Files:**
- Modify: `app/diary/page.tsx`

- [ ] Render comparison context in list cards under the primary metric chips.
- [ ] Render the same comparison context in grid cards without overloading the layout.
- [ ] Add neutral fallback text when a same-type comparison is unavailable.

### Task 3: Verify and document

**Files:**
- Modify: `docs/progress-log.md`

- [ ] Add a progress-log entry for the comparison-cue pass.
- [ ] Run `./node_modules/.bin/eslint app/diary/page.tsx`.
- [ ] Run `npm run build`.
- [ ] Commit the pass with a focused message after verification succeeds.
