-- W21 audit fix — RLS / SECURITY DEFINER function hardening (mediums M3 + M4).
--
-- M3 (A05): public.sync_athlete_pass_usage() is SECURITY DEFINER but was created
--   (migration 022) without `SET search_path`. Migration 042 revoked EXECUTE from
--   client roles (limiting exploitability), but every other SECURITY DEFINER fn
--   in the project locks search_path — this one was missed. Catching up.
--
-- M4 (A01): public.should_send_notification(uuid, text) was GRANTed to
--   `authenticated` (migration 065). It accepts an arbitrary p_user_id and reads
--   that user's notification_prefs — so any logged-in user could enumerate ANY
--   user's notification preferences. It is only ever called server-side by cron
--   routes via the admin (service_role) client, so revoke from `authenticated`.

BEGIN;

-- M3
ALTER FUNCTION public.sync_athlete_pass_usage() SET search_path = public, pg_temp;

-- M4 (service_role grant from migration 065 stays — cron uses the admin client)
REVOKE EXECUTE ON FUNCTION public.should_send_notification(uuid, text) FROM authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
