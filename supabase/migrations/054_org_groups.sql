-- ──────────────────────────────────────────────────────────────────────────
-- 054_org_groups.sql
-- Sprint W2 Day 10 — teams / groups внутри организации с age range +
-- skill level + head coach.
--
-- Use case: спортивная школа имеет команды U-12, U-16, Senior; фитнес-
-- центр имеет группы "Beginner", "Advanced"; академия имеет смешанные
-- группы с пересечением.
--
-- Foundation для:
--  - Day 11 Org Dashboard widget "Teams overview" (count athletes per
--    team)
--  - Day 12 bulk-invite по командам
--  - Org-Specific RLS scope (team-level recommendations в будущем)
--
-- НЕ заменяет существующий `org_group_sessions` (это конкретные
-- session events). Эта таблица — структурная: roster of teams.
--
-- Применяется к prod через Supabase MCP.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Главная таблица team / group
CREATE TABLE IF NOT EXISTS org_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description     text,
  age_min         smallint CHECK (age_min IS NULL OR age_min BETWEEN 3 AND 120),
  age_max         smallint CHECK (age_max IS NULL OR age_max BETWEEN 3 AND 120),
  -- Skill level — для фильтрации roster'а на сайте + matching
  level           text CHECK (level IS NULL OR level IN
                    ('beginner','intermediate','advanced','pro','recreational')),
  -- Head coach: дает coach'у права управлять командой
  head_coach_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Колор для UI (badge/card accent), опционален
  color           text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Логическая инвариант: age_min <= age_max (при оба заданы)
  CONSTRAINT org_groups_age_range_check
    CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
  -- Уникальность имени в рамках организации
  UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_groups_org_active
  ON org_groups(organization_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_groups_head_coach
  ON org_groups(head_coach_id) WHERE head_coach_id IS NOT NULL;

-- 2. M2M атлет ↔ команда
CREATE TABLE IF NOT EXISTS org_group_members (
  group_id    uuid NOT NULL REFERENCES org_groups(id) ON DELETE CASCADE,
  athlete_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Опционально кто добавил атлета в команду (audit trail)
  added_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_org_group_members_athlete
  ON org_group_members(athlete_id);

-- 3. RLS

ALTER TABLE org_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_group_members ENABLE ROW LEVEL SECURITY;

-- 3a. org_groups
-- READ: любой active member организации видит teams (для context'а
-- "к какой команде я принадлежу" в athlete UI + coach picker'е)
DROP POLICY IF EXISTS org_groups_member_read ON org_groups;
CREATE POLICY org_groups_member_read ON org_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM org_members om
       WHERE om.org_id     = org_groups.organization_id
         AND om.user_id    = (SELECT get_my_user_id())
         AND om.status     = 'active'
    )
  );

-- WRITE: только org_owner / org_admin создают/редактируют команды
DROP POLICY IF EXISTS org_groups_admin_write ON org_groups;
CREATE POLICY org_groups_admin_write ON org_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_members om
       WHERE om.org_id     = org_groups.organization_id
         AND om.user_id    = (SELECT get_my_user_id())
         AND om.status     = 'active'
         AND om.member_role IN ('org_owner', 'org_admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members om
       WHERE om.org_id     = org_groups.organization_id
         AND om.user_id    = (SELECT get_my_user_id())
         AND om.status     = 'active'
         AND om.member_role IN ('org_owner', 'org_admin')
    )
  );

-- HEAD COACH WRITE: head coach может редактировать СВОЮ команду
-- (но не создавать/удалять — это admin only).
DROP POLICY IF EXISTS org_groups_head_coach_update ON org_groups;
CREATE POLICY org_groups_head_coach_update ON org_groups
  FOR UPDATE USING (
    head_coach_id = (SELECT get_my_user_id())
  ) WITH CHECK (
    head_coach_id = (SELECT get_my_user_id())
  );

-- 3b. org_group_members
-- READ: любой active member org видит roster (для team list в athlete /
-- coach UI). Athlete сам видит свои команды.
DROP POLICY IF EXISTS org_group_members_read ON org_group_members;
CREATE POLICY org_group_members_read ON org_group_members
  FOR SELECT USING (
    -- Атлет видит свою группу
    athlete_id = (SELECT get_my_user_id())
    OR
    -- Member организации видит все группы
    EXISTS (
      SELECT 1 FROM org_groups og
        JOIN org_members om ON om.org_id = og.organization_id
       WHERE og.id        = org_group_members.group_id
         AND om.user_id   = (SELECT get_my_user_id())
         AND om.status    = 'active'
    )
  );

-- WRITE: org_admin или head_coach группы добавляют/удаляют членов
DROP POLICY IF EXISTS org_group_members_admin_write ON org_group_members;
CREATE POLICY org_group_members_admin_write ON org_group_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM org_groups og
        JOIN org_members om ON om.org_id = og.organization_id
       WHERE og.id        = org_group_members.group_id
         AND om.user_id   = (SELECT get_my_user_id())
         AND om.status    = 'active'
         AND om.member_role IN ('org_owner', 'org_admin')
    )
    OR EXISTS (
      SELECT 1 FROM org_groups og
       WHERE og.id            = org_group_members.group_id
         AND og.head_coach_id = (SELECT get_my_user_id())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_groups og
        JOIN org_members om ON om.org_id = og.organization_id
       WHERE og.id        = org_group_members.group_id
         AND om.user_id   = (SELECT get_my_user_id())
         AND om.status    = 'active'
         AND om.member_role IN ('org_owner', 'org_admin')
    )
    OR EXISTS (
      SELECT 1 FROM org_groups og
       WHERE og.id            = org_group_members.group_id
         AND og.head_coach_id = (SELECT get_my_user_id())
    )
  );

-- 4. Trigger для updated_at
CREATE OR REPLACE FUNCTION trg_org_groups_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_org_groups_updated_at ON org_groups;
CREATE TRIGGER trg_org_groups_updated_at BEFORE UPDATE ON org_groups
  FOR EACH ROW EXECUTE FUNCTION trg_org_groups_updated_at();

NOTIFY pgrst, 'reload schema';
