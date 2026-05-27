-- W18 Day 95 RLS hardening migration. Closes 3 audit findings от Day 93:
--
--   C5 (CRITICAL) — Athletes can modify recommendation body/title via direct
--                   REST API. Current RLS UPDATE policy only checks owner
--                   (athlete_id = me), not which columns are mutated. App layer
--                   sends только acknowledged_by_athlete_at, но без trigger
--                   anyone can PATCH any field. Same gap для coach ack policy.
--                   Fix: BEFORE UPDATE trigger preserves OLD content fields
--                   when updater != original doctor.
--
--   C6 (CRITICAL) — Doctor open queue (doctor_id IS NULL) policies allow ANY
--                   user с role='doctor' к read/claim inquiries regardless
--                   of org membership. Cross-org medical inquiry leak.
--                   Fix: scope open-queue к same-org check via org_members.
--
--   N3 (NICE-TO-HAVE) — trg_doctor_inquiries_set_meta missing search_path
--                       + REVOKE FROM anon. Hardening per W13 Day 64 pattern.
--
-- 0-migration streak (7 sprints W11-W17) intentionally broken — security
-- fixes cannot wait further. Standalone migration, no schema additions/
-- removals, only policy + trigger changes.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- C5 — Recommendations content immutability trigger
-- ════════════════════════════════════════════════════════════════════

-- Preserves doctor-only fields (title, body, category, severity, etc)
-- when updater is not the original doctor. Acknowledgement timestamps
-- + status are STILL mutable so athlete/coach ack flows continue к work.
--
-- SECURITY DEFINER required to call get_my_user_id() inside trigger.
-- search_path locked per W13 pattern. Revoked from anon/authenticated.
CREATE OR REPLACE FUNCTION public.trg_recommendations_preserve_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid;
BEGIN
  -- get_my_user_id() returns NULL if no auth context (e.g. service-role
  -- admin client). In that case allow всё — admin operations bypass.
  caller := public.get_my_user_id();
  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  -- Original doctor может modify anything. Athletes/coaches can only
  -- update acknowledgement fields + status (DB trigger derives status
  -- from ack timestamps anyway, so even status mutation by them is OK).
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

DROP TRIGGER IF EXISTS trg_recommendations_preserve_content ON public.recommendations;

CREATE TRIGGER trg_recommendations_preserve_content
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recommendations_preserve_content();

REVOKE ALL ON FUNCTION public.trg_recommendations_preserve_content() FROM PUBLIC, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- C6 — Doctor inquiries cross-org leak fix
-- ════════════════════════════════════════════════════════════════════

-- Original policies allowed (doctor_id IS NULL) AND user.role='doctor'
-- — ANY doctor от ANY organization could see + claim. Fix scopes к
-- same-org check: doctor должен be member of an org что also has the
-- athlete как member.
--
-- Active connections (trainer_athletes) NOT включены — doctors don't
-- typically have trainer_athletes links. Org membership is the canonical
-- scoping mechanism.

DROP POLICY IF EXISTS doctor_inquiries_doctor_read ON public.doctor_inquiries;

CREATE POLICY doctor_inquiries_doctor_read
ON public.doctor_inquiries FOR SELECT
USING (
  -- Direct assignment: doctor is claimed responder
  doctor_id = (SELECT public.get_my_user_id())
  -- OR open queue + same-org scoping
  OR (
    doctor_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = (SELECT public.get_my_user_id())
        AND u.role = 'doctor'
    )
    AND EXISTS (
      SELECT 1
      FROM public.org_members om_doctor
      JOIN public.org_members om_athlete
        ON om_doctor.org_id = om_athlete.org_id
      WHERE om_doctor.user_id = (SELECT public.get_my_user_id())
        AND om_athlete.user_id = doctor_inquiries.athlete_id
    )
  )
);

DROP POLICY IF EXISTS doctor_inquiries_doctor_update ON public.doctor_inquiries;

CREATE POLICY doctor_inquiries_doctor_update
ON public.doctor_inquiries FOR UPDATE
USING (
  (
    doctor_id = (SELECT public.get_my_user_id())
    AND status IN ('pending', 'answered')
  )
  OR (
    doctor_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = (SELECT public.get_my_user_id())
        AND u.role = 'doctor'
    )
    AND EXISTS (
      SELECT 1
      FROM public.org_members om_doctor
      JOIN public.org_members om_athlete
        ON om_doctor.org_id = om_athlete.org_id
      WHERE om_doctor.user_id = (SELECT public.get_my_user_id())
        AND om_athlete.user_id = doctor_inquiries.athlete_id
    )
  )
)
WITH CHECK (
  doctor_id = (SELECT public.get_my_user_id()) OR doctor_id IS NULL
);

-- ════════════════════════════════════════════════════════════════════
-- N3 — trg_doctor_inquiries_set_meta search_path + revoke
-- ════════════════════════════════════════════════════════════════════

-- W13 Day 64 established pattern: ALL functions get explicit search_path
-- + REVOKE FROM anon. Migration 064 missed this для trigger function.
-- Catching up now.

ALTER FUNCTION public.trg_doctor_inquiries_set_meta() SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.trg_doctor_inquiries_set_meta() FROM PUBLIC, anon;

-- ════════════════════════════════════════════════════════════════════

COMMIT;

NOTIFY pgrst, 'reload schema';
