# Duplicate exports rule — W13 Day 64

## Why this exists

W12 ghost-merge incident root cause: `services/coach-reviews.service.ts` had **two** `export async function replyToReview()` declarations in the same file.

- W10 Day 48 (PR #69) added the original implementation (direct Supabase write).
- W11 Day 55 (PR #76) added a refactored version (calls API route) **without removing** the original.
- Local SWC tolerated the duplicate silently ("last-write wins").
- Vercel SWC failed every subsequent build with `defined multiple times`.
- 8 PRs merged but never deployed. Production stuck 3 days.

This rule prevents that class of bug at three layers.

## Three-layer defence

| Layer | Tool | What it catches | When it runs |
|---|---|---|---|
| 1. ESLint rule | `@typescript-eslint/no-redeclare` (error level) | Any redeclared identifier in same scope, including duplicate `export function X` | `npm run lint` (pre-commit + CI) |
| 2. Script audit | `scripts/audit-duplicate-exports.sh` | Belt-and-braces grep for `export ... function/const/interface/type/class X` duplicates | `npm run lint:duplicates` (CI + ad-hoc) |
| 3. Build parity | `npm run build` in CI (W13 Day 63) | Same SWC что Vercel запускает на prod — catches anything ESLint misses | GitHub Actions on every PR |

## Layer 1: ESLint rule

In `.eslintrc.json`:

```json
{
  "rules": {
    "@typescript-eslint/no-redeclare": "error",
    "no-redeclare": "off"
  }
}
```

The base `no-redeclare` is turned off because the TS variant handles overloads and ambient declarations correctly.

## Layer 2: Audit script

```bash
npm run lint:duplicates
```

Internally:
```bash
bash scripts/audit-duplicate-exports.sh
```

Scans `services/`, `app/`, `lib/`, `components/` for duplicate exported identifiers. Exit code 1 if any found.

### Output example (clean run)

```
✅ No duplicate exports detected across: services app lib components
```

### Output example (with duplicate)

```
❌ DUPLICATE EXPORTS in services/coach-reviews.service.ts:
   → replyToReview (defined multiple times)
      246:export async function replyToReview(input: ReplyToReviewInput)
      306:export async function replyToReview(input: ReplyInput)

💥 Found duplicate exports in 1 file(s).
```

## Layer 3: Build parity in CI

Covered by W13 Day 63. See [vercel-deploy-gate.md](./vercel-deploy-gate.md).

## Recommended developer workflow

1. **During refactor**: before adding a new function declaration, `grep -n "export.*function X" <file>` to confirm the old version is gone.
2. **Before commit**: run `npm run lint && npm run lint:duplicates`.
3. **Before push**: optionally run `npm run build` locally to verify SWC parity.
4. **CI**: workflow blocks merge if any layer fails.

## Anti-patterns this catches

| Pattern | Why bad |
|---|---|
| `export function X` + `export function X` | Direct duplicate — W12 case |
| `export const X = ...` + `export function X` | Same name, different decl type — TS catches but ESLint clearer |
| `export interface X` + `export type X` | TS catches; ESLint adds noise-free message |

## What it doesn't catch

- Cross-file naming conflicts (different files exporting same name) — that's a non-issue at module level
- Re-exports (`export { X } from './other'`) — those are aliased, not duplicates
- Default exports vs named — different namespaces
- Function overloads (declaration merging) — that's intentional pattern

## Adding to pre-commit (optional)

If `husky` or similar is added later:

```bash
#!/usr/bin/env bash
# .husky/pre-commit
npm run lint:duplicates
npm run lint
```

For now: rely on CI gate.

## Related

- [vercel-deploy-gate.md](./vercel-deploy-gate.md) — branch protection setup
- [debug-red-vercel-build.md](./debug-red-vercel-build.md) — when build goes red
- [W12 wrap (post-mortem section)](../sprints/W12-wrap.md) — origin story
