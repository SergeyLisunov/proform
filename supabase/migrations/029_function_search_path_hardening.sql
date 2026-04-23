-- ──────────────────────────────────────────────────────────────────────────
-- 029_function_search_path_hardening.sql
-- Pin search_path on all project-owned functions. Mitigates the
-- "function_search_path_mutable" Supabase security advisor: without this,
-- a compromised role could inject a malicious `public` schema that
-- shadows built-in operators or tables when the function runs.
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.sync_athlete_pass_usage()             SET search_path = public, pg_temp;
ALTER FUNCTION public.challenges_touch_updated_at()         SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_injuries_updated_at()             SET search_path = public, pg_temp;
ALTER FUNCTION public.workout_templates_touch_updated_at()  SET search_path = public, pg_temp;
ALTER FUNCTION public.update_notes_updated_at()             SET search_path = public, pg_temp;
ALTER FUNCTION public._touch_updated_at()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_connection_updated()           SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_connection_created()           SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
