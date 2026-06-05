-- 086_can_notify_care_team_predicate
--
-- RECOVERED FROM PROD (2026-06-05). This migration was applied to production
-- (supabase_migrations version 20260603081821) but its .sql file was never
-- committed to the repo — recovered here via pg_get_functiondef() so the
-- numbered migration chain (…085 → 086 → 087) is contiguous and the can_notify
-- definition in version control matches prod.
--
-- Adds the care-team predicate to can_notify(): two active care providers
-- (coach via coach_athlete, doctor via doctor_athlete) of a COMMON athlete may
-- notify each other. Guard: the shared party must have role='athlete', so two
-- patients of one doctor (or two athletes of one coach) do NOT resolve each
-- other as care-team (privacy).

CREATE OR REPLACE FUNCTION public.can_notify(actor uuid, target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    actor IS NOT NULL AND target IS NOT NULL AND (
      actor = target
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = actor AND u.role = 'admin')
      OR EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status IN ('pending', 'active')
          AND ((c.initiator_id = actor AND c.recipient_id = target)
            OR (c.initiator_id = target AND c.recipient_id = actor)))
      OR EXISTS (
        SELECT 1 FROM public.athlete_passes ap
        WHERE (ap.coach_id = actor AND ap.athlete_id = target)
           OR (ap.coach_id = target AND ap.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.coach_sessions cs
        WHERE (cs.coach_id = actor AND cs.athlete_id = target)
           OR (cs.coach_id = target AND cs.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.coach_reviews r
        WHERE (r.athlete_id = actor AND r.coach_id = target)
           OR (r.coach_id = actor AND r.athlete_id = target))
      OR EXISTS (
        SELECT 1 FROM public.observation_diary od
        WHERE (od.coach_id = actor AND od.athlete_id = target)
           OR (od.coach_id = target AND od.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.medical_diary md
        WHERE (md.doctor_id = actor AND md.athlete_id = target)
           OR (md.doctor_id = target AND md.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.org_members oa
        JOIN public.org_members ob ON ob.org_id = oa.org_id
        WHERE oa.user_id = actor AND ob.user_id = target
          AND oa.status = 'active' AND ob.status = 'active')
      OR EXISTS (
        SELECT 1 FROM public.org_group_sessions s
        JOIN public.org_session_participants p ON p.session_id = s.id
        WHERE (s.organization_id = actor AND p.user_id = target)
           OR (s.organization_id = target AND p.user_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.recommendations rc
        WHERE actor  IN (rc.doctor_id, rc.coach_id, rc.athlete_id, rc.referred_to_user_id, rc.organization_id)
          AND target IN (rc.doctor_id, rc.coach_id, rc.athlete_id, rc.referred_to_user_id, rc.organization_id))
      OR EXISTS (
        SELECT 1 FROM public.doctor_inquiries di
        WHERE actor  IN (di.doctor_id, di.coach_id, di.athlete_id)
          AND target IN (di.doctor_id, di.coach_id, di.athlete_id))
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
$function$;

NOTIFY pgrst, 'reload schema';
