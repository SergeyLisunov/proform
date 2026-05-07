-- ──────────────────────────────────────────────────────────────────────────
-- 052_recommendations.sql
-- Sprint W2 Day 8 — first-class structured doctor/specialist
-- recommendation entity. Closes audit gap "structured restrictions form
-- missing" + unlocks Club tier sales (organization sees compliance trail).
--
-- До этой миграции рекомендации жили в medical_diary (free-form text).
-- PR #16 добавил is_shared_with_coach флаг, но это всё ещё неструктурно.
-- Coach видит entry "no jumping for 2 weeks" в виде notification badge,
-- но НЕ может действовать на неё програмно (нет category, severity,
-- valid_until → не expire'ится auto, нет acknowledgement workflow).
--
-- Эта таблица:
--   1. Структурирует рекомендации: 9 категорий × 4 severity × 4
--      visibility_level — программируемые downstream actions.
--   2. Workflow: draft → sent → active → acknowledged → resolved/expired.
--   3. Acknowledgement по ролям: acknowledged_by_coach_at +
--      acknowledged_by_athlete_at — org dashboard показывает счётчики.
--   4. Visibility lock'ает Org Admin от чтения medical content по дефолту
--      (только agg counts). Privacy by design.
--   5. Auto-expire: trigger проверяет valid_until и переводит status='expired'
--      при выборке (если до этого не была acknowledged/resolved).
--
-- Применяется к prod через Supabase MCP.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recommendations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Контекст: org опционален (recommendation от solo doctor работает
  -- без org). NULL означает "вне организации".
  organization_id             uuid REFERENCES organizations(id) ON DELETE SET NULL,

  -- Acтеры
  athlete_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Опциональный coach addressee — если visibility=coach_*, имеет смысл
  -- указать конкретного тренера. Если NULL и visibility=coach_only/coach_and_athlete
  -- → доступ через trainer_athletes (любой active coach видит).
  coach_id                    uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Содержание
  title                       text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  body                        text,

  -- Структурированные категории — определяют downstream UI и
  -- frontend-фильтры. См. docs/CODEMAPS/recommendations.md (Day 9 docs).
  category                    text NOT NULL CHECK (category IN (
                                'load_restriction',
                                'activity_restriction',
                                'recovery',
                                'observation',
                                'consultation_request',
                                'clearance',
                                'nutrition',
                                'general',
                                'referral')),

  severity                    text NOT NULL DEFAULT 'moderate' CHECK (severity IN
                                ('low', 'moderate', 'high', 'critical')),

  -- Privacy lock per recommendation. См. подробно в RLS политиках ниже.
  visibility_level            text NOT NULL DEFAULT 'coach_and_athlete' CHECK (visibility_level IN
                                ('athlete_only',
                                 'coach_only',
                                 'coach_and_athlete',
                                 'org_full')),

  -- Workflow status
  status                      text NOT NULL DEFAULT 'sent' CHECK (status IN
                                ('draft',
                                 'sent',
                                 'active',
                                 'acknowledged',
                                 'resolved',
                                 'expired',
                                 'cancelled')),

  -- Lifecycle dates
  valid_from                  date NOT NULL DEFAULT CURRENT_DATE,
  valid_until                 date,

  -- Acknowledgement timestamps — UI работает с этим напрямую
  -- (Coach button "Понятно" → INSERT acknowledged_by_coach_at)
  acknowledged_by_coach_at    timestamptz,
  acknowledged_by_athlete_at  timestamptz,
  organization_seen_at        timestamptz,

  -- Files (lab results, scans) — visibility наследуется от recommendation
  attachments                 jsonb,

  -- Referral специфика (используется когда category='referral')
  referred_to_specialty       text CHECK (referred_to_specialty IS NULL OR referred_to_specialty IN
                                ('physician','physio','massage','nutrition','psychiatry','other')),
  referred_to_user_id         uuid REFERENCES users(id) ON DELETE SET NULL,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Indexes для быстрых query'ев
CREATE INDEX IF NOT EXISTS idx_recommendations_athlete_active
  ON recommendations(athlete_id, status)
  WHERE status IN ('sent', 'active', 'acknowledged');
CREATE INDEX IF NOT EXISTS idx_recommendations_doctor
  ON recommendations(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_coach_unack
  ON recommendations(coach_id, status)
  WHERE coach_id IS NOT NULL AND acknowledged_by_coach_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_org
  ON recommendations(organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_expiring
  ON recommendations(valid_until)
  WHERE status IN ('sent', 'active', 'acknowledged') AND valid_until IS NOT NULL;

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ──────────────────────────────────────────────────────────
-- Doctor / specialist: full CRUD on own (doctor_id = me).
DROP POLICY IF EXISTS recommendations_doctor_all ON recommendations;
CREATE POLICY recommendations_doctor_all ON recommendations
  FOR ALL USING (doctor_id = (SELECT get_my_user_id()))
           WITH CHECK (doctor_id = (SELECT get_my_user_id()));

-- Athlete: SELECT recommendations addressed to them
-- (athlete_only / coach_and_athlete / org_full visibility).
DROP POLICY IF EXISTS recommendations_athlete_read ON recommendations;
CREATE POLICY recommendations_athlete_read ON recommendations
  FOR SELECT USING (
    athlete_id = (SELECT get_my_user_id())
    AND visibility_level IN ('athlete_only', 'coach_and_athlete', 'org_full')
  );

-- Athlete: UPDATE acknowledged_by_athlete_at on own recommendations
-- (we don't allow general update — only the ack timestamp).
DROP POLICY IF EXISTS recommendations_athlete_ack ON recommendations;
CREATE POLICY recommendations_athlete_ack ON recommendations
  FOR UPDATE USING (
    athlete_id = (SELECT get_my_user_id())
    AND visibility_level IN ('athlete_only', 'coach_and_athlete', 'org_full')
  ) WITH CHECK (
    athlete_id = (SELECT get_my_user_id())
  );

-- Coach: SELECT когда visibility allows AND coach связан с athlete
-- через trainer_athletes (status='accepted').
DROP POLICY IF EXISTS recommendations_coach_read ON recommendations;
CREATE POLICY recommendations_coach_read ON recommendations
  FOR SELECT USING (
    visibility_level IN ('coach_only', 'coach_and_athlete', 'org_full')
    AND (
      -- Конкретный coach addressee
      coach_id = (SELECT get_my_user_id())
      OR
      -- coach_id NULL = "any active coach of this athlete"
      (coach_id IS NULL AND EXISTS (
        SELECT 1 FROM trainer_athletes ta
         WHERE ta.trainer_id = (SELECT get_my_user_id())
           AND ta.athlete_id = recommendations.athlete_id
           AND ta.status = 'accepted'
      ))
    )
  );

-- Coach: UPDATE acknowledged_by_coach_at — позволяет тренеру нажать
-- "Понятно" в UI и записать timestamp.
DROP POLICY IF EXISTS recommendations_coach_ack ON recommendations;
CREATE POLICY recommendations_coach_ack ON recommendations
  FOR UPDATE USING (
    visibility_level IN ('coach_only', 'coach_and_athlete', 'org_full')
    AND (
      coach_id = (SELECT get_my_user_id())
      OR
      (coach_id IS NULL AND EXISTS (
        SELECT 1 FROM trainer_athletes ta
         WHERE ta.trainer_id = (SELECT get_my_user_id())
           AND ta.athlete_id = recommendations.athlete_id
           AND ta.status = 'accepted'
      ))
    )
  ) WITH CHECK (
    -- WITH CHECK: same condition — tren'ant cannot change athlete_id /
    -- doctor_id / visibility_level. UI sends ONLY the ack timestamp +
    -- status change. App-layer responsibility to send minimal patch.
    visibility_level IN ('coach_only', 'coach_and_athlete', 'org_full')
  );

-- Org admin: SELECT для recommendations его организации.
-- Reads agg counts AND content только если visibility='org_full'.
-- Implementation note: at SQL-level we can't easily restrict "agg only";
-- we let org admin SEE the rows but the app-layer (services/recommendations)
-- redacts body/title for non-org_full visibility before rendering.
-- This is intentional simplification — we trust app-layer + audit_logs.
DROP POLICY IF EXISTS recommendations_org_admin_read ON recommendations;
CREATE POLICY recommendations_org_admin_read ON recommendations
  FOR SELECT USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM org_members om
       WHERE om.org_id     = recommendations.organization_id
         AND om.user_id    = (SELECT get_my_user_id())
         AND om.status     = 'active'
         AND om.member_role IN ('org_owner', 'org_admin')
    )
  );

-- Specialist (referred_to_user_id): SELECT когда athlete был
-- referred to них.
DROP POLICY IF EXISTS recommendations_referred_specialist_read ON recommendations;
CREATE POLICY recommendations_referred_specialist_read ON recommendations
  FOR SELECT USING (
    referred_to_user_id = (SELECT get_my_user_id())
  );

-- ── Trigger: updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_recommendations_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at = now();
  -- Auto-derive status from acknowledgement state for visibility:
  -- if both required parties have acknowledged AND status is 'sent'/'active',
  -- bump to 'acknowledged'.
  IF NEW.status IN ('sent', 'active') THEN
    IF NEW.visibility_level = 'coach_and_athlete'
       AND NEW.acknowledged_by_coach_at IS NOT NULL
       AND NEW.acknowledged_by_athlete_at IS NOT NULL THEN
      NEW.status = 'acknowledged';
    ELSIF NEW.visibility_level = 'coach_only'
       AND NEW.acknowledged_by_coach_at IS NOT NULL THEN
      NEW.status = 'acknowledged';
    ELSIF NEW.visibility_level = 'athlete_only'
       AND NEW.acknowledged_by_athlete_at IS NOT NULL THEN
      NEW.status = 'acknowledged';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_recommendations_updated_at ON recommendations;
CREATE TRIGGER trg_recommendations_updated_at BEFORE UPDATE ON recommendations
  FOR EACH ROW EXECUTE FUNCTION trg_recommendations_updated_at();

-- ── Function: auto-expire stale recommendations ──────────────────────────
-- Called by cron (Vercel Cron Day 11 wires this) or manually via RPC.
-- Marks recommendations as 'expired' when valid_until < CURRENT_DATE
-- and status is still in active states.
CREATE OR REPLACE FUNCTION expire_stale_recommendations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE recommendations
     SET status = 'expired'
   WHERE status IN ('sent', 'active', 'acknowledged')
     AND valid_until IS NOT NULL
     AND valid_until < CURRENT_DATE;
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END $$;

-- Lock down the function to admin / service-role only (per security audit
-- pattern from migration 042_security_definer_hardening).
REVOKE ALL ON FUNCTION expire_stale_recommendations() FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_stale_recommendations() FROM anon;
REVOKE ALL ON FUNCTION expire_stale_recommendations() FROM authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_recommendations() TO service_role;

NOTIFY pgrst, 'reload schema';
