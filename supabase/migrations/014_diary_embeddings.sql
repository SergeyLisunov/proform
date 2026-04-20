-- Feature 014: Semantic diary search via pgvector embeddings
-- Enables vector search across user's notes and workouts.

create extension if not exists vector;

create table if not exists public.diary_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source_type text not null check (source_type in ('note','workout')),
  source_id uuid not null,
  content_hash text not null,
  content_preview text,
  embedding vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create index if not exists diary_embeddings_user_idx
  on public.diary_embeddings (user_id);

create index if not exists diary_embeddings_vec_idx
  on public.diary_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.diary_embeddings enable row level security;

drop policy if exists diary_embeddings_select on public.diary_embeddings;
drop policy if exists diary_embeddings_insert on public.diary_embeddings;
drop policy if exists diary_embeddings_update on public.diary_embeddings;
drop policy if exists diary_embeddings_delete on public.diary_embeddings;

create policy diary_embeddings_select
  on public.diary_embeddings for select
  using (user_id = get_my_user_id());

create policy diary_embeddings_insert
  on public.diary_embeddings for insert
  with check (user_id = get_my_user_id());

create policy diary_embeddings_update
  on public.diary_embeddings for update
  using (user_id = get_my_user_id())
  with check (user_id = get_my_user_id());

create policy diary_embeddings_delete
  on public.diary_embeddings for delete
  using (user_id = get_my_user_id());

-- Relies on RLS: caller only sees own rows.
create or replace function public.match_diary(
  p_embedding vector(384),
  p_limit int default 20
)
returns table (
  source_type text,
  source_id uuid,
  content_preview text,
  similarity float
)
language sql
stable
security invoker
as $$
  select
    de.source_type,
    de.source_id,
    de.content_preview,
    1 - (de.embedding <=> p_embedding) as similarity
  from public.diary_embeddings de
  where de.user_id = get_my_user_id()
  order by de.embedding <=> p_embedding
  limit p_limit;
$$;

grant execute on function public.match_diary(vector, int) to authenticated;

notify pgrst, 'reload schema';
