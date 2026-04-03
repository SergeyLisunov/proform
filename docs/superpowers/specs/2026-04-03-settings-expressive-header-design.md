# Settings Expressive Header Design

## Goal

Refresh the top `settings` header so it feels warmer, more colorful, softer in shape, and more typographically refined without reintroducing the previous layout problems.

## Design Direction

The header should stay compact and structurally stable, but feel more intentional and premium.

### Visual treatment

- Keep the current compact card structure.
- Add a warmer, more expressive background treatment with subtle gradients or soft color blooms.
- Increase the sense of “curve” through softer, slightly more playful corner treatment.
- Make the chips more colorful and distinctive while keeping them readable.
- Give the back button a more designed feel instead of a plain neutral container.

### Typography

- Remove the heavy `pf-num` treatment from the main `settings` title.
- Use a cleaner `DM Sans` hierarchy for the title and supporting copy.
- Reduce the title size so it no longer dominates the page.
- Keep the supporting text readable but slightly tighter and more polished.

## What stays the same

- No changes to page layout below the top header.
- No changes to save logic or form logic.
- No reintroduction of duplicate badges or duplicate save buttons.
- No changes to the lower save CTA placement.

## Implementation Notes

- Primary file: `app/settings/page.tsx`
- This is a focused visual refinement pass for the compact top header card only.
- The result should feel richer and more “designed” without becoming noisy or unstable.

## Verification

- `./node_modules/.bin/eslint app/settings/page.tsx`
- `npm run build`

## Success Criteria

- The top `settings` header looks more colorful and visually distinctive.
- The header feels softer and more expressive in shape.
- The main title is smaller, cleaner, and more elegant.
- The header remains stable and does not reintroduce the earlier layout regressions.
