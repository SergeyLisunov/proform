-- ──────────────────────────────────────────────────────────────────────────
-- 039_user_device_connections.sql
-- Подключение носимых устройств: Garmin Connect, Whoop, Apple Health.
-- Одна запись на (user_id, provider). Флаг is_primary отмечает девайс,
-- с которого тянем основные метрики (recovery, HRV, strain). Уникальный
-- partial-index гарантирует: у одного пользователя максимум один
-- is_primary = true.
--
-- OAuth токены (access/refresh) хранятся как text — доступ только у
-- владельца через RLS (user_id = get_my_user_id()) и у service-role
-- из API-роутов синхронизации.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_device_connections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           varchar(20) NOT NULL
                      CHECK (provider IN ('garmin','whoop','apple_health')),
  status             varchar(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('connected','pending','failed','revoked')),
  is_primary         boolean NOT NULL DEFAULT true,
  provider_user_id   text,
  access_token       text,
  refresh_token      text,
  token_expires_at   timestamptz,
  scope              text,
  last_sync_at       timestamptz,
  last_sync_error    text,
  metadata           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_device_primary
  ON user_device_connections(user_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_user_device_connections_user
  ON user_device_connections(user_id);

ALTER TABLE user_device_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_device_connections_own ON user_device_connections;
CREATE POLICY user_device_connections_own ON user_device_connections
  FOR ALL USING (user_id = (SELECT get_my_user_id()))
           WITH CHECK (user_id = (SELECT get_my_user_id()));

CREATE OR REPLACE FUNCTION trg_user_device_connections_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_user_device_connections_updated_at ON user_device_connections;
CREATE TRIGGER trg_user_device_connections_updated_at BEFORE UPDATE ON user_device_connections
  FOR EACH ROW EXECUTE FUNCTION trg_user_device_connections_updated_at();

NOTIFY pgrst, 'reload schema';
