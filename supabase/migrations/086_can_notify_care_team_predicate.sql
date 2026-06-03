-- M1 follow-up — add a care-team predicate to can_notify().
--
-- Migration 085 revived `trainer_athletes`, which in turn revived two notify
-- paths that fan out from a doctor to an athlete's coaches:
--   • medical-diary toggleShareWithCoach (services/medical-diary.service.ts)
--   • recommendations coach-fanout when coach_id is null
-- Both do notify(doctor → coach). can_notify() had no predicate authorizing a
-- doctor↔coach pair, so M1's RLS silently blocked these (the shared data is
-- still readable by the coach via RLS — only the push notification was dropped).
--
-- This adds a "care-team" predicate: actor and target may notify each other when
-- they are both active care providers (coach via coach_athlete, doctor via
-- doctor_athlete) of a COMMON athlete. Based on `connections` (source of truth).
--
-- Guard: the shared id must have role='athlete'. Without it, two patients of the
-- same doctor (or two athletes of the same coach) would resolve each other as a
-- "shared" party and could notify each other — a privacy leak. Requiring the
-- shared party to be an athlete means only genuine provider↔provider pairs over
-- a shared athlete match (the served party is never the actor/target themselves).
--
-- Only the function body changes (one predicate appended); grants unchanged.

CREATE OR REPLACE FUNCTION public.can_notify(actor uuid, target uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT
    actor IS NOT NULL AND target IS NOT NULL AND (
      actor = target
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = actor AND u.role = 'admin')

      -- THE relationship graph: any pending/active connection, either direction
      OR EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status IN ('pending', 'active')
          AND ((c.initiator_id = actor AND c.recipient_id = target)
            OR (c.initiator_id = target AND c.recipient_id = actor)))

      -- coach ↔ athlete: marketplace pass (either direction)
      OR EXISTS (
        SELECT 1 FROM public.athlete_passes ap
        WHERE (ap.coach_id = actor AND ap.athlete_id = target)
           OR (ap.coach_id = target AND ap.athlete_id = actor))

      -- coach ↔ athlete: scheduled session (owner-gated table → row is the link)
      OR EXISTS (
        SELECT 1 FROM public.coach_sessions cs
        WHERE (cs.coach_id = actor AND cs.athlete_id = target)
           OR (cs.coach_id = target AND cs.athlete_id = actor))

      -- athlete ↔ coach: review (either direction)
      OR EXISTS (
        SELECT 1 FROM public.coach_reviews r
        WHERE (r.athlete_id = actor AND r.coach_id = target)
           OR (r.coach_id = actor AND r.athlete_id = target))

      -- coach ↔ athlete: observation diary (owner-gated → row is the link)
      OR EXISTS (
        SELECT 1 FROM public.observation_diary od
        WHERE (od.coach_id = actor AND od.athlete_id = target)
           OR (od.coach_id = target AND od.athlete_id = actor))

      -- doctor ↔ athlete: medical diary (owner-gated → row is the link)
      OR EXISTS (
        SELECT 1 FROM public.medical_diary md
        WHERE (md.doctor_id = actor AND md.athlete_id = target)
           OR (md.doctor_id = target AND md.athlete_id = actor))

      -- same active organization membership
      OR EXISTS (
        SELECT 1 FROM public.org_members oa
        JOIN public.org_members ob ON ob.org_id = oa.org_id
        WHERE oa.user_id = actor AND ob.user_id = target
          AND oa.status = 'active' AND ob.status = 'active')

      -- organization ↔ its session participants (either direction)
      OR EXISTS (
        SELECT 1 FROM public.org_group_sessions s
        JOIN public.org_session_participants p ON p.session_id = s.id
        WHERE (s.organization_id = actor AND p.user_id = target)
           OR (s.organization_id = target AND p.user_id = actor))

      -- recommendations participants (doctor / coach / athlete / referred / org)
      OR EXISTS (
        SELECT 1 FROM public.recommendations rc
        WHERE actor  IN (rc.doctor_id, rc.coach_id, rc.athlete_id, rc.referred_to_user_id, rc.organization_id)
          AND target IN (rc.doctor_id, rc.coach_id, rc.athlete_id, rc.referred_to_user_id, rc.organization_id))

      -- doctor_inquiries triad (doctor / coach / athlete)
      OR EXISTS (
        SELECT 1 FROM public.doctor_inquiries di
        WHERE actor  IN (di.doctor_id, di.coach_id, di.athlete_id)
          AND target IN (di.doctor_id, di.coach_id, di.athlete_id))

      -- care-team: actor and target are both active care providers (coach via
      -- coach_athlete, doctor via doctor_athlete) of a COMMON athlete. The shared
      -- party must be an athlete (role guard) so two patients of one doctor — or
      -- two athletes of one coach — do NOT resolve each other as care-team.
      OR EXISTS (
        SELECT 1
        FROM (
          SELECT CASE WHEN c.initiator_id = actor THEN c.recipient_id ELSE c.initiator_id END AS aid
          FROM public.connections c
          WHERE c.status = 'active'
            AND c.connection_type IN ('coach_athlete', 'doctor_athlete')
            AND (c.initiator_id = actor OR c.recipient_id = actor)
        ) sa
        JOIN public.users ua ON ua.id = sa.aid AND ua.role = 'athlete'
        JOIN (
          SELECT CASE WHEN c.initiator_id = target THEN c.recipient_id ELSE c.initiator_id END AS aid
          FROM public.connections c
          WHERE c.status = 'active'
            AND c.connection_type IN ('coach_athlete', 'doctor_athlete')
            AND (c.initiator_id = target OR c.recipient_id = target)
        ) st ON st.aid = sa.aid)
    )
$$;

NOTIFY pgrst, 'reload schema';
