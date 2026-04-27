-- ──────────────────────────────────────────────────────────────────────────
-- 042_security_definer_hardening.sql
--
-- Pre-existing SECURITY DEFINER functions in public schema were callable by
-- anon and authenticated through PostgREST's /rest/v1/rpc/* surface.
-- Supabase advisor flagged 9 such functions; this migration revokes the
-- unnecessary grants without breaking any legitimate flow.
--
-- (a) grant_referral_credit — abuse vector: anon could mint Pro credit for
--     any user_id given a valid invite_id. The 038 self-referral guard
--     only checks inviter != invited; it doesn't verify the caller has
--     any relation to the credit. The /api/invite/[token] route already
--     calls it through the service_role admin client, so locking to
--     service_role only doesn't break the legitimate flow.
-- (b) trigger-only functions (handle_new_auth_user, notify_connection_*,
--     sync_athlete_pass_usage) — triggers fire as the table owner; direct
--     EXECUTE grants are pure attack surface. Revoke from everyone.
-- (c) get_my_role / get_my_user_id — RLS helpers. authenticated and
--     service_role need them; anon doesn't (anon's auth.uid() is null so
--     they'd return null anyway). Revoke from PUBLIC and anon.
-- (d) get_challenge_leaderboard — challenges are authenticated-only.
-- (e) get_shared_workout — INTENTIONALLY anon-callable (public token-based
--     workout share). Left alone.
--
-- Applied to prod project hhyjihbctidtucvpgjzv 2026-04-26.
-- ──────────────────────────────────────────────────────────────────────────

-- (a) grant_referral_credit → service_role only
REVOKE ALL ON FUNCTION grant_referral_credit(uuid, uuid, uuid, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION grant_referral_credit(uuid, uuid, uuid, smallint)
  TO service_role;

-- (b) trigger-only functions → revoke from all client roles
REVOKE ALL ON FUNCTION handle_new_auth_user()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_connection_created()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_connection_updated()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sync_athlete_pass_usage()
  FROM PUBLIC, anon, authenticated;

-- (c) RLS helpers → keep authenticated (RLS evaluation needs them) and
-- service_role (server code), drop anon and PUBLIC.
REVOKE ALL ON FUNCTION get_my_role()    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION get_my_user_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_my_role()    TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION get_my_user_id() TO authenticated, service_role;

-- (d) challenge leaderboard → authenticated-only
REVOKE ALL ON FUNCTION get_challenge_leaderboard(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION get_challenge_leaderboard(uuid)
  TO authenticated, service_role;

-- (e) get_shared_workout intentionally remains anon-callable — public
-- token-based workout sharing flow. No change needed.

NOTIFY pgrst, 'reload schema';
