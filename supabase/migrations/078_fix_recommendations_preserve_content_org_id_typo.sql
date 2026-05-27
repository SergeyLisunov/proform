-- HOTFIX W18 Day 99 — migration 076 trigger referenced non-existent NEW.org_id
-- (actual column is organization_id). Bug surfaced during W18 verification matrix —
-- athlete/coach ack updates failed with "record new has no field org_id",
-- breaking entire ack workflow. Fix: rename к organization_id.
--
-- Verification (Day 99):
--   - athlete tries PATCH title/body + sets ack_at → title/body preserved, ack recorded ✅
--   - doctor updates own → all fields mutable ✅

BEGIN;

CREATE OR REPLACE FUNCTION public.trg_recommendations_preserve_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid;
BEGIN
  caller := public.get_my_user_id();
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF caller IS DISTINCT FROM OLD.doctor_id THEN
    NEW.title             := OLD.title;
    NEW.body              := OLD.body;
    NEW.category          := OLD.category;
    NEW.severity          := OLD.severity;
    NEW.visibility_level  := OLD.visibility_level;
    NEW.valid_from        := OLD.valid_from;
    NEW.valid_until       := OLD.valid_until;
    NEW.doctor_id         := OLD.doctor_id;
    NEW.athlete_id        := OLD.athlete_id;
    NEW.organization_id   := OLD.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_recommendations_preserve_content() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
