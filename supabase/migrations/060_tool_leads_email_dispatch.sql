-- Sprint W4 Day 22 (PR #38) — email dispatch tracking columns
-- для tool_leads. Cron /api/cron/leads-digest еженедельно отправляет
-- follow-up email по un-dispatched leads и marks email_dispatched_at.
--
-- Структура:
--   email_dispatched_at — timestamptz, when first successfully sent (null = pending)
--   email_attempts      — int, how many times tried (capped at 3 retries)
--   email_last_error    — text, last failure reason for debugging
--
-- Indexes:
--   idx_tool_leads_pending_dispatch — partial index для cron iterator
--   idx_tool_leads_source_dispatched — для admin dashboard funnel queries
--
-- Применено через Supabase MCP 2026-05-10.

ALTER TABLE tool_leads
  ADD COLUMN IF NOT EXISTS email_dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_attempts      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_last_error    text;

CREATE INDEX IF NOT EXISTS idx_tool_leads_pending_dispatch
  ON tool_leads (created_at DESC)
  WHERE email_dispatched_at IS NULL AND email_attempts < 3;

CREATE INDEX IF NOT EXISTS idx_tool_leads_source_dispatched
  ON tool_leads (source, email_dispatched_at, created_at DESC);

NOTIFY pgrst, 'reload schema';
