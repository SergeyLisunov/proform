-- Sprint W5 Day 23 (PR #39) — UTM attribution + lead-to-user matching.
--
-- 1. users gets UTM columns (utm_source/medium/campaign/content/term + signup_referrer)
-- 2. tool_leads gets user_id FK (matches by email) + converted_at
-- 3. handle_new_auth_user() extended to:
--    - copy UTM из raw_user_meta_data в users
--    - auto-match tool_leads on email after insert
-- 4. match_leads_to_user(uuid) RPC для admin retroactive matching
-- 5. Indexes для funnel queries
--
-- Применено через Supabase MCP 2026-05-12.

-- ── users UTM columns ──────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS utm_source       varchar(80),
  ADD COLUMN IF NOT EXISTS utm_medium       varchar(80),
  ADD COLUMN IF NOT EXISTS utm_campaign     varchar(120),
  ADD COLUMN IF NOT EXISTS utm_content      varchar(120),
  ADD COLUMN IF NOT EXISTS utm_term         varchar(120),
  ADD COLUMN IF NOT EXISTS signup_referrer  text;

CREATE INDEX IF NOT EXISTS idx_users_utm_source
  ON users (utm_source, created_at DESC)
  WHERE utm_source IS NOT NULL;

-- ── tool_leads conversion linking ──────────────────────────────────────
ALTER TABLE tool_leads
  ADD COLUMN IF NOT EXISTS user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tool_leads_user
  ON tool_leads (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tool_leads_converted
  ON tool_leads (converted_at DESC, source)
  WHERE converted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tool_leads_email_lower
  ON tool_leads (lower(email));

-- ── Extended handle_new_auth_user() ────────────────────────────────────
-- Extends existing trigger to (a) copy UTM into users, (b) auto-match
-- tool_leads on signup email. Preserves existing role normalization.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role        TEXT;
  v_new_user_id uuid;
  v_email_lower text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'athlete');
  IF v_role NOT IN ('admin', 'coach', 'trainer', 'athlete', 'organization', 'doctor', 'specialist') THEN
    v_role := 'athlete';
  END IF;

  -- Insert users row с UTM attribution из raw_user_meta_data (передаётся
  -- из /auth/register page через supabase.auth.signUp options.data).
  INSERT INTO public.users (
    auth_id, email, name, role,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    signup_referrer
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_role,
    NULLIF(NEW.raw_user_meta_data->>'utm_source',   ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_medium',   ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_campaign', ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_content',  ''),
    NULLIF(NEW.raw_user_meta_data->>'utm_term',     ''),
    NULLIF(NEW.raw_user_meta_data->>'signup_referrer', '')
  )
  ON CONFLICT (auth_id) DO NOTHING
  RETURNING id INTO v_new_user_id;

  -- Auto-match tool_leads by email (case-insensitive). Если v_new_user_id
  -- null (ON CONFLICT случай) — fetch existing user id.
  IF v_new_user_id IS NULL THEN
    SELECT id INTO v_new_user_id FROM public.users WHERE auth_id = NEW.id;
  END IF;

  IF v_new_user_id IS NOT NULL THEN
    v_email_lower := lower(NEW.email);
    UPDATE public.tool_leads
    SET user_id      = v_new_user_id,
        converted_at = COALESCE(converted_at, now())
    WHERE lower(email) = v_email_lower
      AND user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ── match_leads_to_user RPC (admin retroactive matching) ──────────────
CREATE OR REPLACE FUNCTION public.match_leads_to_user(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_email_lower text;
  v_count int;
BEGIN
  SELECT lower(email) INTO v_email_lower FROM public.users WHERE id = p_user_id;
  IF v_email_lower IS NULL THEN RETURN 0; END IF;

  UPDATE public.tool_leads
  SET user_id      = p_user_id,
      converted_at = COALESCE(converted_at, now())
  WHERE lower(email) = v_email_lower
    AND user_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant только к service_role; не expose authenticated users.
REVOKE EXECUTE ON FUNCTION public.match_leads_to_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_leads_to_user(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.match_leads_to_user(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
