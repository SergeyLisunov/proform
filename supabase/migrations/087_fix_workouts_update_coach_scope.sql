-- 087_fix_workouts_update_coach_scope
--
-- P0 SECURITY FIX (from the strategy-vs-codebase audit).
--
-- The `workouts_update` RLS policy granted UPDATE to ANY user whose role is
-- 'coach' (blanket `get_my_role() = ANY('admin','coach')`) with NO `with_check`.
-- Effect: any coach could edit ANY athlete's workouts — including athletes they
-- are not connected to — and could even reassign `athlete_id` to move a row out
-- of scope. A horizontal-privilege (IDOR-style) leak.
--
-- Fix: scope the coach branch to the coach's own connected athletes
-- (`trainer_athletes`, status='accepted' — the same scoping already used by
-- `workouts_select` and `workouts_coach_prescribe`), and add a matching
-- `WITH CHECK` so a row cannot be moved out of the caller's scope. The
-- athlete-self and admin branches are preserved; coaches keep a separate path
-- for workouts they prescribed via `workouts_coach_update_prescribed`.
--
-- Verified on prod (rolled-back txn): an unconnected coach UPDATE affects 0 rows
-- (blocked); after inserting an accepted trainer_athletes link it affects 1 row
-- (allowed). Athlete-self update unchanged.

DROP POLICY IF EXISTS workouts_update ON public.workouts;

CREATE POLICY workouts_update ON public.workouts
  FOR UPDATE
  USING (
    athlete_id = (SELECT public.get_my_user_id())
    OR public.get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = (SELECT public.get_my_user_id())
        AND ta.athlete_id = public.workouts.athlete_id
        AND ta.status = 'accepted'
    )
  )
  WITH CHECK (
    athlete_id = (SELECT public.get_my_user_id())
    OR public.get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.trainer_athletes ta
      WHERE ta.trainer_id = (SELECT public.get_my_user_id())
        AND ta.athlete_id = public.workouts.athlete_id
        AND ta.status = 'accepted'
    )
  );

NOTIFY pgrst, 'reload schema';
