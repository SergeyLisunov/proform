# Organization Newsletters Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `org/newsletters` into a cohesive communication workspace without changing newsletter behavior.

**Architecture:** Keep the current fetch, create, and status-update flows intact while rebuilding the page composition around a stronger hero, KPI strip, richer section rails, denser newsletter cards, and a cleaner composer modal. All changes remain local to the newsletters page and progress log.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing ProForm design tokens and organization workspace patterns

---

### Task 1: Rebuild the newsletters workspace shell

**Files:**
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/page.tsx`
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md`
- Test: `/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/page.tsx`

- [ ] Step 1: Replace the old flat header with an organization-style communications hero and primary newsletter CTA.
- [ ] Step 2: Add a KPI strip for total newsletters, drafts, scheduled items, and sent newsletters.
- [ ] Step 3: Rebuild the draft, scheduled, and sent sections into stronger communication rails with improved empty states.
- [ ] Step 4: Refresh newsletter cards and the create-newsletter modal while preserving current save/send/schedule logic.
- [ ] Step 5: Update `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md` with the completed pass and verification notes.
- [ ] Step 6: Run `./node_modules/.bin/eslint app/org/newsletters/page.tsx` from `/Users/sergeylisunov/Documents/Playground/proform` and verify it passes.
- [ ] Step 7: Run `npm run build` from `/Users/sergeylisunov/Documents/Playground/proform` and verify the build passes.
- [ ] Step 8: Commit the newsletters workspace redesign with a focused git message.
