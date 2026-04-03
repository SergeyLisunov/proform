# Settings Hero Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicated `Заполнено` strip from the top of `settings` and simplify the hero so the upper workspace reads as one compact header.

**Architecture:** Keep the current `settings` form, save flow, and lower action row intact, but remove the top summary cards from the hero and collapse the hero into a single title block with back button, chips, and description.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Remove the Duplicate Top Summary Strip

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `docs/progress-log.md`
- Test: `app/settings/page.tsx`

- [ ] **Step 1: Confirm the duplication**

Read the current `settings` hero and confirm that:

```tsx
- the top hero still contains a `Заполнено` summary card
- the lower action row also contains `Заполнено: {completion}%`
```

Expected: the page currently duplicates the same completion signal in two different upper areas.

- [ ] **Step 2: Simplify the hero**

Update `app/settings/page.tsx` so the hero contains only:

```tsx
- back button
- localized chips
- page label, title, and description
```

Expected: the top of `settings` no longer reads as a stretched strip with floating summary cards.

- [ ] **Step 3: Keep only one completion badge**

Preserve the lower completion badge in the `Активный раздел` row and remove the upper duplicate.

Expected: `Заполнено` appears only once in the upper workspace.

- [ ] **Step 4: Re-read for scope control**

Confirm there are no unrelated changes to:

- form fields
- sidebar navigation
- save logic
- active section row behavior

Expected: this remains a narrow dedup/layout pass.

- [ ] **Step 5: Verify lint**

Run:

```bash
./node_modules/.bin/eslint app/settings/page.tsx
```

Expected: exit code `0`.

- [ ] **Step 6: Verify build**

Run:

```bash
npm run build
```

Expected: exit code `0`.

- [ ] **Step 7: Update the progress log**

Append a new entry under `2026-04-03` in `docs/progress-log.md`:

```md
- Completed the settings hero dedup pass:
  - removed the duplicated top `Заполнено` strip from the settings hero
  - simplified the upper settings hero to a compact title block while preserving the lower action row
- Re-verified the settings hero dedup pass with:
  - `./node_modules/.bin/eslint app/settings/page.tsx`
  - `npm run build`
```

- [ ] **Step 8: Commit the pass**

Run:

```bash
git add app/settings/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-settings-hero-dedup-pass.md
git commit -m "Remove duplicated settings hero summary"
```

Expected: one commit containing the dedup fix, the plan doc, and the progress log update.
