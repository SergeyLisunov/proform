-- QA M1 (full) step 1/2 — can_notify(actor, target) relationship authorizer.
--
-- Background: notify()/notifyMany() (services/notifications.service.ts) run on
-- the RLS-bound browser/server-anon client as the logged-in user, across ~27
-- call sites. Migration 080 already requires internal action_urls, but the
-- INSERT policy still lets ANY authenticated user create a notification for ANY
-- user_id (spoofing). This function encodes the REAL relationships that
-- authorize a notifier→target pair so the INSERT policy (migration 082) can
-- require it — blocking notifications to users the actor has NO relationship
-- with, while preserving every legitimate cross-user notify.
--
-- DESIGN — the predicate set mirrors the EXACT tables each live RLS-bound notify
-- call site uses to resolve its target (verified against the call-site
-- inventory + each table's INSERT RLS), so no live notify silently breaks:
--   self                      — self-notifications
--   admin                     — admins notify anyone (broadcasts)
--   connections (pend/active) — THE relationship graph: coach_athlete,
--                               doctor_athlete, coach_doctor, org_coach,
--                               org_athlete, org_doctor, admin_doctor (all 7
--                               types). Covers injuries(doctor), re-invite
--                               (pending), org broadcast (org_*), and the
--                               workout-comment author↔owner gate.
--   athlete_passes            — coach↔athlete marketplace passes
--   coach_sessions            — coach↔athlete sessions (RLS gates on owner only,
--                               NOT a connection, so the session row itself is
--                               the authorizing relationship)
--   coach_reviews             — athlete↔coach reviews
--   observation_diary         — coach↔athlete diary shares (owner-gated)
--   medical_diary             — doctor↔athlete diary shares (owner-gated)
--   org_members               — same active organization
--   org_group_sessions+parts  — organization↔session participants
--   recommendations           — doctor/coach/athlete/referred-specialist/org
--   doctor_inquiries          — doctor/coach/athlete triad
--
-- NOTE — `trainer_athletes` is intentionally NOT referenced: it is a dead table
-- (never written by any code/migration/trigger; always empty; its status CHECK
-- doesn't even permit the 'accepted' value the app queries). Notify paths that
-- resolve recipients through it produce zero rows today, so omitting it breaks
-- nothing. (Tracked separately as a pre-existing latent bug.)
--
-- SECURITY DEFINER so it reads relationship tables regardless of the caller's
-- own RLS; search_path locked per the project hardening pattern (029/042).
-- STABLE — pure reads.

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
    )
$$;

-- Lock down execution: only authenticated (RLS policy evaluation needs it) and
-- service_role. Supabase auto-grants EXECUTE to anon on new public functions, so
-- revoke it explicitly — anon never inserts notifications, and without this an
-- anon caller could probe /rest/v1/rpc/can_notify to learn whether two users
-- are related (relationship-existence disclosure).
REVOKE ALL ON FUNCTION public.can_notify(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_notify(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
