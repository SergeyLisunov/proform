-- ──────────────────────────────────────────────────────────────────────────
-- 053_org_members_role_widening.sql
-- Sprint W2 Day 8 — расширить org_members.member_role enum value space.
--
-- До этой миграции value space был: ('athlete', 'coach') — слишком
-- узкий. Audit's расширенная модель требует: org_owner / org_admin /
-- coach / doctor / specialist / athlete.
--
-- Семантика старых ролей сохраняется (backwards compat). Все existing
-- rows с member_role='athlete'/'coach' продолжают работать. Новые
-- роли (org_owner/org_admin/doctor/specialist) появляются для onboarding'а
-- multi-role staff в spринт W2 Day 12.
--
-- Org-level RLS политики уже опираются на этот columns (см. migration 052
-- recommendations_org_admin_read), так что widening — необходимое условие
-- для recommendations работы.
--
-- Применяется к prod через Supabase MCP.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Drop old constraint with narrow value space
ALTER TABLE org_members
  DROP CONSTRAINT IF EXISTS org_members_member_role_check;

-- 2. Add new constraint with full value space
ALTER TABLE org_members
  ADD CONSTRAINT org_members_member_role_check
  CHECK (member_role IN (
    'org_owner',  -- Один на org, может transfer ownership + manage billing
    'org_admin',  -- Daily ops: invite/assign/remove, draft newsletter
    'coach',      -- Тренер организации
    'doctor',     -- Врач организации
    'specialist', -- Massage / Physio / Nutrition / Psychiatry в составе org
    'athlete'     -- Член организации как atлет
  ));

-- 3. Index for role-filtered queries (Org Dashboard counts staff by role)
CREATE INDEX IF NOT EXISTS idx_org_members_role_active
  ON org_members(org_id, member_role, status)
  WHERE status = 'active';

NOTIFY pgrst, 'reload schema';
