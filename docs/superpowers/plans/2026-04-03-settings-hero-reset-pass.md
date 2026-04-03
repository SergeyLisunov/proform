# Settings Hero Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stretched top `settings` strip with a simpler, stable hero composition that keeps the upper workspace aligned and fully in Russian.

**Architecture:** Rebuild only the upper `settings` hero in `app/settings/page.tsx` so chips, title, subtitle, and summary cards live inside one coherent header block. Keep the lower `Активный раздел + Сохранить изменения` row, form layout, sidebar, and save logic intact.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS

---

### Task 1: Reset the Settings Hero Composition

**Files:**
- Modify: `app/settings/page.tsx`
- Modify: `docs/progress-log.md`
- Test: `app/settings/page.tsx`

- [ ] **Step 1: Confirm the structural issue**

Read the current top `settings` hero and confirm that the chips still live as a separate stretched row above the real header content.

Expected: the upper shell still reads as a detached decorative strip rather than a single header block.

- [ ] **Step 2: Rebuild the hero as one coherent header**

Update the hero in `app/settings/page.tsx` so:

```tsx
- the chips sit close to the title/subtitle block
- the back button remains attached to the title area
- the completion/focus cards stay grouped as summary cards
- the top area no longer reads as a separate horizontal band
```

Expected: the upper workspace reads as one product header instead of two competing rows.

- [ ] **Step 3: Preserve Russian copy in the upper shell**

Keep the translated Russian labels in the rebuilt hero and ensure no English strings return in the upper settings workspace.

Expected: the hero remains fully localized.

- [ ] **Step 4: Re-read the lower action row for consistency**

Confirm that the lower `Активный раздел + Заполнено + Сохранить изменения` row still aligns cleanly with the new hero and needs no unrelated changes.

Expected: the main action row remains readable and stable.

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
- Completed the settings hero reset pass:
  - removed the stretched top strip feeling by rebuilding the upper settings hero as one coherent header
  - kept the upper settings workspace fully in Russian while preserving the current save flow and form layout
- Re-verified the settings hero reset pass with:
  - `./node_modules/.bin/eslint app/settings/page.tsx`
  - `npm run build`
```

- [ ] **Step 8: Commit the pass**

Run:

```bash
git add app/settings/page.tsx docs/progress-log.md docs/superpowers/plans/2026-04-03-settings-hero-reset-pass.md
git commit -m "Reset settings hero composition"
```

Expected: one commit containing the hero reset, the plan doc, and the progress log update.
