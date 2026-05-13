-- Sprint W7 Day 35 — 3-touch drip cadence.
--
-- Up to now /api/cron/leads-digest dispatched ONE email per lead and
-- marked email_dispatched_at = now() — after that the lead was dead.
-- Industry baseline для cold drip = 5-10% conversion с 1-touch; 2-3×
-- boost достижим через 3-touch sequence (immediate + 7d + 14d).
--
-- This migration adds two columns to enable the cadence + backfills
-- existing dispatched leads as touch=1 so they remain eligible for
-- touch 2 (+7d).
--
-- Cadence rules (enforced in services/admin-leads.service.ts):
--   Touch 1 — no email_dispatched_at, last_touch_at IS NULL, immediate
--   Touch 2 — dispatched_touches=1, last_touch_at >= 7 days ago
--   Touch 3 — dispatched_touches=2, last_touch_at >= 14 days ago
--   STOP   — dispatched_touches >= 3 OR converted_at IS NOT NULL

ALTER TABLE public.tool_leads
  ADD COLUMN IF NOT EXISTS dispatched_touches INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_at      TIMESTAMPTZ;

-- Backfill: existing leads with email_dispatched_at set → touch 1 already
-- sent. They become eligible for touch 2 once 7d passes from last_touch_at.
UPDATE public.tool_leads
SET dispatched_touches = 1,
    last_touch_at      = email_dispatched_at
WHERE email_dispatched_at IS NOT NULL
  AND dispatched_touches = 0;

-- Partial index for the cron iterator: only active leads (not converted)
-- with room for more touches. WHERE clause keeps the index tiny.
CREATE INDEX IF NOT EXISTS idx_tool_leads_cadence_active
  ON public.tool_leads (dispatched_touches, last_touch_at)
  WHERE converted_at IS NULL AND dispatched_touches < 3;

COMMENT ON COLUMN public.tool_leads.dispatched_touches IS
  'Sprint W7 Day 35: drip touch counter. 0=fresh, 1=after first email, 2=after second, 3=stop.';
COMMENT ON COLUMN public.tool_leads.last_touch_at IS
  'Sprint W7 Day 35: timestamp of the most recent drip email. Used to gate next touch by N-day window.';

NOTIFY pgrst, 'reload schema';
