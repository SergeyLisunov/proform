-- 090_email_invites_allow_parent_link
--
-- P2 tenant refactor — increment 4b-iii: extend email_invites.connection_type
-- CHECK to allow the new 'parent_link' value (which the 4b-iii claim-route
-- branch needs in order to create the email_invites row in the first place).
--
-- parent_link is special among email_invites types: the claim path does NOT
-- create a `connections` row (parent isn't a global role); it creates a
-- `parent_links` row (added in migration 089) so the claimer becomes the
-- inviter (athlete)'s parent/guardian.

ALTER TABLE public.email_invites
  DROP CONSTRAINT IF EXISTS email_invites_connection_type_check;

ALTER TABLE public.email_invites
  ADD CONSTRAINT email_invites_connection_type_check
  CHECK (connection_type IN (
    'coach_athlete', 'org_coach', 'org_athlete', 'doctor_athlete',
    'coach_doctor',  'org_doctor', 'admin_doctor',
    'parent_link'
  ));

NOTIFY pgrst, 'reload schema';
