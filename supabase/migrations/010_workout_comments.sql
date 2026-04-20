-- ── 010_workout_comments: threaded comments per workout ──────────────────────
-- Visible to the athlete (owner of the workout) and to any user who has an
-- active connection with that athlete (doctor_athlete, coach_athlete, org_*).

create table if not exists workout_comments (
  id         uuid        primary key default gen_random_uuid(),
  workout_id uuid        not null references workouts(id) on delete cascade,
  author_id  uuid        not null references users(id) on delete cascade,
  body       text        not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workout_comments enable row level security;

drop policy if exists "workout_comments_select" on workout_comments;
create policy "workout_comments_select" on workout_comments
  for select using (
    exists (
      select 1 from workouts w
      where w.id = workout_comments.workout_id
        and (
          w.athlete_id = get_my_user_id()
          or exists (
            select 1 from connections c
            where c.status = 'active'
              and (
                (c.initiator_id = get_my_user_id() and c.recipient_id = w.athlete_id)
                or (c.recipient_id = get_my_user_id() and c.initiator_id = w.athlete_id)
              )
          )
        )
    )
  );

drop policy if exists "workout_comments_insert" on workout_comments;
create policy "workout_comments_insert" on workout_comments
  for insert with check (
    author_id = get_my_user_id()
    and exists (
      select 1 from workouts w
      where w.id = workout_comments.workout_id
        and (
          w.athlete_id = get_my_user_id()
          or exists (
            select 1 from connections c
            where c.status = 'active'
              and (
                (c.initiator_id = get_my_user_id() and c.recipient_id = w.athlete_id)
                or (c.recipient_id = get_my_user_id() and c.initiator_id = w.athlete_id)
              )
          )
        )
    )
  );

drop policy if exists "workout_comments_update" on workout_comments;
create policy "workout_comments_update" on workout_comments
  for update using (author_id = get_my_user_id())
  with check (author_id = get_my_user_id());

drop policy if exists "workout_comments_delete" on workout_comments;
create policy "workout_comments_delete" on workout_comments
  for delete using (author_id = get_my_user_id());

create index if not exists workout_comments_workout_idx on workout_comments (workout_id, created_at);
create index if not exists workout_comments_author_idx  on workout_comments (author_id);

notify pgrst, 'reload schema';
