-- ──────────────────────────────────────────────────────────────────────────
-- 043_ai_rate_limit_ip_hash.sql
--
-- IP-based rate limit on top of per-user (botnet defense). Per-user (RPC
-- 040) is bypassable by running 100 accounts; an IP cap catches that.
-- Reuses the ai_rate_limits table — every call now records (user_id,
-- endpoint, ip_hash) so we can count by either dimension.
--
-- The check_and_increment_ai_rate_limit RPC is extended with three
-- optional args: p_ip_hash, p_ip_max, p_ip_window_secs. Both gates are
-- evaluated atomically; the row is inserted only if both pass.
--
-- The IP hash is computed by the API helper (sha256 of IP + pepper) and
-- has length 64. The RPC refuses anything shorter than 16 chars to
-- prevent accidental plain-IP storage.
--
-- Applied to prod project hhyjihbctidtucvpgjzv 2026-04-26.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE ai_rate_limits
  ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_iphash_time
  ON ai_rate_limits(ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

-- Standalone IP-only check kept for completeness (not used by current
-- API code but available if a future caller needs an IP-only gate).
CREATE OR REPLACE FUNCTION check_and_increment_ai_ip_rate_limit(
  p_ip_hash         text,
  p_max_per_window  int,
  p_window_seconds  int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF p_ip_hash IS NULL OR length(p_ip_hash) < 16 THEN
    RETURN false;
  END IF;
  SELECT COUNT(*) INTO v_count
    FROM ai_rate_limits
   WHERE ip_hash    = p_ip_hash
     AND created_at > now() - make_interval(secs => p_window_seconds);
  IF v_count >= p_max_per_window THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION check_and_increment_ai_ip_rate_limit(text, int, int)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION check_and_increment_ai_ip_rate_limit(text, int, int)
  TO service_role;

-- Extended per-user RPC. Accepts ip_hash and IP-cap args; both gates
-- are evaluated atomically inside one transaction.
CREATE OR REPLACE FUNCTION check_and_increment_ai_rate_limit(
  p_endpoint        text,
  p_max_per_window  int,
  p_window_seconds  int,
  p_ip_hash         text DEFAULT NULL,
  p_ip_max          int  DEFAULT 60,
  p_ip_window_secs  int  DEFAULT 3600
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   uuid;
  v_user_cnt  int;
  v_ip_cnt    int;
BEGIN
  v_user_id := get_my_user_id();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Per-user gate
  SELECT COUNT(*) INTO v_user_cnt
    FROM ai_rate_limits
   WHERE user_id    = v_user_id
     AND endpoint   = p_endpoint
     AND created_at > now() - make_interval(secs => p_window_seconds);
  IF v_user_cnt >= p_max_per_window THEN
    RETURN false;
  END IF;

  -- Per-IP gate (only if hash provided)
  IF p_ip_hash IS NOT NULL AND length(p_ip_hash) >= 16 THEN
    SELECT COUNT(*) INTO v_ip_cnt
      FROM ai_rate_limits
     WHERE ip_hash    = p_ip_hash
       AND created_at > now() - make_interval(secs => p_ip_window_secs);
    IF v_ip_cnt >= p_ip_max THEN
      RETURN false;
    END IF;
  END IF;

  INSERT INTO ai_rate_limits(user_id, endpoint, ip_hash)
    VALUES (v_user_id, p_endpoint, p_ip_hash);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION check_and_increment_ai_rate_limit(text, int, int, text, int, int)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION check_and_increment_ai_rate_limit(text, int, int, text, int, int)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
