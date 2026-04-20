-- ── 011_workout_shares: public read-only share links for workouts ────────────

create table if not exists workout_shares (
  token       text        primary key,
  workout_id  uuid        not null references workouts(id) on delete cascade,
  created_by  uuid        not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  revoked_at  timestamptz
);

alter table workout_shares enable row level security;

drop policy if exists "workout_shares_select" on workout_shares;
create policy "workout_shares_select" on workout_shares
  for select using (
    created_by = get_my_user_id()
    or exists (
      select 1 from workouts w
      where w.id = workout_shares.workout_id and w.athlete_id = get_my_user_id()
    )
  );

drop policy if exists "workout_shares_insert" on workout_shares;
create policy "workout_shares_insert" on workout_shares
  for insert with check (
    created_by = get_my_user_id()
    and exists (
      select 1 from workouts w
      where w.id = workout_shares.workout_id and w.athlete_id = get_my_user_id()
    )
  );

drop policy if exists "workout_shares_update" on workout_shares;
create policy "workout_shares_update" on workout_shares
  for update using (
    created_by = get_my_user_id()
    or exists (
      select 1 from workouts w
      where w.id = workout_shares.workout_id and w.athlete_id = get_my_user_id()
    )
  )
  with check (
    created_by = get_my_user_id()
    or exists (
      select 1 from workouts w
      where w.id = workout_shares.workout_id and w.athlete_id = get_my_user_id()
    )
  );

drop policy if exists "workout_shares_delete" on workout_shares;
create policy "workout_shares_delete" on workout_shares
  for delete using (
    created_by = get_my_user_id()
    or exists (
      select 1 from workouts w
      where w.id = workout_shares.workout_id and w.athlete_id = get_my_user_id()
    )
  );

create index if not exists workout_shares_workout_idx on workout_shares (workout_id);
create index if not exists workout_shares_creator_idx on workout_shares (created_by);

-- Public lookup via token (no auth required) — bypasses RLS via SECURITY DEFINER
create or replace function public.get_shared_workout(p_token text)
returns table (
  workout_id uuid,
  athlete_id uuid,
  athlete_name text,
  athlete_avatar text,
  athlete_sport text,
  event_date date,
  name text,
  description text,
  activity_type text,
  activity_duration_min integer,
  activity_strain numeric,
  avg_heart_rate numeric,
  max_heart_rate numeric,
  recovery_score numeric,
  hrv numeric,
  mood integer,
  expires_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    w.id,
    w.athlete_id,
    coalesce(nullif(trim(u.name), ''), u.nickname::text, 'Атлет'),
    u.avatar_url,
    u.sport::text,
    w.event_date,
    w.name,
    w.description,
    w.activity_type,
    w.activity_duration_min,
    w.activity_strain,
    w.avg_heart_rate,
    w.max_heart_rate,
    w.recovery_score,
    w.hrv,
    w.mood,
    s.expires_at
  from workout_shares s
    join workouts w on w.id = s.workout_id
    join users u on u.id = w.athlete_id
  where s.token = p_token
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_shared_workout(text) from public;
grant execute on function public.get_shared_workout(text) to anon, authenticated;

notify pgrst, 'reload schema';
