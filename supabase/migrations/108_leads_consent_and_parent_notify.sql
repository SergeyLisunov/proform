-- 108_leads_consent_and_parent_notify
--
-- Два P1-дефекта, вскрытых ролевым QA. Оба — рассинхрон «код ушёл вперёд схемы».
--
-- P1-A. POST /api/leads/audit падал 500 на КАЖДОЙ отправке формы аудита с лендинга:
--   1) маршрут писал tool_leads.consent_at — такой колонки в таблице нет
--      (037 создала: id/email/source/payload/ip_hash/user_agent/created_at;
--       060/061/069 добавили только dispatch/конверсию/drip-колонки);
--   2) CHECK tool_leads_source_check (последняя редакция — 059) разрешал
--      только 'acwr','overtraining','templates','team-risk','adaptive-plan',
--      'club-audit','medical-summary','other', а форма шлёт 'landing-audit-form'.
--   Любой из двух пунктов = 500 ещё до отправки писем, лид терялся целиком.
--   Колонку добавляем, а не выпиливаем из кода: явное согласие на обработку
--   ПДн — юридически значимый факт, его нужно хранить с меткой времени.
--
-- P1-B. can_notify() ничего не знает про parent_links (родитель↔ребёнок, 089).
--   notifications INSERT-политика (082) вызывает can_notify() в WITH CHECK,
--   поэтому строка «родителю» отвергается 42501; а так как notifyMany() слал
--   ВЕСЬ батч одним INSERT, Postgres откатывал statement целиком — празднование
--   личного рекорда (services/personal-records.service.ts) терялось не только
--   у родителя, но и у самого атлета и у всех его тренеров.
--   Здесь чиним причину (предикат); построчная вставка как вторая линия
--   обороны — в services/notifications.service.ts.

-- ── P1-A. tool_leads: колонка согласия + новый источник ────────────────────
ALTER TABLE public.tool_leads
  ADD COLUMN IF NOT EXISTS consent_at timestamptz;

COMMENT ON COLUMN public.tool_leads.consent_at IS
  'Момент явного согласия на обработку ПДн (чекбокс в форме). NULL — лид из старых источников, где согласие не фиксировалось отдельно.';

-- source остаётся varchar(40): 'landing-audit-form' = 18 символов, влезает.
ALTER TABLE public.tool_leads DROP CONSTRAINT IF EXISTS tool_leads_source_check;

ALTER TABLE public.tool_leads
  ADD CONSTRAINT tool_leads_source_check
  CHECK (source IN (
    'acwr','overtraining','templates','team-risk','adaptive-plan',
    'club-audit','medical-summary','landing-audit-form','other'
  ));

-- ── P1-B. can_notify(): ветка parent_links ────────────────────────────────
-- Тело перенесено из 086 без изменений; добавлен ТОЛЬКО предикат parent_links.
-- Колонки берутся из 089: parent_id / child_id / status ∈ active|revoked|pending,
-- активной считается только status = 'active' (как в is_parent_of()).
-- Связь двунаправленная: родитель уведомляет ребёнка и ребёнок родителя.
CREATE OR REPLACE FUNCTION public.can_notify(actor uuid, target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    actor IS NOT NULL AND target IS NOT NULL AND (
      actor = target
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = actor AND u.role = 'admin')
      OR EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.status IN ('pending', 'active')
          AND ((c.initiator_id = actor AND c.recipient_id = target)
            OR (c.initiator_id = target AND c.recipient_id = actor)))
      OR EXISTS (
        SELECT 1 FROM public.athlete_passes ap
        WHERE (ap.coach_id = actor AND ap.athlete_id = target)
           OR (ap.coach_id = target AND ap.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.coach_sessions cs
        WHERE (cs.coach_id = actor AND cs.athlete_id = target)
           OR (cs.coach_id = target AND cs.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.coach_reviews r
        WHERE (r.athlete_id = actor AND r.coach_id = target)
           OR (r.coach_id = actor AND r.athlete_id = target))
      OR EXISTS (
        SELECT 1 FROM public.observation_diary od
        WHERE (od.coach_id = actor AND od.athlete_id = target)
           OR (od.coach_id = target AND od.athlete_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.medical_diary md
        WHERE (md.doctor_id = actor AND md.athlete_id = target)
           OR (md.doctor_id = target AND md.athlete_id = actor))
      -- NEW (108): родитель ↔ ребёнок по активной связи parent_links.
      OR EXISTS (
        SELECT 1 FROM public.parent_links pl
        WHERE pl.status = 'active'
          AND ((pl.parent_id = actor  AND pl.child_id = target)
            OR (pl.parent_id = target AND pl.child_id = actor)))
      OR EXISTS (
        SELECT 1 FROM public.org_members oa
        JOIN public.org_members ob ON ob.org_id = oa.org_id
        WHERE oa.user_id = actor AND ob.user_id = target
          AND oa.status = 'active' AND ob.status = 'active')
      OR EXISTS (
        SELECT 1 FROM public.org_group_sessions s
        JOIN public.org_session_participants p ON p.session_id = s.id
        WHERE (s.organization_id = actor AND p.user_id = target)
           OR (s.organization_id = target AND p.user_id = actor))
      OR EXISTS (
        SELECT 1 FROM public.recommendations rc
        WHERE actor  IN (rc.doctor_id, rc.coach_id, rc.athlete_id, rc.referred_to_user_id, rc.organization_id)
          AND target IN (rc.doctor_id, rc.coach_id, rc.athlete_id, rc.referred_to_user_id, rc.organization_id))
      OR EXISTS (
        SELECT 1 FROM public.doctor_inquiries di
        WHERE actor  IN (di.doctor_id, di.coach_id, di.athlete_id)
          AND target IN (di.doctor_id, di.coach_id, di.athlete_id))
      OR EXISTS (
        SELECT 1
        FROM (
          SELECT CASE WHEN c.initiator_id = actor THEN c.recipient_id ELSE c.initiator_id END AS aid
          FROM public.connections c
          WHERE c.status = 'active'
            AND c.connection_type IN ('coach_athlete', 'doctor_athlete')
            AND (c.initiator_id = actor OR c.recipient_id = actor)
        ) sa
        JOIN public.users ua ON ua.id = sa.aid AND ua.role = 'athlete'
        JOIN (
          SELECT CASE WHEN c.initiator_id = target THEN c.recipient_id ELSE c.initiator_id END AS aid
          FROM public.connections c
          WHERE c.status = 'active'
            AND c.connection_type IN ('coach_athlete', 'doctor_athlete')
            AND (c.initiator_id = target OR c.recipient_id = target)
        ) st ON st.aid = sa.aid)
    )
$function$;

-- CREATE OR REPLACE сохраняет ACL, но повторяем гранты 081 явно: функция
-- относительно anon — оракул «связаны ли эти двое», её видеть нельзя.
REVOKE ALL ON FUNCTION public.can_notify(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_notify(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_notify(uuid, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
