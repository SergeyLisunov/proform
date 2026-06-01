-- QA M1 (full) step 2/2 — require a real relationship for cross-user notifications.
--
-- Wires can_notify() (migration 081) into the notifications INSERT policy. Before
-- this, any authenticated user could insert a notification for ANY user_id (with
-- an internal action_url) — i.e. spoof a notification onto any victim's bell.
-- Now the RLS-bound INSERT additionally requires that the actor
-- (get_my_user_id()) actually has a relationship with the target (user_id).
--
-- Verified end-to-end as an authenticated doctor: notify → connected athlete OK,
-- notify → self OK, notify → unrelated athlete BLOCKED (42501), external //url
-- BLOCKED (080 guard preserved). All 12 can_notify predicates were functionally
-- tested (both directions + negative controls) before wiring.
--
-- Unaffected (bypass RLS, keep working): admin-client inserts (coach-review
-- reply, ЮKassa webhooks, invite-accept) and the SECURITY DEFINER connection
-- triggers — they run RLS-exempt.
--
-- get_my_user_id() is wrapped in (SELECT …) so the planner evaluates it once per
-- statement (initplan) rather than per row — matters for notifyMany() batches.

BEGIN;

DROP POLICY IF EXISTS notifications_insert_internal_url ON public.notifications;

CREATE POLICY notifications_insert_internal_url
  ON public.notifications
  FOR INSERT
  TO public
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      action_url IS NULL
      OR (left(action_url, 1) = '/' AND left(action_url, 2) <> '//')
    )
    AND public.can_notify((SELECT get_my_user_id()), user_id)
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
