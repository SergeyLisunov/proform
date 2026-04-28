-- ──────────────────────────────────────────────────────────────────────────
-- 044_vector_extension_to_extensions_schema.sql
--
-- Move pgvector out of public schema. Supabase advisor flagged that
-- extensions in public can collide with user objects; the standard
-- recommendation is to put them in a dedicated `extensions` schema.
--
-- Affected objects:
--   - diary_embeddings.embedding (vector(384) column) — keeps working
--     because PostgreSQL stores type by OID, not name
--   - diary_embeddings_vec_idx (HNSW/IVF index using vector_cosine_ops)
--     — keeps working for the same reason
--   - match_diary(vector, int) — needs `extensions` added to its
--     SET search_path so the `<=>` operator still resolves inside
--     the function body
--
-- Applied to prod project hhyjihbctidtucvpgjzv 2026-04-26.
-- Idempotent. Safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the extension. NOTE: ALTER EXTENSION ... SET SCHEMA fails if
-- objects in the new schema clash. Fresh extensions schema, no clash.
ALTER EXTENSION vector SET SCHEMA extensions;

-- Allow normal roles to *use* the extensions schema (read its names)
-- so vector type resolution and operator lookups work for callers.
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Re-pin match_diary's search_path to include the new home so the
-- `<=>` cosine operator resolves inside the function body.
CREATE OR REPLACE FUNCTION match_diary(p_embedding vector, p_limit integer DEFAULT 20)
  RETURNS TABLE(source_type text, source_id uuid, content_preview text, similarity double precision)
  LANGUAGE sql
  STABLE
  SET search_path = public, extensions, pg_temp
AS $$
  SELECT de.source_type, de.source_id, de.content_preview,
         1 - (de.embedding <=> p_embedding) AS similarity
    FROM diary_embeddings de
   WHERE de.user_id = get_my_user_id()
   ORDER BY de.embedding <=> p_embedding
   LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
