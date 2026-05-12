-- Sprint W6 Day 30 — Onboarding wizards (Athlete + Coach).
--
-- Adds a JSONB column to track per-user wizard progress. Open-shape
-- on purpose (same rationale as notification_prefs in 065): channels
-- can evolve without schema migrations, and the wizard payload
-- differs per role.
--
-- Expected shape:
--   {
--     "completed":     boolean,        -- terminal flag set on finish
--     "started_at":    timestamptz,    -- when wizard was first opened
--     "completed_at":  timestamptz,    -- nullable
--     "step":          string,         -- current step key (e.g. "goal")
--     "role_when_started": string,     -- snapshot of users.role at start
--     "athlete":  { "sport": string, "goal": string, "level": string },  -- athlete-specific
--     "coach":    { "speciality": string, "first_invite_email": string }, -- coach-specific
--   }
--
-- Defaults to '{}'::jsonb (empty) so existing users see the wizard once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb;

-- GIN index supports containment queries (e.g. "find all users who
-- completed onboarding" → WHERE onboarding_state @> '{"completed":true}').
CREATE INDEX IF NOT EXISTS idx_users_onboarding_state_gin
  ON users USING GIN (onboarding_state jsonb_path_ops);

COMMENT ON COLUMN users.onboarding_state IS
  'Sprint W6 Day 30: wizard progress JSON. Open shape — completed:bool, step:str, role-specific subkeys (athlete/coach/org/doctor).';

NOTIFY pgrst, 'reload schema';
