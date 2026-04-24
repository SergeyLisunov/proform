-- ──────────────────────────────────────────────────────────────────────────
-- 038_referral_self_invite_guard.sql
-- Follow-up к 037 после code-review:
--   * self-referral abuse — RPC грантит Pro-кредит даже если inviter_id
--     совпадает с invited_user_id. Authenticated-роль может вызывать
--     функцию через PostgREST, поэтому фикс — внутри самой функции.
--   * tool_leads.payload без ограничения по размеру. pg_column_size
--     CHECK <= 32 KB как hard backstop (API ещё режет до 16 KB до БД).
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

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
  IF p_inviter_id IS NULL OR p_invited_user_id IS NULL THEN
    RAISE EXCEPTION 'missing_ids';
  END IF;
  IF p_inviter_id = p_invited_user_id THEN
    RAISE EXCEPTION 'self_referral_not_allowed';
  END IF;

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

ALTER TABLE tool_leads
  DROP CONSTRAINT IF EXISTS tool_leads_payload_size,
  ADD CONSTRAINT  tool_leads_payload_size CHECK (
    payload IS NULL OR pg_column_size(payload) <= 32768
  );

NOTIFY pgrst, 'reload schema';
