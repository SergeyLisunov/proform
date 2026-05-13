-- Sprint W7 Day 33 — Backfill onboarding_state for users created before
-- Migration 066 deploy (2026-05-12). Required for middleware-based
-- redirect: pre-W6 users predate the wizard concept and must not be
-- forced into it. New signups post-2026-05-12 keep the default '{}'::jsonb
-- and will be required to complete the wizard via middleware.
--
-- Safety: WHERE clause matches ONLY users with empty onboarding_state
-- (legacy) — users who already started the wizard (state has step/role/etc.)
-- are NOT overwritten. The created_at watermark prevents touching new
-- post-W6 signups who haven't entered /onboarding yet.

UPDATE public.users
SET onboarding_state = jsonb_build_object(
  'completed',         true,
  'completed_at',      now(),
  'role_when_started', role,
  'backfilled',        true
)
WHERE (onboarding_state IS NULL OR onboarding_state = '{}'::jsonb)
  AND created_at < '2026-05-12'::date;

-- Verify count (for migration log).
DO $$
DECLARE
  total_backfilled INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_backfilled
  FROM public.users
  WHERE onboarding_state @> '{"backfilled": true}'::jsonb;
  RAISE NOTICE 'Backfilled % legacy users with completed=true', total_backfilled;
END $$;

NOTIFY pgrst, 'reload schema';
