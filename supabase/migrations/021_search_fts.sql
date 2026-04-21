-- Full-text search infrastructure (Week 4).
-- Adds tsvector generated columns + GIN indexes to searchable entities.
-- Uses 'simple' config (language-agnostic) so Cyrillic and Latin both work
-- without requiring a specific dictionary.

-- ── users ────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(nickname,    '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(first_name,  '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(last_name,   '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(name,        '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(email,       '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(city,        '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(sport,       '')), 'C')
  ) stored;

create index if not exists users_search_doc_idx
  on public.users using gin (search_doc);

-- Cheap prefix index for nickname autocomplete (lowercased).
create index if not exists users_nickname_prefix_idx
  on public.users (lower(nickname) text_pattern_ops);

-- ── coaches ──────────────────────────────────────────────────────────────
alter table public.coaches
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(first_name,      '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(last_name,       '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(specialization,  '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city,            '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(workplace,       '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(bio,             '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(sports,    ' '), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(languages, ' '), '')), 'D')
  ) stored;

create index if not exists coaches_search_doc_idx
  on public.coaches using gin (search_doc);

-- ── doctors ──────────────────────────────────────────────────────────────
alter table public.doctors
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(first_name,              '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(last_name,               '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(medical_specialization,  '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city,                    '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(workplace,               '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(bio,                     '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(languages, ' '), '')), 'D')
  ) stored;

create index if not exists doctors_search_doc_idx
  on public.doctors using gin (search_doc);

-- ── organizations ────────────────────────────────────────────────────────
-- Only applies if the table exists.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organizations'
  ) then
    execute $sql$
      alter table public.organizations
        add column if not exists search_doc tsvector
        generated always as (
          setweight(to_tsvector('simple', coalesce(org_name,     '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(org_slug,     '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(sport_type,   '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(city,         '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(description,  '')), 'D')
        ) stored
    $sql$;
    execute 'create index if not exists organizations_search_doc_idx on public.organizations using gin (search_doc)';
  end if;
end$$;

notify pgrst, 'reload schema';
