# Athletes Centered Workspace Design

## Goal

Make the `athletes` screen feel centered and composed on wide desktop layouts without changing its current coach workflow, demo-driven interactions, or visual language.

## Problem

The current `athletes` page uses a full-width shell with no shared outer rail. On large screens this makes the hero, KPI rows, and `roster + detail` workspace feel stretched across the canvas instead of reading as one intentional coach workspace.

## Recommended Approach

Apply the same centered-workspace strategy already used in `messages` and `settings`, but tuned for the more complex two-column coaching surface in `athletes`.

### Geometry changes

- Add a single outer wrapper that centers the full page with `mx-auto` and a constrained max width.
- Keep the hero, KPI strip, main `roster + detail` split, and bottom workflow note inside that shared rail.
- Tighten the desktop split so the roster column remains useful but does not visually overpower the detail panel.

### What stays the same

- No changes to athlete selection behavior.
- No changes to tabs, charts, diary, or coach mark interactions.
- No changes to demo data, role gating, or visual styling direction.
- No component extraction or refactor beyond what is needed for layout clarity.

## Implementation Notes

- Primary file: `app/athletes/page.tsx`
- Keep the page structure intact; this is a geometry pass, not a redesign pass.
- Match the rhythm already introduced on `messages` and `settings` so screen-to-screen width behavior feels consistent.

## Verification

- `./node_modules/.bin/eslint app/athletes/page.tsx`
- `npm run build`

## Success Criteria

- The `athletes` page reads as a centered workspace on wide screens.
- The main `roster + detail` layout feels balanced instead of stretched.
- No regression in existing coach-only access or athlete detail interactions.
