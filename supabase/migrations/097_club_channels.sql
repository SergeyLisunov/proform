-- ──────────────────────────────────────────────────────────────────────────
-- 097_club_channels.sql  (P2 — клубные каналы)
--
-- Внутренний коммуникационный периметр клуба (замена Telegram-каналов и
-- родительских чатов WhatsApp). Дизайн по бенчмарку Spond/TeamSnap/
-- ClassDojo/Heja + child-safety правила Instagram Teen Accounts.
--
-- Ключевые решения:
--   * Membership НЕ хранится: видимость ДЕРИВИРУЕТСЯ из org_members,
--     org_group_members, parent_links (ушёл из клуба — пропали каналы).
--   * Дети не видят discussion-каналы взрослых (team_parents_chat) на
--     уровне RLS-предиката; никаких новых путей «ребёнок↔незнакомец».
--   * Реакции без публичных счётчиков: чужие реакции видит только автор
--     поста (агрегатом «N поздравлений»).
--   * Только soft-delete (safeguarding-аудит, паттерн ClassDojo).
--   * wall_posts (публичная витрина) НЕ трогаем: внутренний и публичный
--     контур — разные таблицы, поток наружу только явным действием.
--   * Default-каналы: 3 клубных (объявления/достижения/тренерская) при
--     создании организации + 2 командных (новости/чат родителей) при
--     создании org_groups; triggers + backfill.
--   * Автопост личного рекорда в «Достижения» — SECURITY DEFINER trigger
--     на athlete_records; ТОЛЬКО для атлетов без активной parent_links
--     (эвристика «ребёнок» из 093) — детские рекорды в канал не идут
--     до появления родительского opt-in.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Каналы: клубные (group_id IS NULL) и командные в одной таблице
CREATE TABLE IF NOT EXISTS public.channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_id    uuid REFERENCES public.org_groups(id) ON DELETE CASCADE,
  key         text NOT NULL CHECK (key IN (
                'club_announcements','club_achievements','team_news',
                'team_parents_chat','staff_room','club_media',
                'club_events','club_general_chat')),
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  kind        text NOT NULL CHECK (kind IN ('broadcast','discussion')),
  audience    text NOT NULL CHECK (audience IN ('all','team','team_parents','staff','adults')),
  post_policy text NOT NULL CHECK (post_policy IN ('admins','coaches_admins','members')),
  is_system   boolean NOT NULL DEFAULT true,
  is_enabled  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_channels_org_key_group
  ON public.channels (org_id, key, COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2) Посты/сообщения
CREATE TABLE IF NOT EXISTS public.channel_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES public.users(id) ON DELETE SET NULL, -- NULL = системный автопост
  kind       text NOT NULL DEFAULT 'post' CHECK (kind IN
               ('post','system_record','system_schedule','system_event','system_digest')),
  body       text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  record_id  uuid REFERENCES public.athlete_records(id) ON DELETE SET NULL,
  is_pinned  boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_channel_posts_feed
  ON public.channel_posts (channel_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- 3) Прочитанность / mute
CREATE TABLE IF NOT EXISTS public.channel_reads (
  channel_id   uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted        boolean NOT NULL DEFAULT false,
  PRIMARY KEY (channel_id, user_id)
);

