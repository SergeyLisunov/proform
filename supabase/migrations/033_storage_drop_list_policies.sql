-- ──────────────────────────────────────────────────────────────────────────
-- 033_storage_drop_list_policies.sql
-- Close the "list all files" surface on four public buckets (avatars,
-- backgrounds, form-videos, note-attachments). Each had a broad SELECT
-- policy `bucket_id = 'X'` that let any client enumerate contents via
-- the storage SDK's .list() call.
--
-- Public URL reads (getPublicUrl) continue to work — they're served by
-- the storage worker and don't traverse RLS.
-- Applied to prod. No .list() call sites exist in the codebase.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "avatar_select"            ON storage.objects;
DROP POLICY IF EXISTS "avatars: public read"     ON storage.objects;
DROP POLICY IF EXISTS "backgrounds: public read" ON storage.objects;
DROP POLICY IF EXISTS "form_videos_select"       ON storage.objects;
DROP POLICY IF EXISTS "note-attachments-select"  ON storage.objects;

NOTIFY pgrst, 'reload schema';
