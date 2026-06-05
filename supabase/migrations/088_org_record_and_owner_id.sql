-- 088_org_record_and_owner_id
--
-- Tenant refactor — INCREMENT 1 (model chosen: 1 owner = 1 org; keep
-- organizations.id == owner user's id for now).
--
-- Problem (from the strategy audit): the "organization" was virtual — the org
-- user (role='organization') WAS the org, the `organizations` table was empty
-- (0 rows), and there was no `owner_id`. So there was no real tenant record to
-- attach billing, co-owners, or an explicit owner to.
--
-- This makes the organization a REAL row:
--   * add organizations.owner_id (FK -> users) + index
--   * a SECURITY DEFINER projection trigger guarantees every org-role user has
--     an organizations row + an `org_owner` org_members row, regardless of which
--     path creates/promotes the org user
--   * one-time backfill for existing org users (today: 1 — "ProForm FC")
--
-- organizations.id stays == the owner's user id (compatibility with all current
-- code/RLS that resolves org_id from the org user's id). A future increment can
-- decouple id if multi-org-per-user is needed. org_slug is derived from the id
-- (guaranteed unique against organizations_org_slug_key); the org can rename it
-- later in settings.
--
-- Verified on prod: backfill created ProForm FC's org row (owner_id=id) + an
-- org_owner membership; rolled-back test confirmed the trigger projects a new
-- org record + owner membership when a user becomes role='organization'.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);

CREATE OR REPLACE FUNCTION public.ensure_org_record_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.role = 'organization' THEN
    INSERT INTO public.organizations (id, owner_id, org_name, org_slug)
    VALUES (
      NEW.id,
      NEW.id,
      COALESCE(NULLIF(TRIM(NEW.name), ''), 'Организация'),
      'org-' || replace(NEW.id::text, '-', '')
    )
    ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id;

    INSERT INTO public.org_members (org_id, user_id, member_role, status, joined_at)
    VALUES (NEW.id, NEW.id, 'org_owner', 'active', now())
    ON CONFLICT (org_id, user_id) DO UPDATE SET member_role = 'org_owner', status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_org_record ON public.users;
CREATE TRIGGER trg_ensure_org_record
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.ensure_org_record_for_user();

-- Backfill existing org-role users.
INSERT INTO public.organizations (id, owner_id, org_name, org_slug)
SELECT u.id, u.id, COALESCE(NULLIF(TRIM(u.name), ''), 'Организация'), 'org-' || replace(u.id::text, '-', '')
FROM public.users u
WHERE u.role = 'organization'
ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id;

INSERT INTO public.org_members (org_id, user_id, member_role, status, joined_at)
SELECT u.id, u.id, 'org_owner', 'active', now()
FROM public.users u
WHERE u.role = 'organization'
ON CONFLICT (org_id, user_id) DO UPDATE SET member_role = 'org_owner', status = 'active';

UPDATE public.organizations SET owner_id = id WHERE owner_id IS NULL;

NOTIFY pgrst, 'reload schema';
