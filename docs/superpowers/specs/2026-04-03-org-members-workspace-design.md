# Organization Members Workspace Design

## Goal

Redesign the `org/members` screen so it matches the modern workspace language already used on the updated product screens, while keeping the current member management logic intact.

## Problem

The current `org/members` page still uses an older CRUD-style layout with a flat header, utility-first filters, and weak visual hierarchy. In production it feels like a different product compared with the refreshed `dashboard`, `calendar`, `messages`, `athletes`, and `settings` screens.

## Recommended Approach

Apply a focused organization-workspace redesign pass to `app/org/members/page.tsx` without changing the current data flow, invite flow, or filtering logic.

### Layout changes

- Replace the old flat page header with a stronger organization hero.
- Keep the existing KPI cards, but recompose them into a denser and more intentional summary strip.
- Rebuild the search and filter area into a more cohesive control bar.
- Upgrade the list and empty state surfaces so they match the newer shell rhythm and card language.

### Interaction boundaries

- Preserve `InviteDrawer` behavior.
- Preserve role/status filtering behavior.
- Preserve Supabase loading and member mutation behavior.
- Preserve current route and access assumptions.

## What stays the same

- No changes to membership logic or database queries.
- No changes to invite behavior.
- No changes to member status transitions unless needed for visual clarity only.
- No broader redesign of other `org/*` screens in this pass.

## Implementation Notes

- Primary file: `app/org/members/page.tsx`
- This should be a product-shell redesign, not a logic refactor.
- The result should visually align with the redesigned `org`, `dashboard`, and `messages` workspaces.

## Verification

- `./node_modules/.bin/eslint app/org/members/page.tsx`
- `npm run build`

## Success Criteria

- `org/members` no longer looks like an old isolated admin page.
- The screen feels visually consistent with the newer product areas.
- All existing member-management behavior continues to work as before.
