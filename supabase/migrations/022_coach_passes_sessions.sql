-- ──────────────────────────────────────────────────────────────────────────
-- 022_coach_passes_sessions.sql
-- Coach toolkit: pass plans, athlete passes, coaching sessions, attendance.
-- Applied to prod via Supabase migration (project hhyjihbctidtucvpgjzv).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_pass_plans (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           varchar(120) NOT NULL,
  description     text,
  total_sessions  smallint NOT NULL CHECK (total_sessions > 0),
  period_days     smallint NOT NULL CHECK (period_days > 0),
  price_cents     integer  NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency        char(3)  NOT NULL DEFAULT 'RUB',
  is_active       boolean  NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_pass_plans_coach ON coach_pass_plans(coach_id, is_active);

CREATE TABLE IF NOT EXISTS athlete_passes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id         uuid REFERENCES coach_pass_plans(id) ON DELETE SET NULL,
  title           varchar(120) NOT NULL,
  total_sessions  smallint NOT NULL CHECK (total_sessions > 0),
  used_sessions   smallint NOT NULL DEFAULT 0 CHECK (used_sessions >= 0),
  starts_at       date NOT NULL,
  expires_at      date NOT NULL,
  price_cents     integer  NOT NULL DEFAULT 0,
  currency        char(3)  NOT NULL DEFAULT 'RUB',
  status          varchar(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','expired','paused','cancelled','finished')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_athlete_passes_athlete ON athlete_passes(athlete_id, status);
CREATE INDEX IF NOT EXISTS idx_athlete_passes_coach   ON athlete_passes(coach_id, status);

CREATE TABLE IF NOT EXISTS coach_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pass_id         uuid REFERENCES athlete_passes(id) ON DELETE SET NULL,
  session_date    date NOT NULL,
  start_time      time,
  end_time        time,
  location        varchar(160),
  title           varchar(160),
  notes           text,
  status          varchar(20) NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned','completed','no_show','cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_coach_date   ON coach_sessions(coach_id, session_date);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_athlete_date ON coach_sessions(athlete_id, session_date);
CREATE INDEX IF NOT EXISTS idx_coach_sessions_pass         ON coach_sessions(pass_id);

ALTER TABLE coach_pass_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_passes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessions   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_pass_plans_coach_all ON coach_pass_plans;
CREATE POLICY coach_pass_plans_coach_all ON coach_pass_plans
  FOR ALL USING (coach_id = get_my_user_id()) WITH CHECK (coach_id = get_my_user_id());

DROP POLICY IF EXISTS athlete_passes_coach_all ON athlete_passes;
CREATE POLICY athlete_passes_coach_all ON athlete_passes
  FOR ALL USING (coach_id = get_my_user_id()) WITH CHECK (coach_id = get_my_user_id());

DROP POLICY IF EXISTS athlete_passes_athlete_select ON athlete_passes;
CREATE POLICY athlete_passes_athlete_select ON athlete_passes
  FOR SELECT USING (athlete_id = get_my_user_id());

DROP POLICY IF EXISTS coach_sessions_coach_all ON coach_sessions;
CREATE POLICY coach_sessions_coach_all ON coach_sessions
  FOR ALL USING (coach_id = get_my_user_id()) WITH CHECK (coach_id = get_my_user_id());

DROP POLICY IF EXISTS coach_sessions_athlete_select ON coach_sessions;
CREATE POLICY coach_sessions_athlete_select ON coach_sessions
  FOR SELECT USING (athlete_id = get_my_user_id());

CREATE OR REPLACE FUNCTION sync_athlete_pass_usage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' AND NEW.pass_id IS NOT NULL THEN
      UPDATE athlete_passes SET used_sessions = used_sessions + 1, updated_at = now()
       WHERE id = NEW.pass_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.pass_id IS DISTINCT FROM OLD.pass_id THEN
      IF OLD.status = 'completed' AND OLD.pass_id IS NOT NULL THEN
        UPDATE athlete_passes SET used_sessions = GREATEST(used_sessions - 1, 0), updated_at = now()
         WHERE id = OLD.pass_id;
      END IF;
      IF NEW.status = 'completed' AND NEW.pass_id IS NOT NULL THEN
        UPDATE athlete_passes SET used_sessions = used_sessions + 1, updated_at = now()
         WHERE id = NEW.pass_id;
      END IF;
    ELSIF OLD.status <> 'completed' AND NEW.status = 'completed' AND NEW.pass_id IS NOT NULL THEN
      UPDATE athlete_passes SET used_sessions = used_sessions + 1, updated_at = now()
       WHERE id = NEW.pass_id;
    ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' AND OLD.pass_id IS NOT NULL THEN
      UPDATE athlete_passes SET used_sessions = GREATEST(used_sessions - 1, 0), updated_at = now()
       WHERE id = OLD.pass_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'completed' AND OLD.pass_id IS NOT NULL THEN
      UPDATE athlete_passes SET used_sessions = GREATEST(used_sessions - 1, 0), updated_at = now()
       WHERE id = OLD.pass_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_coach_sessions_sync_pass ON coach_sessions;
CREATE TRIGGER trg_coach_sessions_sync_pass
  AFTER INSERT OR UPDATE OR DELETE ON coach_sessions
  FOR EACH ROW EXECUTE FUNCTION sync_athlete_pass_usage();

CREATE OR REPLACE FUNCTION _touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_athlete_passes_updated ON athlete_passes;
CREATE TRIGGER trg_athlete_passes_updated BEFORE UPDATE ON athlete_passes
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

DROP TRIGGER IF EXISTS trg_coach_sessions_updated ON coach_sessions;
CREATE TRIGGER trg_coach_sessions_updated BEFORE UPDATE ON coach_sessions
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

NOTIFY pgrst, 'reload schema';
