-- W10 Day 51: Admin-initiated user invites.
--
-- Distinct from email_invites (W3) which is for role-to-role connections
-- between existing users. This table tracks admin-initiated "please join
-- the platform with role X" emails.
--
-- Flow: admin POST /api/admin/invite → row inserted → Resend email with
-- /auth/register?invite=<token>&role=<role> link → user registers → token
-- claimed (status='claimed', linked user_id, accepted_at filled).

CREATE TABLE IF NOT EXISTS admin_user_invites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token                uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email                varchar(255) NOT NULL,
  target_role          varchar(20) NOT NULL
                        CHECK (target_role IN ('athlete','coach','doctor','organization')),
  created_by_admin_id  uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  status               varchar(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','claimed','expired','revoked')),
  claimed_by_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at           timestamptz,
  expires_at           timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_user_invites_admin
  ON admin_user_invites(created_by_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_invites_email_status
  ON admin_user_invites(lower(email), status);
CREATE INDEX IF NOT EXISTS idx_admin_user_invites_token
  ON admin_user_invites(token);

ALTER TABLE admin_user_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_user_invites_admin_all ON admin_user_invites;
CREATE POLICY admin_user_invites_admin_all ON admin_user_invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.auth_id = auth.uid() AND me.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.auth_id = auth.uid() AND me.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
