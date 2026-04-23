-- ──────────────────────────────────────────────────────────────────────────
-- 032_audit_logs_insert_auth_only.sql
-- Close the audit-log poisoning hole. Previous policy allowed any client
-- (including anonymous) to INSERT with WITH CHECK (true). Restrict to
-- authenticated users and require actor_id to match the caller (or be
-- NULL for system events). Applied to prod.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id IS NULL
    OR actor_id = (SELECT get_my_user_id())
  );

NOTIFY pgrst, 'reload schema';
