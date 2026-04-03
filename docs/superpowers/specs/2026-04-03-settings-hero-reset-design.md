# Settings Hero Reset Design

## Goal

Rebuild the top hero area of the `settings` page so it reads as a stable, compact product header instead of a stretched decorative strip with drifting buttons.

## Root Cause

The current top area is not failing because of small spacing values. The real problem is structural: the top chips live in a separate, extra-wide horizontal band that visually competes with the real page header below it. Even when the elements are technically aligned, the page still looks broken because the eye reads the chips as detached controls floating across the top edge.

## Recommended Approach

Replace the current stretched top strip with a simpler hero composition that keeps all top information inside one coherent content block.

### Layout changes

- Remove the current stretched top chip band as a separate visual row.
- Move the identity chips closer to the page title and subtitle so they behave like metadata for the header, not floating controls.
- Keep the completion and focus readouts as compact cards grouped with the main header area.
- Preserve the lower `Активный раздел + Сохранить изменения` row, but let it remain the only action row in the upper workspace.

### Copy expectations

- Keep all translated Russian labels from the previous pass.
- Ensure no English labels remain in the upper workspace shell.

## What stays the same

- No changes to form logic, saving logic, or completion calculation.
- No changes to the sidebar navigation structure.
- No changes to form sections or field layout.
- No changes to Supabase or user/profile flows.

## Implementation Notes

- Primary file: `app/settings/page.tsx`
- This is a focused hero composition reset for the upper `settings` shell only.
- The target is visual stability and clearer hierarchy, not a broader redesign of the page.

## Verification

- `./node_modules/.bin/eslint app/settings/page.tsx`
- `npm run build`

## Success Criteria

- The top of `settings` no longer reads as a broken, stretched band.
- Chips, title, summary cards, and action row feel like one coherent header.
- The upper `settings` workspace remains fully in Russian.
