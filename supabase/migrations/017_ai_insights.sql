-- AI weekly/monthly insights: cached Claude-generated digests
-- keyed by user + period to avoid re-running the model on every view.

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  period_kind text not null check (period_kind in ('week','month')),
  period_start date not null,
  period_end   date not null,
  metrics jsonb not null default '{}'::jsonb,
  payload  jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  unique (user_id, period_kind, period_start)
);

create index if not exists ai_insights_user_idx on public.ai_insights(user_id, period_start desc);

alter table public.ai_insights enable row level security;

drop policy if exists ai_insights_select       on public.ai_insights;
drop policy if exists ai_insights_owner_insert on public.ai_insights;
drop policy if exists ai_insights_owner_modify on public.ai_insights;
drop policy if exists ai_insights_owner_delete on public.ai_insights;

create policy ai_insights_select on public.ai_insights for select
  using (user_id = get_my_user_id());
create policy ai_insights_owner_insert on public.ai_insights for insert
  with check (user_id = get_my_user_id());
create policy ai_insights_owner_modify on public.ai_insights for update
  using (user_id = get_my_user_id()) with check (user_id = get_my_user_id());
create policy ai_insights_owner_delete on public.ai_insights for delete
  using (user_id = get_my_user_id());

notify pgrst, 'reload schema';
