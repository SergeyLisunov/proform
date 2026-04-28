-- ──────────────────────────────────────────────────────────────────────────
-- 045_notifications_schema_completion.sql
--
-- API code (services/notifications.service.ts NotifyInput, /api/invite/*,
-- /api/webhooks/stripe, etc.) inserts entity_type / entity_id / action_url
-- and reads is_archived. None of these columns existed on prod; INSERTs
-- with these fields were silently failing with "column does not exist"
-- (Supabase returns the error but every caller used `(sb as any).from` and
-- ignored it). Result: notifications were NOT being created on
--   - invite acceptance (`/api/invite/[token]`)
--   - athlete pass issuance (`/api/webhooks/stripe`)
--   - org session creation, doctor checkup, broadcast, …
-- The bell icon's unread counter also queried `is_archived`, returning 0
-- as a side effect of the missing column.
--
-- This migration adds the missing columns + a unread-friendly index.
--
-- Applied to prod project hhyjihbctidtucvpgjzv 2026-04-28.
-- Idempotent. Safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id   uuid,
  ADD COLUMN IF NOT EXISTS action_url  text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false AND is_archived = false;

NOTIFY pgrst, 'reload schema';
