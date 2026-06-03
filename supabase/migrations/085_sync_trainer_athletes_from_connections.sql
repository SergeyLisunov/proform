-- Fix cluster #1-3 — revive the dead `trainer_athletes` table.
--
-- `trainer_athletes` is the backbone of the coach↔athlete access model: 12 RLS
-- policies (workouts, calendar_events, daily_metrics, injuries, medical_diary,
-- privacy_settings, recommendations ×2, training_marks, wellness_checkins,
-- athlete_goals, workouts_coach_prescribe) and ~20 code read-sites gate coach
-- access on `EXISTS (… trainer_athletes … status='accepted')`. But the table is
-- NEVER written by any code/migration/trigger — it is always empty — so coaches
-- can see NONE of their athletes' data and cannot prescribe workouts or report
-- injuries. The real coach↔athlete relationship lives in
-- `connections(connection_type='coach_athlete', status='active')`; the accept
-- handler (app/api/connections/[id]/route.ts) creates a chat but never wired up
-- trainer_athletes.
--
-- Approach A (chosen): make `trainer_athletes` a trigger-maintained projection of
-- `connections`. The 12 policies and 20 read-sites already expect
-- status='accepted' — so by populating the table with that status, they all
-- start working with ZERO changes to policies or app code, preserving the exact
-- current RLS model (trainer_athletes RLS: participant/admin reads, admin
-- writes; the trigger writes as SECURITY DEFINER, RLS-exempt).
--
-- (Approach B — rewrite all 12 policies + 20 files onto connections and drop the
-- table — is the single-source-of-truth cleanup, deferred as higher-risk.)

BEGIN;

-- 1) Allow the 'accepted' status the whole codebase already filters on.
ALTER TABLE public.trainer_athletes DROP CONSTRAINT IF EXISTS trainer_athletes_status_check;
ALTER TABLE public.trainer_athletes
  ADD CONSTRAINT trainer_athletes_status_check
  CHECK (status = ANY (ARRAY['accepted'::text, 'active'::text, 'inactive'::text, 'pending'::text]));

-- 2) Sync function — keep trainer_athletes in lock-step with active coach_athlete
--    connections. In a coach_athlete connection one party is the coach and the
--    other the athlete; resolve the coach by role.
CREATE OR REPLACE FUNCTION public.sync_trainer_athletes_from_connection()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_coach   uuid;
  v_athlete uuid;
  v_init    uuid;
  v_recip   uuid;
  v_type    text;
  v_active  boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_init := OLD.initiator_id; v_recip := OLD.recipient_id; v_type := OLD.connection_type; v_active := false;
  ELSE
    v_init := NEW.initiator_id; v_recip := NEW.recipient_id; v_type := NEW.connection_type;
    v_active := (NEW.status = 'active');
  END IF;

  IF v_type <> 'coach_athlete' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Identify the coach side by role; the other party is the athlete.
  SELECT u.id INTO v_coach
  FROM public.users u
  WHERE u.id IN (v_init, v_recip) AND u.role = 'coach'
  LIMIT 1;

  IF v_coach IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_athlete := CASE WHEN v_coach = v_init THEN v_recip ELSE v_init END;

  IF v_active THEN
    INSERT INTO public.trainer_athletes (trainer_id, athlete_id, status, assigned_by)
    VALUES (v_coach, v_athlete, 'accepted', v_init)
    ON CONFLICT (trainer_id, athlete_id) DO UPDATE
      SET status = 'accepted', updated_at = now();
  ELSE
    -- pending / declined / cancelled / terminated / deleted → drop the link
    DELETE FROM public.trainer_athletes WHERE trainer_id = v_coach AND athlete_id = v_athlete;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_trainer_athletes_from_connection() FROM PUBLIC, anon, authenticated;

-- 3) Single trigger for the whole connection lifecycle (idempotent — re-running
--    on unrelated column updates just re-asserts the current state).
DROP TRIGGER IF EXISTS trg_sync_trainer_athletes ON public.connections;
CREATE TRIGGER trg_sync_trainer_athletes
  AFTER INSERT OR UPDATE OR DELETE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.sync_trainer_athletes_from_connection();

-- 4) Backfill from existing active coach_athlete connections (idempotent).
WITH ca AS (
  SELECT c.initiator_id, c.recipient_id,
    (SELECT u.id FROM public.users u
       WHERE u.id IN (c.initiator_id, c.recipient_id) AND u.role = 'coach' LIMIT 1) AS coach_id
  FROM public.connections c
  WHERE c.connection_type = 'coach_athlete' AND c.status = 'active'
)
INSERT INTO public.trainer_athletes (trainer_id, athlete_id, status, assigned_by)
SELECT coach_id,
       CASE WHEN coach_id = initiator_id THEN recipient_id ELSE initiator_id END,
       'accepted', initiator_id
FROM ca
WHERE coach_id IS NOT NULL
ON CONFLICT (trainer_id, athlete_id) DO UPDATE SET status = 'accepted';

COMMIT;

NOTIFY pgrst, 'reload schema';
