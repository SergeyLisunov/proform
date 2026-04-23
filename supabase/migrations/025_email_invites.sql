-- ──────────────────────────────────────────────────────────────────────────
-- 025_email_invites.sql
-- Tokenised email invitations: invite an unregistered user (or a known email)
-- to a role-to-role connection. Token is claimed via the /api/invite/[token]
-- route which runs with service role and creates the underlying `connections`
-- row after the recipient signs in (or signs up).
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_invites (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token               uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  inviter_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email               varchar(255) NOT NULL,
  connection_type     varchar(30) NOT NULL
                       CHECK (connection_type IN (
                         'coach_athlete','org_coach','org_athlete',
                         'doctor_athlete','coach_doctor','org_doctor','admin_doctor'
                       )),
  message             text,
  status              varchar(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','claimed','expired','revoked')),
  claimed_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at          timestamptz,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_invites_inviter ON email_invites(inviter_id);
CREATE INDEX IF NOT EXISTS idx_email_invites_email_status ON email_invites(lower(email), status);
CREATE INDEX IF NOT EXISTS idx_email_invites_token ON email_invites(token);

ALTER TABLE email_invites ENABLE ROW LEVEL SECURITY;

-- Inviter can manage their own outgoing invites (list, revoke).
DROP POLICY IF EXISTS email_invites_inviter_all ON email_invites;
CREATE POLICY email_invites_inviter_all ON email_invites
  FOR ALL USING (inviter_id = get_my_user_id())
           WITH CHECK (inviter_id = get_my_user_id());

-- A signed-in recipient whose email matches can see invites addressed to them.
DROP POLICY IF EXISTS email_invites_recipient_select ON email_invites;
CREATE POLICY email_invites_recipient_select ON email_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.id = get_my_user_id()
         AND lower(u.email) = lower(email_invites.email)
    )
  );

-- Claim is executed by the service-role Supabase client in /api/invite/[token].
-- No authenticated INSERT/UPDATE policy beyond the inviter ALL policy above.

NOTIFY pgrst, 'reload schema';
