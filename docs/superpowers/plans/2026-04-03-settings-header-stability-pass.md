# Settings Header Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the top `settings` workspace header and translate the remaining English labels in that upper area into Russian.

**Architecture:** Keep the existing `settings` form and sidebar intact, but rebalance the upper hero row and content header so the chips, summary cards, completion badge, and save CTA align predictably on desktop widths. Limit copy changes to the unstable top area only.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Fix the Settings Header Geometry and Copy

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `docs/progress-log.md`
- Test: `app/settings/page.tsx`

- [ ] **Step 1: Confirm the unstable header structure**

Read the current top workspace shell in `app/settings/page.tsx`:

```tsx
<div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
  <div className="max-w-3xl">
    ...
    <span> Ath﻿lete Workspace </span>
    <span> Settings Hub </span>
  </div>

  <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
```

And the current content header:

```tsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
  ...
  <div className="flex flex-wrap items-center gap-3">
    <div>Completion: {completion}%</div>
```

Expected: the top area relies on loose flex balancing and still contains English labels in the visible upper shell.

- [ ] **Step 2: Stabilize the hero layout**

Adjust the top `settings` hero so the identity block and summary block use a more stable wide-screen layout, for example by moving from a loose `justify-between` flex row to a controlled `xl:grid` with explicit columns.

Expected: the top chips on the left and the summary cards on the right stay visually aligned on the desktop widths shown in the screenshots.

- [ ] **Step 3: Translate the top hero labels**

Replace the remaining English labels in the upper hero area:

```tsx
Athlete Workspace -> Рабочее пространство атлета
Settings Hub -> Центр настроек
```

Expected: no English labels remain in the top hero shell.

- [ ] **Step 4: Stabilize and translate the upper content header**

Update the content header so the section meta and save CTA align more predictably, and translate the remaining English labels:

```tsx
Active Section -> Активный раздел
Completion: {completion}% -> Заполнено: {completion}%
```

Expected: the upper action row looks intentional and all visible labels in that area are in Russian.

- [ ] **Step 5: Re-read the page for scope control**

Confirm the changes are limited to:

- the top hero area
- the upper content header area
- translated labels in those two areas only

Expected: no unrelated changes to fields, tabs, save logic, or sidebar content.

- [ ] **Step 6: Verify lint**

Run:

```bash
./node_modules/.bin/eslint app/settings/page.tsx
```

Expected: exit code `0`.

- [ ] **Step 7: Verify build**

Run:

```bash
npm run build
```

Expected: exit code `0`.

- [ ] **Step 8: Update the progress log**

Append a new entry under `2026-04-03` in `docs/progress-log.md`:

```md
- Completed the settings header stability pass:
  - stabilized the upper settings shell so the top chips, summary cards, and action row align more predictably on desktop widths
  - translated the remaining English labels in the upper settings workspace into Russian
- Re-verified the settings header stability pass with:
  - `./node_modules/.bin/eslint app/settings/page.tsx`
  - `npm run build`
```

- [ ] **Step 9: Commit the pass**

Run:

```bash
git add app/settings/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-settings-header-stability-pass.md
git commit -m "Fix settings header alignment and copy"
```

Expected: one commit containing the layout fix, the translation fix, the plan doc, and the progress log update.
