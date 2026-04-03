# Organization Newsletter Stats Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `org/newsletters/[id]/stats` into a cohesive communication analytics workspace without changing newsletter stats behavior.

**Architecture:** Keep the existing data-fetching and rate calculations intact while rebuilding the page shell around a stronger hero, better KPI cards, richer rate panels, and a clearer content preview.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing ProForm design tokens

---

### Task 1: Rebuild the newsletter stats workspace

**Files:**
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/[id]/stats/page.tsx`
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md`
- Test: `/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/[id]/stats/page.tsx`

- [ ] Step 1: Replace the old header with a communication-style hero and better newsletter meta.
- [ ] Step 2: Refresh the stats KPI cards and rate cards to match the new newsletters workspace.
- [ ] Step 3: Improve the content preview card while preserving the existing stats calculations and fetch logic.
- [ ] Step 4: Update `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md` with the completed pass and verification notes.
- [ ] Step 5: Run `./node_modules/.bin/eslint app/org/newsletters/[id]/stats/page.tsx` from `/Users/sergeylisunov/Documents/Playground/proform` and verify it passes.
- [ ] Step 6: Run `npm run build` from `/Users/sergeylisunov/Documents/Playground/proform` and verify the build passes.
- [ ] Step 7: Commit the newsletter stats workspace redesign with a focused git message.
