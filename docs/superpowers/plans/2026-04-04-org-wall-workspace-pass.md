# Organization Wall Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `org/wall` into a cohesive organization content workspace without changing wall post behavior.

**Architecture:** Keep all existing services and post operations intact while rebuilding the page composition around a stronger hero, KPI summary strip, richer pinned/feed zones, and a cleaner create-post modal. All changes stay inside the wall page and progress log.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing ProForm design tokens and organization workspace patterns

---

### Task 1: Rebuild the wall workspace shell

**Files:**
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/app/org/wall/page.tsx`
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md`
- Test: `/Users/sergeylisunov/Documents/Playground/proform/app/org/wall/page.tsx`

- [ ] Step 1: Replace the old flat header with an organization-style hero that shows organization context, wall purpose, and the primary create CTA.
- [ ] Step 2: Add a summary strip for total posts, pinned posts, event posts, and public visibility.
- [ ] Step 3: Promote pinned posts into a stronger dedicated section and redesign feed cards with better badge/meta hierarchy.
- [ ] Step 4: Refresh the create-post modal styling while preserving `handleCreate` logic and field behavior.
- [ ] Step 5: Update `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md` with the completed pass and verification notes.
- [ ] Step 6: Run `./node_modules/.bin/eslint app/org/wall/page.tsx` from `/Users/sergeylisunov/Documents/Playground/proform` and verify it passes.
- [ ] Step 7: Run `npm run build` from `/Users/sergeylisunov/Documents/Playground/proform` and verify the build passes.
- [ ] Step 8: Commit the wall workspace redesign with a focused git message.
