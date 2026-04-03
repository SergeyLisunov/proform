# Admin Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `admin` into a cohesive command center without changing the current demo admin behavior.

**Architecture:** Keep the current tab structure and modal behavior intact while rebuilding the page around a stronger hero, KPI strip, cleaner tabs shell, richer tab content, and Russian copy throughout the visible admin demo data.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, existing ProForm design tokens

---

### Task 1: Rebuild the admin workspace

**Files:**
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/app/admin/page.tsx`
- Modify: `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md`
- Test: `/Users/sergeylisunov/Documents/Playground/proform/app/admin/page.tsx`

- [ ] Step 1: Replace the old flat admin header with a stronger command center hero and KPI strip.
- [ ] Step 2: Refresh the tab shell and reorganize the content presentation for users, privacy, audit, and system tabs.
- [ ] Step 3: Translate visible English demo strings on the admin screen into Russian while preserving the current demo structure.
- [ ] Step 4: Update `/Users/sergeylisunov/Documents/Playground/proform/docs/progress-log.md` with the completed pass and verification notes.
- [ ] Step 5: Run `./node_modules/.bin/eslint app/admin/page.tsx` from `/Users/sergeylisunov/Documents/Playground/proform` and verify it passes.
- [ ] Step 6: Run `npm run build` from `/Users/sergeylisunov/Documents/Playground/proform` and verify the build passes.
- [ ] Step 7: Commit the admin command center redesign with a focused git message.
