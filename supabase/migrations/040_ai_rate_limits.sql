-- ──────────────────────────────────────────────────────────────────────────
-- 040_ai_rate_limits.sql
-- Per-user, per-endpoint rate limiting for AI calls.
-- Each AI endpoint inserts a row before invoking Anthropic; the RPC
-- check_and_increment_ai_rate_limit atomically counts the user's calls
-- inside a sliding window and either inserts (returns true) or refuses
-- (returns false). Cheap counter, RLS-protected by the helper itself —
-- the table is callable only via the SECURITY DEFINER function.
-- Closes the unbounded Anthropic-cost exposure on /api/ai/*.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_user_endpoint_time
  ON ai_rate_limits(user_id, endpoint, created_at DESC);

ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Deny direct access — all reads/writes go through the RPC below.
DROP POLICY IF EXISTS ai_rate_limits_no_direct_access ON ai_rate_limits;
CREATE POLICY ai_rate_limits_no_direct_access ON ai_rate_limits
  FOR ALL USING (false) WITH CHECK (false);

-- Atomic check+increment. Returns true if the call is allowed (and
-- records it); false if the user has already hit the cap inside the
-- window. SECURITY DEFINER so it can read/write the locked-down table.
CREATE OR REPLACE FUNCTION check_and_increment_ai_rate_limit(
  p_endpoint        text,
  p_max_per_window  int,
  p_window_seconds  int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_count   int;
BEGIN
  v_user_id := get_my_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)
    INTO v_count
    FROM ai_rate_limits
   WHERE user_id    = v_user_id
     AND endpoint   = p_endpoint
     AND created_at > now() - make_interval(secs => p_window_seconds);

  IF v_count >= p_max_per_window THEN
    RETURN false;
  END IF;

  INSERT INTO ai_rate_limits(user_id, endpoint) VALUES (v_user_id, p_endpoint);
  RETURN true;
END;
$$;

-- Supabase sets implicit grants on public-schema functions for anon and
-- authenticated; REVOKE FROM PUBLIC alone isn't enough — anon retains
-- EXECUTE. Lock both roles down explicitly, then grant only authenticated.
REVOKE ALL ON FUNCTION check_and_increment_ai_rate_limit(text, int, int)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION check_and_increment_ai_rate_limit(text, int, int)
  TO authenticated;

-- Periodic cleanup helper — call from a cron to keep the table small.
-- Removes anything older than 24 hours; safe because the largest window
-- we use is 1 hour.
CREATE OR REPLACE FUNCTION cleanup_ai_rate_limits() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM ai_rate_limits WHERE created_at < now() - interval '24 hours';
$$;

-- Cleanup is operator-only — neither end-users nor signed-in clients
-- should be able to wipe the counter table.
REVOKE ALL ON FUNCTION cleanup_ai_rate_limits()
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION cleanup_ai_rate_limits()
  TO service_role;

NOTIFY pgrst, 'reload schema';
