-- Role-specific profile tables: coaches, doctors, admins.
-- Organizations table already exists; add missing columns.

create table if not exists public.coaches (
  id uuid primary key references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  birth_date date,
  gender text,
  phone text,
  city text,
  country text,
  bio text,
  avatar_url text,
  specialization text,
  experience_years smallint,
  education text,
  certifications jsonb default '[]'::jsonb,
  sports text[] default '{}',
  languages text[] default '{}',
  workplace text,
  hourly_rate numeric,
  currency text default 'RUB',
  telegram_url text,
  instagram_url text,
  website_url text,
  youtube_url text,
  athletes_count smallint,
  accepts_new_athletes boolean default true,
  profile_public boolean default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  birth_date date,
  gender text,
  phone text,
  city text,
  country text,
  bio text,
  avatar_url text,
  medical_specialization text,
  license_number text,
  license_authority text,
  education text,
  degree text,
  experience_years smallint,
  workplace text,
  certifications jsonb default '[]'::jsonb,
  languages text[] default '{}',
  consultation_fee numeric,
  currency text default 'RUB',
  telegram_url text,
  website_url text,
  accepts_new_patients boolean default true,
  profile_public boolean default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.admins (
  id uuid primary key references public.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  city text,
  country text,
  bio text,
  avatar_url text,
  department text,
  access_level text,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists founded_year smallint,
  add column if not exists contact_person text,
  add column if not exists instagram_url text,
  add column if not exists telegram_url text,
  add column if not exists youtube_url text,
  add column if not exists languages text[] default '{}',
  add column if not exists members_count integer,
  add column if not exists profile_public boolean default true;

alter table public.coaches  enable row level security;
alter table public.doctors  enable row level security;
alter table public.admins   enable row level security;

drop policy if exists coaches_select        on public.coaches;
drop policy if exists coaches_owner_modify  on public.coaches;
drop policy if exists coaches_owner_insert  on public.coaches;
drop policy if exists coaches_owner_delete  on public.coaches;

create policy coaches_select on public.coaches for select
  using (profile_public = true or id = get_my_user_id());
create policy coaches_owner_insert on public.coaches for insert
  with check (id = get_my_user_id());
create policy coaches_owner_modify on public.coaches for update
  using (id = get_my_user_id()) with check (id = get_my_user_id());
create policy coaches_owner_delete on public.coaches for delete
  using (id = get_my_user_id());

drop policy if exists doctors_select       on public.doctors;
drop policy if exists doctors_owner_modify on public.doctors;
drop policy if exists doctors_owner_insert on public.doctors;
drop policy if exists doctors_owner_delete on public.doctors;

create policy doctors_select on public.doctors for select
  using (profile_public = true or id = get_my_user_id());
create policy doctors_owner_insert on public.doctors for insert
  with check (id = get_my_user_id());
create policy doctors_owner_modify on public.doctors for update
  using (id = get_my_user_id()) with check (id = get_my_user_id());
create policy doctors_owner_delete on public.doctors for delete
  using (id = get_my_user_id());

drop policy if exists admins_select       on public.admins;
drop policy if exists admins_owner_modify on public.admins;
drop policy if exists admins_owner_insert on public.admins;

create policy admins_select on public.admins for select
  using (id = get_my_user_id());
create policy admins_owner_insert on public.admins for insert
  with check (id = get_my_user_id());
create policy admins_owner_modify on public.admins for update
  using (id = get_my_user_id()) with check (id = get_my_user_id());

notify pgrst, 'reload schema';
