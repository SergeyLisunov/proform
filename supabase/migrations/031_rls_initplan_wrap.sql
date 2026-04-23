-- ──────────────────────────────────────────────────────────────────────────
-- 031_rls_initplan_wrap.sql
-- Performance advisor "auth_rls_initplan" fix: wrap auth.uid() and
-- get_my_user_id() calls inside every RLS policy with (SELECT ...) so
-- PostgreSQL evaluates them once per query instead of once per row.
--
-- Re-runnable: the regex uses negative lookbehind to skip already-wrapped
-- calls. If a policy's clauses are already good, the DO block leaves it
-- alone.
--
-- Scope: all public.* policies where either USING or WITH CHECK mentions
-- a bare auth.uid() or get_my_user_id().
-- Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

DO $mig$
DECLARE
  r record;
  new_qual  text;
  new_check text;
  roles_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, permissive, roles,
           qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual       IS NOT NULL AND (qual       ~ 'auth\.uid\(\)' OR qual       ~ 'get_my_user_id\(\)'))
        OR
        (with_check IS NOT NULL AND (with_check ~ 'auth\.uid\(\)' OR with_check ~ 'get_my_user_id\(\)'))
      )
  LOOP
    new_qual  := r.qual;
    new_check := r.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '(?<!SELECT )auth\.uid\(\)',      '(SELECT auth.uid())',       'g');
      new_qual := regexp_replace(new_qual, '(?<!SELECT )get_my_user_id\(\)', '(SELECT get_my_user_id())', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '(?<!SELECT )auth\.uid\(\)',      '(SELECT auth.uid())',       'g');
      new_check := regexp_replace(new_check, '(?<!SELECT )get_my_user_id\(\)', '(SELECT get_my_user_id())', 'g');
    END IF;

    IF new_qual IS NOT DISTINCT FROM r.qual AND new_check IS NOT DISTINCT FROM r.with_check THEN
      CONTINUE;
    END IF;

    roles_sql := CASE
      WHEN r.roles IS NULL
        OR array_length(r.roles, 1) IS NULL
        OR array_to_string(r.roles, ',') = 'public'
        THEN 'PUBLIC'
      ELSE (SELECT string_agg(quote_ident(role_name), ', ')
              FROM unnest(r.roles::text[]) AS role_name)
    END;

    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      r.policyname, r.schemaname, r.tablename,
      r.permissive, r.cmd, roles_sql,
      CASE WHEN new_qual  IS NOT NULL THEN ' USING ('      || new_qual  || ')' ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN ' WITH CHECK (' || new_check || ')' ELSE '' END
    );
  END LOOP;
END
$mig$;

NOTIFY pgrst, 'reload schema';
