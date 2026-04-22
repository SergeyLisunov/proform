-- ──────────────────────────────────────────────────────────────────────────
-- 024_org_group_sessions.sql
-- Organization toolkit: group sessions + participants (team practice/competition/travel).
-- Applied to prod via Supabase migration (project hhyjihbctidtucvpgjzv).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS org_group_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date     date NOT NULL,
  start_time       time,
  end_time         time,
  location         varchar(160),
  title            varchar(160) NOT NULL,
  description      text,
  session_type     varchar(30) NOT NULL DEFAULT 'team_practice'
                    CHECK (session_type IN ('team_practice','competition','travel','meeting','camp','other')),
  status           varchar(20) NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','completed','cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_group_sessions_org_date ON org_group_sessions(organization_id, session_date);

CREATE TABLE IF NOT EXISTS org_session_participants (
  session_id        uuid NOT NULL REFERENCES org_group_sessions(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_status varchar(20) NOT NULL DEFAULT 'pending'
                     CHECK (attendance_status IN ('pending','confirmed','declined','attended','absent')),
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_session_participants_user ON org_session_participants(user_id);

ALTER TABLE org_group_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_session_participants  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_group_sessions_org_all ON org_group_sessions;
CREATE POLICY org_group_sessions_org_all ON org_group_sessions
  FOR ALL USING (organization_id = get_my_user_id()) WITH CHECK (organization_id = get_my_user_id());

DROP POLICY IF EXISTS org_group_sessions_participants_select ON org_group_sessions;
CREATE POLICY org_group_sessions_participants_select ON org_group_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_session_participants p
       WHERE p.session_id = org_group_sessions.id
         AND p.user_id = get_my_user_id()
    )
  );

DROP POLICY IF EXISTS org_session_participants_org_all ON org_session_participants;
CREATE POLICY org_session_participants_org_all ON org_session_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_group_sessions s
       WHERE s.id = org_session_participants.session_id
         AND s.organization_id = get_my_user_id()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_group_sessions s
       WHERE s.id = org_session_participants.session_id
         AND s.organization_id = get_my_user_id()
    )
  );

DROP POLICY IF EXISTS org_session_participants_self_select ON org_session_participants;
CREATE POLICY org_session_participants_self_select ON org_session_participants
  FOR SELECT USING (user_id = get_my_user_id());

DROP TRIGGER IF EXISTS trg_org_group_sessions_updated ON org_group_sessions;
CREATE TRIGGER trg_org_group_sessions_updated BEFORE UPDATE ON org_group_sessions
  FOR EACH ROW EXECUTE FUNCTION _touch_updated_at();

NOTIFY pgrst, 'reload schema';
