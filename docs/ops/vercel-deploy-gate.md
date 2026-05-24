# Vercel deploy gate — branch protection setup (W13 Day 63)

## Why this exists

W12 incident: 8 PRs «merged» в main but Vercel build failed silently for 3 days. Production stuck на стале W11 Day 54 commit. Root cause = duplicate `replyToReview()` export что local SWC tolerated но Vercel SWC blocked. No CI gate enforced production-deploy-success на merge.

This doc explains how to lock that gate shut.

## Two-layer defence

| Layer | What it catches | When it runs |
|---|---|---|
| **PR check: `TypeScript & Security Review`** | tsc errors, duplicate exports, type mismatches | On every PR push (GitHub Actions) |
| **PR check: `Next.js build (SWC parity)`** | SWC-level errors (duplicate function decls, module resolution) что Vercel hits | On every PR push (same job, new step) |
| **PR check: `Vercel`** | Production-equivalent build with real env, deps install timing | On every PR push (Vercel GitHub integration) |
| **Branch protection on main** | Blocks merge if any required check failing | On merge attempt (GitHub) |

The W12 incident would have been **caught by layer 2** (Next.js build SWC step) — added в `.github/workflows/code-review.yml` as a hard step. Layer 3 (Vercel) would also catch it, но branch protection enforces «green Vercel before merge».

## Enable branch protection (one-time setup)

**Recommended:** Via GitHub UI (Settings → Branches → Branch protection rules)
1. Branch name pattern: `main`
2. ✅ Require status checks to pass before merging
3. ✅ Require branches to be up to date before merging
4. Add required status checks:
   - `TypeScript & Security Review`
   - `Vercel` (production deploy check)
5. ✅ Do not allow bypassing the above settings (admins included)
6. ✅ Restrict who can push to matching branches → only repo admins

**Via CLI:** Run from repo root:

```bash
gh api -X PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/SergeyLisunov/proform/branches/main/protection" \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]='TypeScript & Security Review' \
  -f required_status_checks[contexts][]='Vercel' \
  -f enforce_admins=true \
  -f required_pull_request_reviews[required_approving_review_count]=0 \
  -f restrictions= \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

**Caveat:** The exact «Vercel» check name may vary (`Vercel`, `Vercel - Preview`, `Vercel Deployment`). Check a recent PR via `gh pr view <N> --json statusCheckRollup` to confirm the canonical name before adding it as required.

## Verify protection is active

```bash
gh api "repos/SergeyLisunov/proform/branches/main/protection" | jq .required_status_checks
```

Expected output includes:
```json
{
  "strict": true,
  "contexts": [
    "TypeScript & Security Review",
    "Vercel"
  ]
}
```

If you see `{"message":"Branch not protected"}` — protection not set.

## Emergency override

For genuine emergencies (security hotfix, prod-down), an admin can:
1. Temporarily uncheck «Do not allow bypassing» in Settings
2. Merge the fix
3. Re-enable bypass-protection immediately after

**Do not** use this for normal PRs — defeats the gate's purpose.

## What this prevents

- Duplicate `export function X` causing build break (W12 #76 scenario)
- TypeScript errors slipping through because local tsc passed but CI tsc strict
- Vercel build infrastructure issues (missing env, package version skew)
- Stale main branches (`strict: true` forces rebase before merge)

## What this does NOT catch

- Runtime errors (no e2e tests in CI gate)
- Performance regressions (no bundle-size budget yet)
- Migrations that pass build but break прод DB (DB migration testing = W14+)
- Schema/code drift (regenerate types/database.ts manually — see W9 Day 0)

## Related runbooks

- [debug-red-vercel-build.md](./debug-red-vercel-build.md) — when CI goes red, diagnosis steps
- [W9-day0-resend-pro-switch.md](./W9-day0-resend-pro-switch.md) — Resend Free→Pro upgrade
