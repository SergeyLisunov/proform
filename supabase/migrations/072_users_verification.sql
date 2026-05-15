-- W9 Day 45: Verified coach badge.
-- Trust signal orthogonal to UGC reviews — admin-issued, time-stamped.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_verified  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

CREATE INDEX IF NOT EXISTS users_verified_idx ON users (is_verified) WHERE is_verified = true;

DROP POLICY IF EXISTS users_admin_update_verification ON users;
CREATE POLICY users_admin_update_verification ON users
  FOR UPDATE TO authenticated
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
