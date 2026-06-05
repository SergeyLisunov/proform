-- 089_parent_child_links_foundation
--
-- P2 tenant refactor — INCREMENT 4b-i: foundation for parent↔child (детский
-- спорт). This is the data layer only — no UI, no API. Follow-ups: 4b-ii
-- registration "I'm a parent, registering my child"; 4b-iii adult athlete
-- invites a parent; 4b-iv /parent/dashboard.
--
-- Child = a regular `role='athlete'` user with their own account (founder
-- decision). The parent↔child relationship is a separate edge table.
--
-- Establishes:
--   * parent_links table (parent_id, child_id, status, created_by)
--   * is_parent_of(_parent, _child) helper, SECURITY DEFINER STABLE
--   * RLS on parent_links itself (self-read; writes only via server route)
--   * add-only parent SELECT policies on the safe surfaces the founder
--     approved: calendar_events (schedule), athlete_passes (subs/abonements),
--     observation_diary (coach comments)
--
-- DELIBERATELY NOT touched here: public.workouts — it carries medical/personal
-- columns (HRV, recovery_score, activity_strain, risk_flag, trainer_comment).
-- Postgres RLS is row-level only; a parent SELECT policy would expose every
-- column. The "общий прогресс (без мед)" surface goes through a server route
-- in 4b-iv that returns only the safe columns.
--
-- Verified on prod (rolled-back txn): an active parent_link → parent sees
-- child's calendar_events row (1), parent sees 0 workouts (blocked).

-- ── 1. parent_links table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status     text        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'revoked', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid        REFERENCES public.users(id),
  CONSTRAINT parent_links_no_self_link CHECK (parent_id <> child_id),
  CONSTRAINT parent_links_unique_pair  UNIQUE (parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_links(parent_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_parent_links_child  ON public.parent_links(child_id)  WHERE status = 'active';

-- ── 2. is_parent_of helper ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_parent_of(_parent uuid, _child uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_links
    WHERE parent_id = _parent
      AND child_id  = _child
      AND status    = 'active'
  );
$$;

-- ── 3. RLS on parent_links itself ──────────────────────────────────────────
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY parent_links_self_select ON public.parent_links
  FOR SELECT TO public
  USING (
    parent_id = (SELECT public.get_my_user_id())
    OR child_id = (SELECT public.get_my_user_id())
    OR public.get_my_role() = 'admin'
  );

-- INSERT/UPDATE/DELETE are intentionally NOT granted to authenticated users:
-- writes happen only via server routes using the admin client (4b-ii / 4b-iii),
-- which enforce: parent registers child, OR athlete invites parent and accepts.

-- ── 4. Parent SELECT add-on policies on permitted surfaces ────────────────
CREATE POLICY calendar_events_parent_select ON public.calendar_events
  FOR SELECT TO public
  USING (public.is_parent_of((SELECT public.get_my_user_id()), owner_id));

CREATE POLICY athlete_passes_parent_select ON public.athlete_passes
  FOR SELECT TO public
  USING (public.is_parent_of((SELECT public.get_my_user_id()), athlete_id));

CREATE POLICY observation_diary_parent_select ON public.observation_diary
  FOR SELECT TO public
  USING (public.is_parent_of((SELECT public.get_my_user_id()), athlete_id));

NOTIFY pgrst, 'reload schema';
