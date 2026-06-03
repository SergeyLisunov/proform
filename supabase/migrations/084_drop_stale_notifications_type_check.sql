-- SEV1 fix (root cause behind #4) — notifications.type CHECK was catastrophically
-- out of sync with the application and silently dropped almost every notification.
--
-- The constraint allowed ONLY:
--   comment, announcement, coach_mark, org_post, system, doctor_mark,
--   connection_request, message
-- but the app's `NotificationType` union (services/notifications.service.ts) and
-- the DB connection triggers produce a DIFFERENT, evolving set:
--   session_scheduled, session_cancelled, checkup_scheduled, checkup_cancelled,
--   invited_to_event, event_cancelled, pass_issued, rsvp_received,
--   invitation_received/accepted/declined/cancelled, connection_terminated,
--   broadcast, coach_replied_to_review, new_review_for_coach, pass_session_used,
--   … (plus webhook/org-activity/doctor types).
-- Only `system` overlapped — so 17 of 18 union types (and the entire connection-
-- invite flow) were rejected by the CHECK. Because notify()/notifyMany()
-- silent-fail on insert error, these failures were INVISIBLE: nearly every in-app
-- notification has been silently discarded in prod (only `system` survived).
--
-- `type` is a display/routing field (TopBar + /notifications map it to an icon,
-- with a graceful fallback for unknown values) — NOT a security boundary. The
-- authoritative validation is the app-layer `NotificationType` TS union on the
-- notify() path. A static DB allowlist for an open, feature-driven set is a
-- recurring silent-breakage source (this is exactly how it broke). Dropping it
-- permanently removes that class of failure; new notification types no longer
-- require a coupled migration.
--
-- (The phantom first_name/last_name bug in the connection triggers was fixed in
-- migration 083; this removes the second wall that still blocked them.)

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

NOTIFY pgrst, 'reload schema';
