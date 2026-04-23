-- ──────────────────────────────────────────────────────────────────────────
-- 030_fk_indexes_and_dup_cleanup.sql
-- Performance advisor cleanup:
--   1. Cover every foreign key with an index (unindexed_foreign_keys).
--   2. Drop 5 redundant duplicate indexes (duplicate_index). We keep the
--      canonical one (UNIQUE constraint or the most descriptive name).
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_athlete_passes_plan_id        ON athlete_passes(plan_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id          ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_by              ON chats(created_by);
CREATE INDEX IF NOT EXISTS idx_chats_org_id                  ON chats(org_id);
CREATE INDEX IF NOT EXISTS idx_connections_terminated_by     ON connections(terminated_by);
CREATE INDEX IF NOT EXISTS idx_email_invites_claimed_by      ON email_invites(claimed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_injuries_reported_by          ON injuries(reported_by);
CREATE INDEX IF NOT EXISTS idx_newsletter_deliveries_user_id ON newsletter_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_workout_id   ON personal_records(workout_id);

-- Duplicate cleanup: same columns, different names. Keep one per table.
DROP INDEX IF EXISTS public.idx_newsletter_del;
DROP INDEX IF EXISTS public.idx_newsletter_deliveries_nl;
-- keep idx_newsletter_del_nl

DROP INDEX IF EXISTS public.idx_orgs_slug;
DROP INDEX IF EXISTS public.idx_organizations_slug;
-- keep organizations_org_slug_key (PK of the UNIQUE constraint)

DROP INDEX IF EXISTS public.wc_author_id_idx;
-- keep workout_comments_author_idx

NOTIFY pgrst, 'reload schema';
