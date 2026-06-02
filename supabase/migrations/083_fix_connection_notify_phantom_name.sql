-- SEV1 fix — connection-invite flow broken in prod.
--
-- The triggers on `connections` build a display name from `users.first_name` /
-- `users.last_name`, which DO NOT EXIST (the table has `name`, `nickname`,
-- `email` — the same phantom-column bug as audit C1, fixed in app code but left
-- in these DB trigger functions). Result: every `INSERT … status='pending'`
-- into `connections` raises `column "first_name" does not exist`, so creating
-- ANY connection invite (coach↔athlete, doctor↔athlete, org↔member) fails.
--
-- These functions were created out-of-band (never in a repo migration); this
-- migration both FIXES them and formalizes them in the repo. Only the
-- display-name expression changes — everything else is reproduced verbatim from
-- the live definitions. They are SECURITY DEFINER, fire as the table owner
-- (RLS-exempt), and remain trigger-only (EXECUTE revoked from PUBLIC/anon/
-- authenticated per the 042 hardening pattern).
--
-- Correct expression: COALESCE(NULLIF(TRIM(COALESCE(name,'')),''), nickname, email).

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_connection_created()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  initiator_name text;
BEGIN
  -- Get initiator display name
  SELECT COALESCE(NULLIF(TRIM(COALESCE(name,'')), ''), nickname, email)
    INTO initiator_name
  FROM users WHERE id = NEW.initiator_id;

  -- Notify recipient
  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, action_url)
  VALUES (
    NEW.recipient_id,
    'invitation_received',
    'Новое приглашение',
    initiator_name || ' хочет установить связь с вами',
    'connection',
    NEW.id,
    '/connections'
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_connection_updated()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  other_name  text;
  notif_user  uuid;
  notif_type  text;
  notif_title text;
  notif_body  text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'active' THEN
    notif_user  := NEW.initiator_id;
    notif_type  := 'invitation_accepted';
    notif_title := 'Приглашение принято';
    SELECT COALESCE(NULLIF(TRIM(COALESCE(name,'')), ''), nickname, email)
      INTO other_name FROM users WHERE id = NEW.recipient_id;
    notif_body := other_name || ' принял ваше приглашение';

  ELSIF NEW.status = 'declined' THEN
    notif_user  := NEW.initiator_id;
    notif_type  := 'invitation_declined';
    notif_title := 'Приглашение отклонено';
    SELECT COALESCE(NULLIF(TRIM(COALESCE(name,'')), ''), nickname, email)
      INTO other_name FROM users WHERE id = NEW.recipient_id;
    notif_body := other_name || ' отклонил ваше приглашение';

  ELSIF NEW.status = 'cancelled' THEN
    notif_user  := NEW.recipient_id;
    notif_type  := 'invitation_cancelled';
    notif_title := 'Приглашение отозвано';
    SELECT COALESCE(NULLIF(TRIM(COALESCE(name,'')), ''), nickname, email)
      INTO other_name FROM users WHERE id = NEW.initiator_id;
    notif_body := other_name || ' отозвал приглашение';

  ELSIF NEW.status = 'terminated' THEN
    -- Notify the other party (not the one who terminated)
    notif_user := CASE
      WHEN NEW.terminated_by = NEW.initiator_id THEN NEW.recipient_id
      ELSE NEW.initiator_id
    END;
    notif_type  := 'connection_terminated';
    notif_title := 'Связь завершена';
    SELECT COALESCE(NULLIF(TRIM(COALESCE(name,'')), ''), nickname, email)
      INTO other_name FROM users WHERE id = NEW.terminated_by;
    notif_body := other_name || ' завершил связь с вами';

  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, action_url)
  VALUES (notif_user, notif_type, notif_title, notif_body, 'connection', NEW.id, '/connections');

  RETURN NEW;
END;
$function$;

-- Keep them trigger-only (defensive — CREATE OR REPLACE preserves grants, but be
-- explicit so a fresh re-create from this file matches the 042 hardening).
REVOKE ALL ON FUNCTION public.notify_connection_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_connection_updated() FROM PUBLIC, anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
