-- Personal records: athlete-owned logbook of PBs across exercises.
create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.users(id) on delete cascade,
  category text not null check (category in ('run','bike','swim','strength','other')),
  exercise text not null,
  metric text not null check (metric in ('time','distance','weight','reps','duration','power')),
  value numeric not null,
  unit text not null,
  achieved_at date not null,
  notes text,
  workout_id uuid references public.workouts(id) on delete set null,
  -- lower-is-better for time-based records, higher-is-better otherwise
  lower_is_better boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_records_athlete_idx on public.personal_records(athlete_id, achieved_at desc);
create index if not exists personal_records_exercise_idx on public.personal_records(athlete_id, exercise, achieved_at desc);

alter table public.personal_records enable row level security;

drop policy if exists personal_records_select       on public.personal_records;
drop policy if exists personal_records_owner_insert on public.personal_records;
drop policy if exists personal_records_owner_modify on public.personal_records;
drop policy if exists personal_records_owner_delete on public.personal_records;

create policy personal_records_select on public.personal_records for select
  using (athlete_id = get_my_user_id());
create policy personal_records_owner_insert on public.personal_records for insert
  with check (athlete_id = get_my_user_id());
create policy personal_records_owner_modify on public.personal_records for update
  using (athlete_id = get_my_user_id()) with check (athlete_id = get_my_user_id());
create policy personal_records_owner_delete on public.personal_records for delete
  using (athlete_id = get_my_user_id());

notify pgrst, 'reload schema';
