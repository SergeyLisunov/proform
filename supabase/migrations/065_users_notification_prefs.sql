-- Sprint W5 Day 27 (PR #44) — Notification Preferences.
--
-- Adds users.notification_prefs JSONB. Open schema (not enum'd) — новые
-- channels можно добавлять без миграций. Defaults и known channels
-- задокументированы в services/notification-prefs.service.ts.
--
-- Default channels (all default TRUE — opt-out model):
--   daily_digest_email          — daily athlete summary
--   coach_weekly_email          — Monday coach summary
--   recommendations_email       — doctor/coach recommendation created
--   inquiry_email               — coach получает email когда doctor responds
--   drip_marketing_email        — W4 lead-magnet drip + general marketing
--   marketplace_email           — new offerings в followed sources
--
-- Helper RPC should_send_notification(user_id, channel) — для cron routes.
-- Fail-open: pref missing → return TRUE.
--
-- Применено через Supabase MCP 2026-05-12.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_notification_prefs_gin
  ON users USING gin (notification_prefs);

CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id uuid,
  p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_prefs jsonb;
  v_value jsonb;
BEGIN
  SELECT notification_prefs INTO v_prefs FROM public.users WHERE id = p_user_id;
  IF v_prefs IS NULL THEN
    RETURN TRUE;
  END IF;
  v_value := v_prefs->p_channel;
  IF v_value IS NULL THEN
    RETURN TRUE;
  END IF;
  IF jsonb_typeof(v_value) = 'boolean' THEN
    RETURN v_value::text::boolean;
  END IF;
  IF jsonb_typeof(v_value) = 'string' THEN
    RETURN lower(v_value->>0) IN ('true', 't', '1', 'yes');
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.should_send_notification(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.should_send_notification(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
