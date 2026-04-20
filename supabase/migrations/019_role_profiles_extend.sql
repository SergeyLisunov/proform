-- Extend role profiles with professional/practice details.

alter table public.coaches
  add column if not exists coaching_philosophy text,
  add column if not exists session_formats text[] default '{}',
  add column if not exists achievements jsonb default '[]'::jsonb,
  add column if not exists past_workplaces jsonb default '[]'::jsonb,
  add column if not exists whatsapp_url text,
  add column if not exists email_public text;

alter table public.doctors
  add column if not exists license_expires_at date,
  add column if not exists services text[] default '{}',
  add column if not exists consultation_formats text[] default '{}',
  add column if not exists hospital_affiliations text[] default '{}',
  add column if not exists scientific_publications jsonb default '[]'::jsonb,
  add column if not exists whatsapp_url text,
  add column if not exists main_focus text,
  add column if not exists emergency_contact boolean default false;

alter table public.organizations
  add column if not exists org_type text,
  add column if not exists training_base text,
  add column if not exists license_info text,
  add column if not exists coaches_count integer,
  add column if not exists membership_types jsonb default '[]'::jsonb,
  add column if not exists services text[] default '{}';

alter table public.admins
  add column if not exists responsibilities text[] default '{}',
  add column if not exists work_email text,
  add column if not exists on_call boolean default false,
  add column if not exists schedule text;

notify pgrst, 'reload schema';
