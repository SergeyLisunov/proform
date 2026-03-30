-- ── 009_cycle_blocks: training cycle blocks + per-day type assignments ─────────

-- Periodization blocks (macro / meso / micro cycles)
create table if not exists cycle_blocks (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  label       text        not null,
  type        text        not null check (type in ('macro', 'meso', 'micro')),
  start_date  date        not null,
  end_date    date        not null,
  description text,
  goal        text,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table cycle_blocks enable row level security;

create policy "cycle_blocks_select" on cycle_blocks
  for select using (user_id = auth.uid());

create policy "cycle_blocks_insert" on cycle_blocks
  for insert with check (user_id = auth.uid());

create policy "cycle_blocks_update" on cycle_blocks
  for update using (user_id = auth.uid());

create policy "cycle_blocks_delete" on cycle_blocks
  for delete using (user_id = auth.uid());

create index if not exists cycle_blocks_user_idx  on cycle_blocks (user_id);
create index if not exists cycle_blocks_dates_idx on cycle_blocks (start_date, end_date);


-- Per-day type assignments within a cycle
create table if not exists cycle_days (
  id          uuid        primary key default gen_random_uuid(),
  cycle_id    uuid        not null references cycle_blocks(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  day_date    date        not null,
  day_type    text        not null check (day_type in ('training','competition','rest','travel','active_rest')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (cycle_id, day_date)
);

alter table cycle_days enable row level security;

create policy "cycle_days_select" on cycle_days
  for select using (user_id = auth.uid());

create policy "cycle_days_insert" on cycle_days
  for insert with check (user_id = auth.uid());

create policy "cycle_days_update" on cycle_days
  for update using (user_id = auth.uid());

create policy "cycle_days_delete" on cycle_days
  for delete using (user_id = auth.uid());

create index if not exists cycle_days_user_date_idx on cycle_days (user_id, day_date);
create index if not exists cycle_days_cycle_idx     on cycle_days (cycle_id);
