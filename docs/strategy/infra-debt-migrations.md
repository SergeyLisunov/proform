# Infra debt — migration history is not fully version-controlled

> 2026-06-05 · from the strategy audit (cross-cutting infra finding).

## The gap

| | Count |
|---|---|
| Migrations **applied to prod** (`supabase_migrations.schema_migrations`) | **141** |
| Migration **.sql files in the repo** (`supabase/migrations/`) | **74** (010→087, after recovering 086) |

The repo's numbered files start at `010_workout_comments`. **Everything before it**
— the entire base schema applied to prod via the Supabase dashboard / CLI and
never committed — is missing from version control, including:

- `initial_schema`, `extend_schema_full_prd`
- `create_organizations_table`, `create_connections_and_notifications`,
  `create_newsletters_table`, `create_wall_posts_table`, `org_members` + the
  whole `org_rls_*` family (≈20 migrations of org RLS iteration)
- `users` extensions, `athletes`, `calendar_events`, `workouts` base + their RLS
- storage policies, function search-path hardening, etc.

So the **access/tenant model and its RLS exist only in the live database**, not in
the repo.

## Why it matters

- **Unreproducible**: a fresh environment (staging, a new dev, disaster recovery)
  cannot be stood up from the repo — the base schema isn't there.
- **Unauditable RLS**: policies were edited via dashboard/MCP over time and have
  drifted from any file. Security review can't read the source of truth in git.
- **Silent breakage**: the `trainer_athletes` access outage (fixed in migration
  085) was invisible in code review precisely because the table + its policies
  weren't in the repo — it only surfaced when prod broke.

## Done in this PR

- Recovered the one missing **numbered** file, `086_can_notify_care_team_predicate.sql`,
  via `pg_get_functiondef()` so the 010→087 chain is contiguous and `can_notify`
  in git matches prod.

## Remediation (recommended, needs DB access / Supabase CLI)

A hand-rolled reconstruction of ~68 pre-010 migrations is error-prone. The correct
one-time fix is a schema dump:

```bash
# Project ref: hhyjihbctidtucvpgjzv (atlet-pro, eu-central-1)
supabase login
supabase link --project-ref hhyjihbctidtucvpgjzv
# capture current prod schema (tables, RLS, functions, triggers, grants):
supabase db dump --schema public --file supabase/migrations/000000000000_baseline.sql
# (or: pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL")
```

Then commit `000000000000_baseline.sql` as the baseline; the existing `010…087`
files remain as deltas on top. This needs the DB connection string / pooler
password (Supabase dashboard → Database → Connection string) — a founder action.
Can be run for you if that's provided, or by you locally.

## Going forward (prevent recurrence)

- **Never** apply DDL via the dashboard or MCP `apply_migration` without committing
  the corresponding `.sql` file in the same change (the 086 gap was exactly this).
- Consider a CI check: fail if `count(prod migrations) > count(repo migration files)`.
