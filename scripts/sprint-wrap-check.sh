#!/usr/bin/env bash
# sprint-wrap-check.sh — W13 Day 67
#
# Pre-wrap sanity check + wrap.md skeleton generator.
# Direct response to W12 ghost-merge post-mortem: sprint wrap must verify
# production deploy state, не только PR merge status.
#
# Usage:
#   bash scripts/sprint-wrap-check.sh [SPRINT_NUMBER]
#
# Example:
#   bash scripts/sprint-wrap-check.sh 13
#
# Output:
#   1. Production-vs-main gap diagnostic (uses gh + vercel CLI if available)
#   2. Recent commits на main with PR numbers
#   3. Wrap.md skeleton к stdout (redirect к docs/sprints/W<N>-wrap.md)

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

sprint_num="${1:-}"
if [ -z "$sprint_num" ]; then
  echo "Usage: $0 <sprint-number>"
  echo "Example: $0 13"
  exit 1
fi

echo "=== Sprint W${sprint_num} wrap pre-check ==="
echo ""

# 1. Confirm на main + up-to-date
current_branch="$(git branch --show-current)"
if [ "$current_branch" != "main" ]; then
  echo "⚠  Not on main (current: $current_branch). Switch к main or proceed knowing wrap reflects this branch."
fi

git fetch origin main --quiet 2>/dev/null || true
local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse origin/main 2>/dev/null || echo "unknown")"

if [ "$local_head" != "$remote_head" ] && [ "$remote_head" != "unknown" ]; then
  echo "⚠  Local branch is behind/ahead of origin/main."
  echo "   Local : $local_head"
  echo "   Remote: $remote_head"
fi

echo ""
echo "=== Production deploy state ==="
echo ""

# 2. Try vercel ls — if Vercel CLI is available
if command -v vercel >/dev/null 2>&1; then
  echo "Vercel deployments (latest 10):"
  vercel ls 2>/dev/null | head -12 || echo "  (vercel ls failed — run 'vercel login' if needed)"
else
  echo "  vercel CLI not installed. Install with: npm i -g vercel"
fi

echo ""
echo "Reminder: production deploy commit MUST equal main HEAD. If gap exists,"
echo "see docs/ops/debug-red-vercel-build.md before declaring sprint closed."
echo ""

echo "=== Recent commits на main (last 15) ==="
echo ""
git log --oneline origin/main -15 2>/dev/null \
  | sed 's/^/  /' \
  || git log --oneline -15 | sed 's/^/  /'

echo ""
echo "=== Open PRs ==="
echo ""
if command -v gh >/dev/null 2>&1; then
  gh pr list --state open --limit 10 2>/dev/null \
    | sed 's/^/  /' \
    || echo "  (gh pr list failed — check auth: gh auth status)"
else
  echo "  gh CLI not installed. Skipping open-PR check."
fi

echo ""
echo "=== Duplicate exports audit (Day 64 check) ==="
echo ""
if [ -f scripts/audit-duplicate-exports.sh ]; then
  bash scripts/audit-duplicate-exports.sh
else
  echo "  Audit script not found — run from W13 Day 64."
fi

echo ""
echo "=== Wrap.md skeleton ==="
echo ""
echo "Copy below into docs/sprints/W${sprint_num}-wrap.md, fill blanks:"
echo ""
cat <<EOF
# Sprint W${sprint_num} — <THEME> (Wrap)

**Dates:** $(date -u +%Y-%m-%d -v-5d 2>/dev/null || date -u --date='5 days ago' +%Y-%m-%d) → $(date -u +%Y-%m-%d)
**Theme:** <one-line theme>

## Day-by-day

| День | PR | Тема | Размер | Статус |
|---|---|---|---|---|
| Day N | #X | <topic> | S/M/L | <status> |

## Architecture wins

### 1. <Win>
<paragraph>

## Метрики до/после

| Метрика | До | После |
|---|---|---|
| <metric> | X | Y |

## Что не вошло (scope cut)

- <item>

## Что нового в knowledge

- [[new decision]]

## Pre-wrap deploy verification
- [ ] Production commit equals main HEAD ($(git rev-parse --short origin/main 2>/dev/null || echo "<rev>"))
- [ ] No open Vercel build errors на latest 3 deploys
- [ ] Duplicate-exports audit clean
- [ ] All sprint PRs marked MERGED (not just «closed»)

## W$((sprint_num + 1)) предлоги

- <theme>
EOF

echo ""
echo "=== Pre-wrap check complete ==="
echo ""
echo "Next steps:"
echo "  1. Write docs/sprints/W${sprint_num}-wrap.md based на skeleton above"
echo "  2. Commit + push as W${sprint_num} final-day PR"
echo "  3. Save session к Obsidian Vault"
echo "  4. Plan W$((sprint_num + 1))"
