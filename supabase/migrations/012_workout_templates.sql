-- ── 012_workout_templates: reusable workout templates with sharing ───────────

create table if not exists workout_templates (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references users(id) on delete cascade,
  name          text        not null check (length(name) between 1 and 160),
  activity_type text,
  duration_min  integer     check (duration_min is null or duration_min between 1 and 600),
  description   text,
  segments      jsonb,
  is_public     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table workout_templates enable row level security;

drop policy if exists "workout_templates_select" on workout_templates;
create policy "workout_templates_select" on workout_templates
  for select using (
    user_id = get_my_user_id()
    or is_public = true
    or exists (
      select 1 from connections c
      where c.status = 'active'
        and (
          (c.initiator_id = get_my_user_id() and c.recipient_id = workout_templates.user_id)
          or (c.recipient_id = get_my_user_id() and c.initiator_id = workout_templates.user_id)
        )
    )
  );

drop policy if exists "workout_templates_insert" on workout_templates;
create policy "workout_templates_insert" on workout_templates
  for insert with check (user_id = get_my_user_id());

drop policy if exists "workout_templates_update" on workout_templates;
create policy "workout_templates_update" on workout_templates
  for update using (user_id = get_my_user_id())
  with check (user_id = get_my_user_id());

drop policy if exists "workout_templates_delete" on workout_templates;
create policy "workout_templates_delete" on workout_templates
  for delete using (user_id = get_my_user_id());

create index if not exists workout_templates_user_idx on workout_templates (user_id);
create index if not exists workout_templates_public_idx on workout_templates (is_public) where is_public = true;

create or replace function public.workout_templates_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workout_templates_updated_at on workout_templates;
create trigger workout_templates_updated_at
  before update on workout_templates
  for each row execute function public.workout_templates_touch_updated_at();

notify pgrst, 'reload schema';
