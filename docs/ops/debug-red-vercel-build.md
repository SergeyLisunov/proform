# Debug a red Vercel build — runbook (W13 Day 63)

When a PR's `Vercel` check goes red OR a main-branch deployment fails, work through this checklist before guessing.

## 0. Confirm it's actually red

```bash
gh pr view <PR_NUMBER> --json statusCheckRollup | jq '.statusCheckRollup[] | select(.conclusion=="FAILURE" or .conclusion=="ERROR")'
gh pr checks <PR_NUMBER>
```

If `Vercel` is showing red, get the deployment URL:
```bash
gh pr view <PR_NUMBER> --json statusCheckRollup \
  | jq -r '.statusCheckRollup[] | select(.name=="Vercel") | .targetUrl'
```

## 1. Pull the actual build log

Vercel CLI works against deployment URLs without OAuth flow (uses cached creds):

```bash
vercel inspect <deployment-url-from-step-0> --logs 2>&1 | head -120
```

The first **«Failed to compile»** line tells you the root cause. Anything below is fallout.

## 2. Common failure classes

### A. «defined multiple times» (the W12 incident class)

```
Error: x the name `X` is defined multiple times
,-[/vercel/path0/services/X.ts:N:1]
N | export async function X(...) { ... }
```

**Cause:** Two `export` declarations с одним именем в одном файле. Local SWC may tolerate, Vercel SWC errors hard.

**Fix:**
```bash
# Find all occurrences in the file
grep -n "export.*function X\|export.*const X\|export.*interface X" path/to/file
# Delete the obsolete one (likely the older implementation)
```

**Prevention:** New `npm run build` step in CI (W13 Day 63) catches this on PR.

### B. Missing env var at build-time

```
Error: Environment variable NEXT_PUBLIC_X is required but missing
```

**Cause:** Vercel project doesn't have the env set for Preview/Production.

**Fix:** Add via `Settings → Environment Variables` in Vercel dashboard.

### C. Module not found

```
Module not found: Can't resolve '...'
```

**Cause:** Import path mismatch (case-sensitive paths Vercel/macOS difference), OR package not in `dependencies` (only in `devDependencies`).

**Fix:** Check exact path case + ensure prod dep listed:
```bash
npm ls <package-name>  # confirm it's installed
grep -A1 '"dependencies"' package.json | grep <package-name>
```

### D. TypeScript error caught by Vercel but not local

```
Type error: Type 'X' is not assignable to type 'Y'
```

**Cause:** Local tsc cache might be stale, OR Next.js typegen mismatch.

**Fix:**
```bash
rm -rf .next .tsbuildinfo
npx tsc --noEmit  # reproduce locally with clean state
```

### E. Memory / timeout

```
Build exceeded maximum duration of 45m
JavaScript heap out of memory
```

**Cause:** Bundle too large, OR runaway computation in `getStaticProps`.

**Fix:** Profile bundle (`@next/bundle-analyzer`), reduce static prerender scope.

## 3. Reproduce locally with parity

To minimize «works on my machine»:

```bash
# Clean slate
rm -rf .next .tsbuildinfo node_modules/.cache

# Use same Node version as Vercel
nvm use 20

# Same install command as Vercel
npm ci --legacy-peer-deps

# Same build command
npm run build
```

If this passes locally but fails on Vercel — check for **case-sensitivity** issues (macOS = case-insensitive filesystem, Linux/Vercel = case-sensitive) and **OS-specific deps** (some packages bundle different binaries per OS).

## 4. Check Vercel deployment list для context

```bash
vercel ls 2>&1 | head -20
```

Compare current commit ↔ last successful deploy. If they're 5+ commits apart, multiple PRs may have introduced compound issues. Bisect:

```bash
git log --oneline <last-good-commit>..HEAD
```

## 5. Roll back fast if production is down

If `main` is broken and production is failing:

```bash
# Find the last green commit
git log --oneline main -20

# Force-push a revert (last resort)
git revert <broken-commit> --no-edit
git push origin main
```

OR via Vercel UI: `Deployments → click last-green → ⋯ → Promote to Production`. This re-runs that build's output to prod without git changes.

## 6. Post-mortem template

When build was red >1 hour OR caused production gap, write a postmortem:

```markdown
## What happened
<one paragraph>

## Detection delay
<time from break → detection>

## Root cause
<commit + line + class of bug>

## Resolution
<PR# + changes>

## Lessons + follow-up
- [ ] CI gate covering this class?
- [ ] Lint rule covering this class?
- [ ] Sprint wrap check missed it?
```

See [W12 ghost-merge postmortem](../sprints/W12-wrap.md) for example.

## Related

- [vercel-deploy-gate.md](./vercel-deploy-gate.md) — how branch protection works
- [W9-day0-resend-pro-switch.md](./W9-day0-resend-pro-switch.md) — env var changes
