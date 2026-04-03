# Athletes Centered Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the `athletes` screen inside a constrained desktop rail so the coach workspace feels balanced on wide layouts.

**Architecture:** Keep the current `app/athletes/page.tsx` structure intact, but wrap the page in a shared centered container and tighten the main `roster + detail` split. Preserve all demo data, role-gating, athlete selection, and detail interactions.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Tighten the Athletes Workspace Geometry

**Files:**
- Modify: `app/athletes/page.tsx`
- Test: `app/athletes/page.tsx`

- [ ] **Step 1: Confirm the current outer geometry to change**

Read the current page wrapper and desktop split in `app/athletes/page.tsx`:

```tsx
return (
  <div className="flex flex-col gap-6 pf-enter">
    ...
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
      <Surface className="h-fit">
```

Expected: the page has no shared `mx-auto` constrained rail and the main coach split uses a wide `340px / 1fr` desktop layout.

- [ ] **Step 2: Apply the centered workspace rail**

Update the outer wrapper so the hero, KPI row, main split, and footer note share one centered rail:

```tsx
return (
  <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pf-enter">
```

Expected: the screen now behaves like a centered workspace on wide displays instead of stretching across the full shell.

- [ ] **Step 3: Tighten the desktop roster/detail split**

Update the main workspace grid to reduce the roster column slightly:

```tsx
<div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
```

Expected: the roster remains comfortable to scan, while the athlete detail panel becomes the visual center of the page.

- [ ] **Step 4: Re-read the page for accidental layout drift**

Check that the hero, KPI row, `Surface` wrappers, and footer note are still siblings under the same outer container, and confirm no interaction logic moved.

Expected: only geometry changes; no behavior changes.

- [ ] **Step 5: Verify lint**

Run:

```bash
./node_modules/.bin/eslint app/athletes/page.tsx
```

Expected: exit code `0`.

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: exit code `0`.

- [ ] **Step 7: Update the progress log**

Append a new entry to `docs/progress-log.md` under `2026-04-03` describing:

```md
- Completed the athletes centering pass:
  - wrapped the athletes workspace in a centered max-width rail for wide layouts
  - tightened the desktop roster/detail split so the coach workspace reads as a balanced center column
- Re-verified the athletes centering pass with:
  - `./node_modules/.bin/eslint app/athletes/page.tsx`
  - `npm run build`
```

- [ ] **Step 8: Commit the pass**

Run:

```bash
git add app/athletes/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-athletes-centered-workspace-pass.md
git commit -m "Center athletes workspace geometry"
```

Expected: one commit containing the geometry fix, the plan doc, and the progress log update.
