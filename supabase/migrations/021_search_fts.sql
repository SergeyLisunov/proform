-- Full-text search infrastructure (Week 4).
-- Adds tsvector generated columns + GIN indexes to searchable entities.
-- Uses 'simple' config (language-agnostic) so Cyrillic and Latin both work
-- without requiring a specific dictionary.
--
-- NOTE: `to_tsvector('simple'::regconfig, …)` is IMMUTABLE, but
-- `array_to_string(text[], text)` is not — so array columns (coaches.sports,
-- coaches/doctors.languages) are intentionally excluded from search_doc.
-- Search by sport/specialty is covered via the text columns instead.

-- ── users ────────────────────────────────────────────────────────────────
-- This schema uses single `name` + `nickname` (no first_name/last_name).
alter table public.users
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(nickname::text, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(name,            '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(email,           '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(city::text,      '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(sport::text,     '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(bio::text,       '')), 'D')
  ) stored;

create index if not exists users_search_doc_idx
  on public.users using gin (search_doc);

-- Cheap prefix index for nickname autocomplete (lowercased).
create index if not exists users_nickname_prefix_idx
  on public.users (lower(nickname::text) text_pattern_ops);

-- ── coaches ──────────────────────────────────────────────────────────────
alter table public.coaches
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(first_name,      '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(last_name,       '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(specialization,  '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(city,            '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(workplace,       '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(bio,             '')), 'D')
  ) stored;

create index if not exists coaches_search_doc_idx
  on public.coaches using gin (search_doc);

-- ── doctors ──────────────────────────────────────────────────────────────
alter table public.doctors
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(first_name,              '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(last_name,               '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(medical_specialization,  '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(city,                    '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(workplace,               '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(bio,                     '')), 'D')
  ) stored;

create index if not exists doctors_search_doc_idx
  on public.doctors using gin (search_doc);

-- ── organizations ────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists search_doc tsvector
  generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(org_name,     '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(org_slug,     '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(sport_type,   '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(city,         '')), 'C') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(description,  '')), 'D')
  ) stored;

create index if not exists organizations_search_doc_idx
  on public.organizations using gin (search_doc);

notify pgrst, 'reload schema';
