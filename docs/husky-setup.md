# Husky pre-commit (Layer 0) — Setup & Reference

> Added W17 Day 87. Catches duplicate-exports bug class (W12 ghost-merge)
> at developer machine, before push reaches CI.

## What runs

```sh
# .husky/pre-commit
npm run lint:duplicates   # bash scripts/audit-duplicate-exports.sh — ~1 sec
```

Single fast check. Slower validations (lint, tsc, bundle budget) run в CI.

## Why Layer 0

W12 ghost-merge incident: duplicate `replyToReview` export shipped к main,
caused 3-day production drift while CI didn't fail (local SWC tolerated
duplicate, Vercel SWC rejected). W13 Day 64 added `lint:duplicates` script
+ Layer 3 CI check. W17 Day 87 Layer 0 = pre-commit hook = earliest
fast-fail point.

Layer 0 + Layer 3 redundancy intentional:
- Layer 0 catches developer commits proactively
- Layer 3 catches case когда developer `--no-verify` bypassed (or fresh
  clone before `npm install`)

## Auto-install on `npm install`

`prepare` script в package.json runs `husky` automatically:

```json
"scripts": {
  ...
  "prepare": "husky"
}
```

After cloning + `npm install`, hooks active. No manual setup.

## Emergency bypass

`git commit --no-verify -m "..."` skips the hook. Use only когда:
- Committing pre-existing duplicates that will be fixed in same commit
- Recovering from broken hook script

Never bypass для shipping known-broken commit. CI Layer 3 will catch it.

## Adding more checks (future)

Pattern для adding к pre-commit (keep <5 sec total):

```sh
# .husky/pre-commit
set -e

echo "🔍 Pre-commit: duplicate exports..."
npm run lint:duplicates

# NEW check example:
# echo "🔍 Pre-commit: TypeScript type check..."
# npx tsc --noEmit --incremental   # ~3-5 sec на incremental builds
```

Heavier checks (full lint, build, bundle budget) → keep в CI layers,
no pre-commit copy-paste.

## Troubleshooting

### Hook не запускается
```sh
# Reinstall hooks
npx husky init
chmod +x .husky/pre-commit
```

### Hook script too slow
- Remove heavier checks from `.husky/pre-commit`
- Move them к CI workflow
- Target: pre-commit <5 sec, pre-push <30 sec

### Need to disable for one commit
```sh
git commit --no-verify -m "..."   # bypass once
```

### Want к disable permanently (don't recommend)
```sh
git config core.hooksPath /dev/null   # local only — don't commit this
```

## Related

- `scripts/audit-duplicate-exports.sh` — W13 Day 64 (the check itself)
- `docs/bundle-budget.md` — W17 Day 86 (Layer 7 CI counterpart)
- `docs/ops/duplicate-exports-rule.md` — W12 ghost-merge incident context
- [[layered CI defence — each layer catches independently]] — vault note
