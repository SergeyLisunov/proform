# Settings Expressive Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the compact `settings` header warmer, more colorful, softer in shape, and typographically cleaner while keeping the stable single-save layout.

**Architecture:** Keep the current compact header structure and only restyle the top card in `app/settings/page.tsx`. Preserve the single bottom save CTA, page structure, and form logic.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Restyle the Settings Header

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `docs/progress-log.md`
- Test: `app/settings/page.tsx`

- [ ] **Step 1: Confirm the current compact header baseline**

Read the current compact header in `app/settings/page.tsx` and confirm it now contains:

```tsx
- back button
- two localized chips
- title, description, and helper line
```

Expected: the structure is stable and ready for a purely visual pass.

- [ ] **Step 2: Add a richer header surface**

Restyle the top header card with:

```tsx
- warmer gradient or soft color blooms
- softer, more expressive rounded corners
- more intentional shadow/border treatment
```

Expected: the header feels more alive and designed without returning to the old stretched-strip problem.

- [ ] **Step 3: Refine chips and back button**

Make the chips and back button more colorful and intentional while preserving readability and click affordance.

Expected: the metadata row feels more premium and less neutral.

- [ ] **Step 4: Refine typography**

Update the title and supporting copy so that:

```tsx
- the main title no longer uses the heavy `pf-num` style
- the title is smaller and cleaner
- the body copy remains readable but slightly tighter
```

Expected: the header typography feels more elegant and less oversized.

- [ ] **Step 5: Re-read for scope control**

Confirm there are no unrelated changes to:

- lower action row
- save button placement
- form sections
- sidebar navigation

Expected: this remains a compact top-header visual pass only.

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
- Completed the settings expressive header pass:
  - made the compact settings header warmer and more colorful with softer card treatment
  - refined the title and supporting typography to feel cleaner and less oversized
- Re-verified the settings expressive header pass with:
  - `./node_modules/.bin/eslint app/settings/page.tsx`
  - `npm run build`
```

- [ ] **Step 9: Commit the pass**

Run:

```bash
git add app/settings/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-settings-expressive-header-pass.md
git commit -m "Refresh settings header styling"
```

Expected: one commit containing the visual pass, the plan doc, and the progress log update.
