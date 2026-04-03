# Organization Members Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `org/members` into a modern organization workspace that matches the updated product shell while preserving existing member-management behavior.

**Architecture:** Keep all data loading, filtering, mutation, and `InviteDrawer` behavior intact inside `app/org/members/page.tsx`, but rebuild the page shell into a stronger hero, KPI strip, cohesive filter toolbar, and cleaner list/empty-state surfaces.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase

---

### Task 1: Rebuild the Organization Members Workspace Shell

**Files:**
- Modify: `app/org/members/page.tsx`
- Modify: `docs/progress-log.md`
- Test: `app/org/members/page.tsx`

- [ ] **Step 1: Confirm the current page boundaries**

Re-read `app/org/members/page.tsx` and confirm the redesign scope is limited to:

```tsx
- page header
- KPI summary row
- search and filter toolbar
- member list / empty state surfaces
```

Expected: `InviteDrawer`, data queries, filters, and status mutation logic remain untouched.

- [ ] **Step 2: Replace the flat header with an organization hero**

Update the top of the page so it becomes a stronger organization hero with:

```tsx
- eyebrow or metadata chips
- stronger page title/subtitle
- preserved `Добавить участника` CTA
```

Expected: the screen no longer opens with a plain legacy CRUD header.

- [ ] **Step 3: Recompose the KPI row**

Restyle the KPI cards into a denser, more intentional summary strip that matches the modern product shell.

Expected: counts remain the same, but hierarchy and rhythm feel closer to the updated app screens.

- [ ] **Step 4: Rebuild the control bar**

Turn search, role filters, and status filters into a cohesive control surface.

Expected: the filters look like one designed toolbar instead of separate legacy utility groups.

- [ ] **Step 5: Upgrade the list and empty states**

Restyle the empty state and members list/table area so it matches the updated workspace language while preserving existing actions.

Expected: member cards/rows remain functional, and empty/loading states feel intentional instead of placeholder-like.

- [ ] **Step 6: Re-read for scope control**

Confirm there are no changes to:

- Supabase queries
- `InviteDrawer` internals
- member status logic
- toast behavior

Expected: this stays a shell redesign, not a behavior rewrite.

- [ ] **Step 7: Verify lint**

Run:

```bash
./node_modules/.bin/eslint app/org/members/page.tsx
```

Expected: exit code `0`.

- [ ] **Step 8: Verify build**

Run:

```bash
npm run build
```

Expected: exit code `0`.

- [ ] **Step 9: Update the progress log**

Append a new entry under `2026-04-03` in `docs/progress-log.md`:

```md
- Completed the organization members workspace pass:
  - rebuilt `org/members` into a stronger organization workspace with a denser hero, cleaner KPI strip, and more cohesive filters
  - upgraded the members list and empty state surfaces without changing invite or member-management logic
- Re-verified the organization members workspace pass with:
  - `./node_modules/.bin/eslint app/org/members/page.tsx`
  - `npm run build`
```

- [ ] **Step 10: Commit the pass**

Run:

```bash
git add app/org/members/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-org-members-workspace-pass.md
git commit -m "Redesign organization members workspace"
```

Expected: one commit containing the workspace redesign, the plan doc, and the progress log update.
