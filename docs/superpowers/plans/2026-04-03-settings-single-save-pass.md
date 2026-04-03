# Settings Single Save and Compact Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave only one `Сохранить изменения` button at the bottom of `settings` and replace the stretched top hero with a simpler compact header card.

**Architecture:** Keep the page content, form logic, and lower save bar intact, but remove the upper save CTA from the `Активный раздел` row and restyle the top `settings` header from a decorative full-width hero into a normal compact card.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Make Settings a Single-Save Layout

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `docs/progress-log.md`
- Test: `app/settings/page.tsx`

- [ ] **Step 1: Confirm the duplicate save CTA**

Confirm that `app/settings/page.tsx` currently renders:

```tsx
- one save button in the upper `Активный раздел` row
- one save button in the bottom completion bar
```

Expected: the page currently contains two `Сохранить изменения` CTAs.

- [ ] **Step 2: Remove the upper save CTA**

Update the upper `Активный раздел` row so it no longer renders the save button and keeps only lightweight metadata that helps orient the user.

Expected: the only remaining save CTA on the page is the bottom one.

- [ ] **Step 3: Reset the stretched top hero**

Replace the current decorative top `settings` hero styling with a more compact card-like header while preserving:

```tsx
- back button
- localized chips
- page title and description
```

Expected: the top of the page no longer reads as a long orange strip.

- [ ] **Step 4: Re-read for scope control**

Confirm there are no unrelated changes to:

- form fields
- section content
- save logic
- bottom save bar behavior

Expected: this remains a narrow layout/CTA cleanup pass.

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
- Completed the settings single-save pass:
  - removed the upper save CTA so the settings page now uses only the bottom save button
  - reset the stretched top hero into a simpler compact header card
- Re-verified the settings single-save pass with:
  - `./node_modules/.bin/eslint app/settings/page.tsx`
  - `npm run build`
```

- [ ] **Step 8: Commit the pass**

Run:

```bash
git add app/settings/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-settings-single-save-pass.md
git commit -m "Simplify settings header and remove duplicate save CTA"
```

Expected: one commit containing the compact-header fix, the single-save cleanup, the plan doc, and the progress log update.
