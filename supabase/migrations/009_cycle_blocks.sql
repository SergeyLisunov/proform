-- ── 009_cycle_blocks: training cycle blocks + per-day type assignments ─────────

-- Periodization blocks (macro / meso / micro cycles)
create table if not exists cycle_blocks (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  label       text        not null,
  type        text        not null check (type in ('macro', 'meso', 'micro')),
  start_date  date        not null,
  end_date    date        not null,
  created_at  timestamptz not null default now()
);

alter table cycle_blocks enable row level security;

create policy "cycle_blocks_select" on cycle_blocks
  for select using (owner_id = auth.uid());

create policy "cycle_blocks_insert" on cycle_blocks
  for insert with check (owner_id = auth.uid());

create policy "cycle_blocks_update" on cycle_blocks
  for update using (owner_id = auth.uid());

create policy "cycle_blocks_delete" on cycle_blocks
  for delete using (owner_id = auth.uid());

create index if not exists cycle_blocks_owner_idx on cycle_blocks (owner_id);
create index if not exists cycle_blocks_dates_idx  on cycle_blocks (start_date, end_date);


-- Per-day type assignments (rest / easy / moderate / hard / competition / recovery)
create table if not exists cycle_day_types (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  date        date        not null,
  day_type    text        not null check (day_type in ('rest','easy','moderate','hard','competition','recovery')),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (owner_id, date)
);

alter table cycle_day_types enable row level security;

create policy "cycle_day_types_select" on cycle_day_types
  for select using (owner_id = auth.uid());

create policy "cycle_day_types_insert" on cycle_day_types
  for insert with check (owner_id = auth.uid());

create policy "cycle_day_types_update" on cycle_day_types
  for update using (owner_id = auth.uid());

create policy "cycle_day_types_delete" on cycle_day_types
  for delete using (owner_id = auth.uid());

create index if not exists cycle_day_types_owner_date_idx on cycle_day_types (owner_id, date);