-- 4) Реакции «поздравить» — без публичных счётчиков
CREATE TABLE IF NOT EXISTS public.channel_post_reactions (
  post_id    uuid NOT NULL REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- ── Центральные предикаты (паттерн can_notify из 081/086) ────────────────

CREATE OR REPLACE FUNCTION public.is_child_account(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM parent_links pl
    WHERE pl.child_id = p_user AND pl.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_channel(p_channel uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c   record;
  me  uuid := public.get_my_user_id();
  my_role text;
BEGIN
  IF me IS NULL THEN RETURN false; END IF;

  SELECT org_id, group_id, audience, is_enabled INTO c
  FROM channels WHERE id = p_channel;
  IF NOT FOUND OR NOT c.is_enabled THEN RETURN false; END IF;

  -- Роль в клубе (NULL = не член; родитель ребёнка-члена — отдельная ветка)
  SELECT om.member_role INTO my_role
  FROM org_members om
  WHERE om.org_id = c.org_id AND om.user_id = me AND om.status = 'active'
  LIMIT 1;

  IF c.audience = 'staff' THEN
    RETURN my_role IN ('org_owner','org_admin','coach','doctor','specialist');
  END IF;

  IF c.audience = 'team' OR c.audience = 'team_parents' THEN
    -- Штаб клуба видит все командные каналы
    IF my_role IN ('org_owner','org_admin','coach','doctor','specialist') THEN
      RETURN true;
    END IF;
    -- Родитель ребёнка из группы
    IF EXISTS (
      SELECT 1 FROM parent_links pl
      JOIN org_group_members gm ON gm.athlete_id = pl.child_id
      WHERE pl.parent_id = me AND pl.status = 'active' AND gm.group_id = c.group_id
    ) THEN
      RETURN true;
    END IF;
    -- Спортсмен группы: только team (в team_parents детям/атлетам входа нет)
    IF c.audience = 'team' AND EXISTS (
      SELECT 1 FROM org_group_members gm
      WHERE gm.group_id = c.group_id AND gm.athlete_id = me
    ) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  -- 'all' | 'adults': член клуба или родитель ребёнка-члена
  IF my_role IS NULL AND NOT EXISTS (
    SELECT 1 FROM parent_links pl
    JOIN org_members om2 ON om2.user_id = pl.child_id
    WHERE pl.parent_id = me AND pl.status = 'active'
      AND om2.org_id = c.org_id AND om2.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  IF c.audience = 'adults' AND public.is_child_account(me) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_post_channel(p_channel uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c   record;
  me  uuid := public.get_my_user_id();
  my_role text;
BEGIN
  IF me IS NULL OR NOT public.can_read_channel(p_channel) THEN RETURN false; END IF;

  SELECT org_id, group_id, post_policy INTO c FROM channels WHERE id = p_channel;

  SELECT om.member_role INTO my_role
  FROM org_members om
  WHERE om.org_id = c.org_id AND om.user_id = me AND om.status = 'active'
  LIMIT 1;

  IF c.post_policy = 'admins' THEN
    RETURN my_role IN ('org_owner','org_admin');
  END IF;
  IF c.post_policy = 'coaches_admins' THEN
    RETURN my_role IN ('org_owner','org_admin','coach')
        OR EXISTS (SELECT 1 FROM org_groups g
                   WHERE g.id = c.group_id AND g.head_coach_id = me);
  END IF;
  -- 'members': любой взрослый читатель (дети в discussion не пишут)
  RETURN NOT public.is_child_account(me);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_channel_moderator(p_channel uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c  record;
  me uuid := public.get_my_user_id();
BEGIN
  IF me IS NULL THEN RETURN false; END IF;
  SELECT org_id, group_id INTO c FROM channels WHERE id = p_channel;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM org_members om
    WHERE om.org_id = c.org_id AND om.user_id = me
      AND om.status = 'active' AND om.member_role IN ('org_owner','org_admin')
  ) OR EXISTS (
    SELECT 1 FROM org_groups g WHERE g.id = c.group_id AND g.head_coach_id = me
  );
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.channels               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_posts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_reads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channels_read ON public.channels;
CREATE POLICY channels_read ON public.channels
  FOR SELECT TO public USING (public.can_read_channel(id));

DROP POLICY IF EXISTS channels_admin_update ON public.channels;
CREATE POLICY channels_admin_update ON public.channels
  FOR UPDATE TO public USING (public.is_channel_moderator(id));

DROP POLICY IF EXISTS channel_posts_read ON public.channel_posts;
CREATE POLICY channel_posts_read ON public.channel_posts
  FOR SELECT TO public USING (
    deleted_at IS NULL AND public.can_read_channel(channel_id)
  );

DROP POLICY IF EXISTS channel_posts_insert ON public.channel_posts;
CREATE POLICY channel_posts_insert ON public.channel_posts
  FOR INSERT TO public WITH CHECK (
    author_id = (SELECT public.get_my_user_id())
    AND kind = 'post'
    AND public.can_post_channel(channel_id)
  );

-- Автор правит своё; модератор — pin/soft-delete любого
DROP POLICY IF EXISTS channel_posts_update ON public.channel_posts;
CREATE POLICY channel_posts_update ON public.channel_posts
  FOR UPDATE TO public USING (
    author_id = (SELECT public.get_my_user_id())
    OR public.is_channel_moderator(channel_id)
  );

DROP POLICY IF EXISTS channel_reads_self ON public.channel_reads;
CREATE POLICY channel_reads_self ON public.channel_reads
  FOR ALL TO public
  USING (user_id = (SELECT public.get_my_user_id()))
  WITH CHECK (user_id = (SELECT public.get_my_user_id())
              AND public.can_read_channel(channel_id));

-- Реакции: свои строки пишу/удаляю; читаю свои ИЛИ реакции на мой пост
DROP POLICY IF EXISTS channel_reactions_select ON public.channel_post_reactions;
CREATE POLICY channel_reactions_select ON public.channel_post_reactions
  FOR SELECT TO public USING (
    user_id = (SELECT public.get_my_user_id())
    OR EXISTS (SELECT 1 FROM public.channel_posts p
               WHERE p.id = post_id
                 AND p.author_id = (SELECT public.get_my_user_id()))
  );
DROP POLICY IF EXISTS channel_reactions_insert ON public.channel_post_reactions;
CREATE POLICY channel_reactions_insert ON public.channel_post_reactions
  FOR INSERT TO public WITH CHECK (
    user_id = (SELECT public.get_my_user_id())
    AND EXISTS (SELECT 1 FROM public.channel_posts p
                WHERE p.id = post_id AND p.deleted_at IS NULL
                  AND public.can_read_channel(p.channel_id))
  );
DROP POLICY IF EXISTS channel_reactions_delete ON public.channel_post_reactions;
CREATE POLICY channel_reactions_delete ON public.channel_post_reactions
  FOR DELETE TO public USING (user_id = (SELECT public.get_my_user_id()));

-- ── Default-каналы: триггеры-проекции + backfill ─────────────────────────

CREATE OR REPLACE FUNCTION public.seed_org_channels()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO channels (org_id, key, title, kind, audience, post_policy)
  VALUES
    (NEW.id, 'club_announcements', 'Объявления клуба', 'broadcast',  'all',   'admins'),
    (NEW.id, 'club_achievements',  'Достижения',       'broadcast',  'all',   'coaches_admins'),
    (NEW.id, 'staff_room',         'Тренерская',       'discussion', 'staff', 'coaches_admins')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_org_channels ON public.organizations;
CREATE TRIGGER trg_seed_org_channels
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.seed_org_channels();

CREATE OR REPLACE FUNCTION public.seed_group_channels()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO channels (org_id, group_id, key, title, kind, audience, post_policy)
  VALUES
    (NEW.organization_id, NEW.id, 'team_news',
     NEW.name || ': объявления', 'broadcast', 'team', 'coaches_admins'),
    (NEW.organization_id, NEW.id, 'team_parents_chat',
     NEW.name || ': чат родителей', 'discussion', 'team_parents', 'members')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_group_channels ON public.org_groups;
CREATE TRIGGER trg_seed_group_channels
  AFTER INSERT ON public.org_groups
  FOR EACH ROW EXECUTE FUNCTION public.seed_group_channels();

-- Backfill существующих организаций и групп
INSERT INTO public.channels (org_id, key, title, kind, audience, post_policy)
SELECT o.id, v.key, v.title, v.kind, v.audience, v.post_policy
FROM public.organizations o
CROSS JOIN (VALUES
  ('club_announcements', 'Объявления клуба', 'broadcast',  'all',   'admins'),
  ('club_achievements',  'Достижения',       'broadcast',  'all',   'coaches_admins'),
  ('staff_room',         'Тренерская',       'discussion', 'staff', 'coaches_admins')
) AS v(key, title, kind, audience, post_policy)
ON CONFLICT DO NOTHING;

INSERT INTO public.channels (org_id, group_id, key, title, kind, audience, post_policy)
SELECT g.organization_id, g.id, v.key,
       g.name || v.suffix, v.kind, v.audience, v.post_policy
FROM public.org_groups g
CROSS JOIN (VALUES
  ('team_news',         ': объявления',     'broadcast',  'team',         'coaches_admins'),
  ('team_parents_chat', ': чат родителей',  'discussion', 'team_parents', 'members')
) AS v(key, suffix, kind, audience, post_policy)
WHERE g.is_active
ON CONFLICT DO NOTHING;

-- ── Автопост личного рекорда в «Достижения» ──────────────────────────────
-- Только для атлетов БЕЗ активной parent_links (не-дети, эвристика 093).
-- Mastery-формулировка: рекорд против себя, никаких сравнений.

CREATE OR REPLACE FUNCTION public.autopost_record_to_achievements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  athlete_name text;
  record_label text;
  ch RECORD;
BEGIN
  -- UPDATE без изменения значения (например, touched updated_at) — не рекорд
  IF TG_OP = 'UPDATE' AND OLD.value IS NOT DISTINCT FROM NEW.value THEN
    RETURN NEW;
  END IF;
  -- Детские рекорды в канал не идут до родительского opt-in
  IF public.is_child_account(NEW.athlete_id) THEN RETURN NEW; END IF;

  SELECT name INTO athlete_name FROM users WHERE id = NEW.athlete_id;
  record_label := CASE NEW.kind
    WHEN 'longest_workout'      THEN 'самая длинная тренировка'
    WHEN 'best_week_volume'     THEN 'лучший недельный объём'
    WHEN 'training_streak_days' THEN 'серия тренировочных дней'
    ELSE NEW.kind
  END;

  FOR ch IN
    SELECT c.id FROM channels c
    JOIN org_members om ON om.org_id = c.org_id
    WHERE c.key = 'club_achievements' AND c.is_enabled
      AND om.user_id = NEW.athlete_id AND om.status = 'active'
  LOOP
    INSERT INTO channel_posts (channel_id, author_id, kind, body, record_id)
    VALUES (
      ch.id, NULL, 'system_record',
      COALESCE(athlete_name, 'Атлет') || ' — новый личный рекорд: ' || record_label || '. Поздравим!',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopost_record ON public.athlete_records;
CREATE TRIGGER trg_autopost_record
  AFTER INSERT OR UPDATE ON public.athlete_records
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION public.autopost_record_to_achievements();

NOTIFY pgrst, 'reload schema';
