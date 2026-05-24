#!/usr/bin/env bash
# audit-duplicate-exports.sh — W13 Day 64
#
# Scans services/, app/, lib/, components/ for duplicate `export ... X`
# declarations within the same file. Catches the W12 ghost-merge bug class
# (duplicate `export async function replyToReview` in coach-reviews.service.ts).
#
# Returns exit code 0 if clean, 1 if duplicates found.
# Used by:
#   - Pre-commit hook (optional, see docs/ops/duplicate-exports-rule.md)
#   - npm run lint:duplicates (script in package.json)
#   - CI workflow (.github/workflows/code-review.yml — future addition)

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"

# Directories scanned. Add/remove as project grows.
SCAN_DIRS=(services app lib components)

# Patterns we treat as a top-level export declaration.
# Matches: export function X, export async function X, export const X,
#          export interface X, export type X, export class X.
# Re-exports (export { X }), default exports, and type-only re-exports
# don't fall into the "two function declarations with same name" bug class,
# so we don't flag them here.

duplicates_found=0

for dir in "${SCAN_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  while IFS= read -r -d '' file; do
    # Extract every exported identifier from this file.
    names=$(grep -E "^export (async )?(function|const|interface|type|class) " "$file" 2>/dev/null \
      | sed -E 's/^export (async )?(function|const|interface|type|class) ([A-Za-z_][A-Za-z0-9_]*).*/\3/' \
      || true)

    if [ -z "$names" ]; then
      continue
    fi

    dups=$(echo "$names" | sort | uniq -d)
    if [ -n "$dups" ]; then
      duplicates_found=$((duplicates_found + 1))
      echo ""
      echo "❌ DUPLICATE EXPORTS in $file:"
      while IFS= read -r dup_name; do
        echo "   → $dup_name (defined multiple times)"
        grep -n "^export.*\\b$dup_name\\b" "$file" | sed 's/^/      /'
      done <<< "$dups"
    fi
  done < <(find "$dir" \( -name '*.ts' -o -name '*.tsx' \) -type f -print0 2>/dev/null)
done

if [ "$duplicates_found" -gt 0 ]; then
  echo ""
  echo "💥 Found duplicate exports in $duplicates_found file(s)."
  echo ""
  echo "Why this matters: local SWC tolerates duplicates ('last-write wins')"
  echo "but Vercel SWC fails build with 'defined multiple times' — see"
  echo "docs/ops/duplicate-exports-rule.md for context."
  echo ""
  echo "Fix: keep one definition, delete the obsolete one (usually the older)."
  exit 1
fi

echo "✅ No duplicate exports detected across: ${SCAN_DIRS[*]}"
exit 0
