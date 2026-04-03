# Settings Header Stability Design

## Goal

Fix the top header area of the `settings` page so the top chips and summary cards stay aligned on wide screens, and translate the remaining English labels in the top area into Russian.

## Problem

The current `settings` header mixes multiple flex groups with different width behavior. On some desktop widths, the left chips and the right summary cards drift out of rhythm and appear visually displaced. The same area also still contains English labels such as `Athlete Workspace`, `Settings Hub`, `Active Section`, and `Completion`.

## Recommended Approach

Apply a focused header stabilization pass in `app/settings/page.tsx` without changing the current form layout, save logic, or sidebar navigation.

### Layout changes

- Tighten the hero header row so the left identity block and the right summary block stay visually balanced.
- Make the top chips behave predictably when horizontal space gets tighter.
- Keep the upper content header aligned so the badge and save button read as one action row instead of floating elements.

### Copy changes

- Translate the top chips to Russian.
- Translate the upper content header labels to Russian.
- Keep the rest of the page untouched unless a string is part of the same unstable top area.

## What stays the same

- No changes to form fields or profile-saving behavior.
- No changes to completion calculation.
- No changes to the sidebar navigation structure.
- No changes to role gating or Supabase logic.

## Implementation Notes

- Primary file: `app/settings/page.tsx`
- Keep this as a narrow bugfix + localization pass for the upper workspace shell only.
- Follow the same centered, stable shell rhythm already established on the other updated screens.

## Verification

- `./node_modules/.bin/eslint app/settings/page.tsx`
- `npm run build`

## Success Criteria

- The top area of `settings` no longer looks displaced on desktop widths like the one shown in the screenshots.
- The visible English labels in the upper `settings` workspace are translated into Russian.
- The save CTA and section meta remain clearly aligned and readable.
