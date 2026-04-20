-- AI form (technique) analysis from athlete video clips.
-- Athletes upload a short clip; Claude Vision analyzes keyframes.

create table if not exists public.form_analyses (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.users(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  title text not null,
  sport text,
  exercise text,
  video_path text,
  video_public_url text,
  frames_count smallint default 0,
  status text not null default 'pending'
    check (status in ('pending','analyzing','done','error')),
  ai_summary text,
  ai_feedback jsonb default '{}'::jsonb,
  coach_feedback text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists form_analyses_athlete_idx on public.form_analyses(athlete_id, created_at desc);
create index if not exists form_analyses_author_idx  on public.form_analyses(author_id,  created_at desc);

alter table public.form_analyses enable row level security;

drop policy if exists form_analyses_select        on public.form_analyses;
drop policy if exists form_analyses_owner_insert  on public.form_analyses;
drop policy if exists form_analyses_owner_modify  on public.form_analyses;
drop policy if exists form_analyses_owner_delete  on public.form_analyses;

-- Athlete sees their own analyses, author sees what they created.
create policy form_analyses_select on public.form_analyses for select
  using (athlete_id = get_my_user_id() or author_id = get_my_user_id());

create policy form_analyses_owner_insert on public.form_analyses for insert
  with check (author_id = get_my_user_id());

create policy form_analyses_owner_modify on public.form_analyses for update
  using (author_id = get_my_user_id() or athlete_id = get_my_user_id())
  with check (author_id = get_my_user_id() or athlete_id = get_my_user_id());

create policy form_analyses_owner_delete on public.form_analyses for delete
  using (author_id = get_my_user_id());

notify pgrst, 'reload schema';
