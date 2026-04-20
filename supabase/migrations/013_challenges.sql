-- ── 013_challenges: team/org challenges with leaderboard ─────────────────────

create table if not exists challenges (
  id            uuid        primary key default gen_random_uuid(),
  owner_id      uuid        not null references users(id) on delete cascade,
  org_id        uuid        references organizations(id) on delete set null,
  title         text        not null check (length(title) between 1 and 160),
  description   text,
  metric        text        not null check (metric in ('duration_min','strain','workouts_count')),
  activity_type text,
  starts_at     date        not null,
  ends_at       date        not null check (ends_at >= starts_at),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists challenges_owner_idx  on challenges (owner_id);
create index if not exists challenges_org_idx    on challenges (org_id);
create index if not exists challenges_window_idx on challenges (starts_at, ends_at);

alter table challenges enable row level security;

drop policy if exists "challenges_select" on challenges;
create policy "challenges_select" on challenges
  for select using (auth.uid() is not null);

drop policy if exists "challenges_insert" on challenges;
create policy "challenges_insert" on challenges
  for insert with check (
    owner_id = get_my_user_id()
    and exists (
      select 1 from users u
      where u.id = get_my_user_id()
        and u.role in ('coach','organization','admin')
    )
  );

drop policy if exists "challenges_update" on challenges;
create policy "challenges_update" on challenges
  for update using (owner_id = get_my_user_id())
  with check (owner_id = get_my_user_id());

drop policy if exists "challenges_delete" on challenges;
create policy "challenges_delete" on challenges
  for delete using (owner_id = get_my_user_id());

create or replace function public.challenges_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists challenges_updated_at on challenges;
create trigger challenges_updated_at before update on challenges
  for each row execute function public.challenges_touch_updated_at();

create table if not exists challenge_participants (
  challenge_id uuid not null references challenges(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create index if not exists cp_user_idx on challenge_participants (user_id);

alter table challenge_participants enable row level security;

drop policy if exists "cp_select" on challenge_participants;
create policy "cp_select" on challenge_participants
  for select using (auth.uid() is not null);

drop policy if exists "cp_insert" on challenge_participants;
create policy "cp_insert" on challenge_participants
  for insert with check (user_id = get_my_user_id());

drop policy if exists "cp_delete" on challenge_participants;
create policy "cp_delete" on challenge_participants
  for delete using (
    user_id = get_my_user_id()
    or exists (select 1 from challenges c where c.id = challenge_participants.challenge_id and c.owner_id = get_my_user_id())
  );

-- Leaderboard via SECURITY DEFINER so it can aggregate across all participants' workouts
create or replace function public.get_challenge_leaderboard(p_challenge_id uuid)
returns table (
  user_id        uuid,
  user_name      text,
  user_nickname  text,
  user_avatar    text,
  total_min      numeric,
  total_strain   numeric,
  workouts_count integer,
  score          numeric
)
language plpgsql
security definer
set search_path = public
stable
as $fn$
declare
  v_metric        text;
  v_activity_type text;
  v_starts        date;
  v_ends          date;
begin
  select c.metric, c.activity_type, c.starts_at, c.ends_at
    into v_metric, v_activity_type, v_starts, v_ends
  from challenges c
  where c.id = p_challenge_id;

  if v_metric is null then
    return;
  end if;

  return query
  select
    u.id,
    u.name,
    u.nickname::text,
    u.avatar_url,
    coalesce(sum(w.activity_duration_min)::numeric, 0)     as total_min,
    coalesce(sum(w.activity_strain), 0)                    as total_strain,
    coalesce(count(w.id), 0)::integer                      as workouts_count,
    case v_metric
      when 'duration_min'    then coalesce(sum(w.activity_duration_min)::numeric, 0)
      when 'strain'          then coalesce(sum(w.activity_strain), 0)
      when 'workouts_count'  then coalesce(count(w.id)::numeric, 0)
      else 0
    end as score
  from challenge_participants cp
  join users u on u.id = cp.user_id
  left join workouts w
    on w.athlete_id = cp.user_id
   and w.event_date between v_starts and v_ends
   and (v_activity_type is null or w.activity_type = v_activity_type)
  where cp.challenge_id = p_challenge_id
  group by u.id, u.name, u.nickname, u.avatar_url
  order by score desc, u.nickname asc nulls last;
end;
$fn$;

revoke all on function public.get_challenge_leaderboard(uuid) from public;
grant execute on function public.get_challenge_leaderboard(uuid) to authenticated;

notify pgrst, 'reload schema';
