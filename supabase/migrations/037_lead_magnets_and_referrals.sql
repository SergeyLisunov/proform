-- ──────────────────────────────────────────────────────────────────────────
-- 037_lead_magnets_and_referrals.sql
-- Инфраструктура для лид-магнитов и реферальной петли.
--   1. tool_leads — капча email от публичных /tools/* страниц.
--   2. referral_credits — аудит: «за каждого принявшего invite — +1 мес
--      Pro тренеру-инвайтеру».
--   3. RPC grant_referral_credit — идемпотентная функция для claim flow;
--      вызывается из service-role клиента в /api/invite/[token].
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tool_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       varchar(255) NOT NULL,
  source      varchar(40)  NOT NULL
               CHECK (source IN ('acwr','overtraining','templates','other')),
  payload     jsonb,
  ip_hash     varchar(64),
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tool_leads_email  ON tool_leads(lower(email));
CREATE INDEX IF NOT EXISTS idx_tool_leads_source ON tool_leads(source, created_at DESC);
ALTER TABLE tool_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tool_leads_public_insert ON tool_leads;
CREATE POLICY tool_leads_public_insert ON tool_leads FOR INSERT TO anon, authenticated
  WITH CHECK (true);
DROP POLICY IF EXISTS tool_leads_admin_select ON tool_leads;
CREATE POLICY tool_leads_admin_select ON tool_leads FOR SELECT TO authenticated
  USING ((SELECT get_my_role()) = 'admin');

CREATE TABLE IF NOT EXISTS referral_credits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  source_invite_id    uuid UNIQUE REFERENCES email_invites(id) ON DELETE SET NULL,
  months_granted      smallint NOT NULL DEFAULT 1,
  applied_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_credits_inviter
  ON referral_credits(inviter_id, applied_at DESC);
ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referral_credits_own ON referral_credits;
CREATE POLICY referral_credits_own ON referral_credits FOR SELECT
  USING (inviter_id = (SELECT get_my_user_id()));

CREATE OR REPLACE FUNCTION grant_referral_credit(
  p_inviter_id       uuid,
  p_invited_user_id  uuid,
  p_source_invite_id uuid,
  p_months           smallint DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_id uuid;
  v_sub_id    uuid;
  v_days      int := p_months * 30;
BEGIN
  SELECT id INTO v_credit_id FROM referral_credits
   WHERE source_invite_id = p_source_invite_id LIMIT 1;
  IF v_credit_id IS NOT NULL THEN RETURN v_credit_id; END IF;

  INSERT INTO referral_credits (inviter_id, invited_user_id, source_invite_id, months_granted)
  VALUES (p_inviter_id, p_invited_user_id, p_source_invite_id, p_months)
  RETURNING id INTO v_credit_id;

  SELECT id INTO v_sub_id FROM subscriptions WHERE user_id = p_inviter_id LIMIT 1;
  IF v_sub_id IS NULL THEN
    INSERT INTO subscriptions (user_id, plan, status, price_usd, started_at, expires_at)
    VALUES (p_inviter_id, 'pro', 'active', 0, now(), now() + make_interval(days => v_days));
  ELSE
    UPDATE subscriptions
       SET plan       = CASE WHEN plan IN ('pro','team','enterprise') THEN plan ELSE 'pro' END,
           status     = 'active',
           expires_at = GREATEST(COALESCE(expires_at, now()), now()) + make_interval(days => v_days),
           cancelled_at = NULL
     WHERE id = v_sub_id;
  END IF;

  RETURN v_credit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION grant_referral_credit(uuid, uuid, uuid, smallint) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
