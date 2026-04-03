# Settings Centered Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the settings screen feel like a centered profile workspace instead of an overly wide dashboard surface.

**Architecture:** Keep the fix local to `app/settings/page.tsx`. Narrow the outer centered rail and tighten the desktop `aside + content` grid so the form reads as one intentional workspace while preserving the existing cards, save-state UI, and Supabase flows.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Tailwind utility classes

---

### Task 1: Tighten the settings workspace geometry

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] Reduce the page-level max width for the settings workspace.
- [ ] Tighten the desktop grid proportions for the left navigation rail and the main form column.
- [ ] Keep the existing section order, cards, and interaction design unchanged.

### Task 2: Verify and document

**Files:**
- Modify: `docs/progress-log.md`

- [ ] Add a progress-log entry for the settings centering pass.
- [ ] Run `./node_modules/.bin/eslint app/settings/page.tsx`.
- [ ] Run `npm run build`.
- [ ] Commit the pass with a focused message after verification succeeds.
