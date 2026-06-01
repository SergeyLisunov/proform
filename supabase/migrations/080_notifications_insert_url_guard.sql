-- QA M1 (partial) — notifications INSERT hardening: action_url must be an
-- internal relative path.
--
-- Finding: `notifications` had two OR'd INSERT policies; the broader one
-- (`notifications_insert`) was `WITH CHECK (auth.role() = 'authenticated')`,
-- letting ANY logged-in user insert a notification for ANY user_id — a
-- spoofing / phishing vector (craft a notification with an external action_url
-- link to a victim's bell).
--
-- Full fix (server-side notification creation via admin client / DB triggers +
-- self-only RLS) is a larger refactor — all 28 notify() call sites run on the
-- browser client across 10 features, so locking INSERT to self-only now would
-- break legitimate cross-user notifications (doctor→athlete, athlete→coach
-- review, coach→athlete, etc.). Tracked separately.
--
-- This partial fix closes the highest-harm vector — external phishing links —
-- without breaking any legitimate notify: it consolidates the two INSERT
-- policies into one that still allows any authenticated caller (preserving
-- cross-user notifies) BUT requires action_url to be NULL or an internal
-- relative path (starts with a single '/', not '//' which browsers treat as a
-- protocol-relative external URL). All legitimate action_urls are already
-- relative ('/dashboard', '/athletes/<id>', …). Admin-client inserts (cron,
-- coach-review reply) bypass RLS anyway.

BEGIN;

DROP POLICY IF EXISTS "notifications: insert allowed" ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;

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
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
