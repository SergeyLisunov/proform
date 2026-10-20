-- ──────────────────────────────────────────────────────────────────────────
-- 118_specialist_profile.sql
--
-- Профиль специалиста: физиотерапевт, массажист, нутрициолог, психолог.
--
-- ЗАЧЕМ. Роль specialist есть в базе с миграции 105 (её можно выбрать при
-- регистрации), но профиля у неё не было: ни таблицы, ни поля
-- специализации. У врача — doctors (015), у тренера — coaches; специалист
-- не мог ни указать, чем занимается, ни попасть в справочник. Делить
-- таблицу doctors нельзя: справочник и раздел «Врачи» показали бы
-- массажиста врачом.
--
-- ЧТО ДЕЛАЕМ. Таблица specialists по образцу doctors (015):
--   • specialist_types — несколько специализаций сразу (физиотерапевт часто
--     ещё и массажист); словарь — lib/specialist.ts, CHECK держит его же;
--   • formats — офлайн, онлайн, выезд;
--   • certifications — список строк {name, issuer, year}, как у врача.
-- Права как у doctors: публичный профиль читают все, свой — владелец.
-- В отличие от doctors, профиль по умолчанию НЕ публичный: сделать данные
-- общедоступными можно только с явного согласия (152-ФЗ, ст. 10.1) — его
-- даёт отдельная галочка в мастере и настройках.
-- Создать и править строку может только сам специалист (роль specialist):
-- иначе любой мог бы завести себе профиль специалиста и попасть в
-- справочник, не будучи им.
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.specialists (
  id                  uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  specialist_types    text[] NOT NULL DEFAULT '{}'
                        CHECK (specialist_types <@ ARRAY['physio', 'massage', 'nutrition', 'psychology', 'other']::text[]),
  main_focus          text,
  bio                 text,
  experience_years    smallint CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 70),
  education           text,
  certifications      jsonb NOT NULL DEFAULT '[]'::jsonb,
  license_number      text,
  formats             text[] NOT NULL DEFAULT '{}'
                        CHECK (formats <@ ARRAY['offline', 'online', 'visit']::text[]),
  city                text,
  country             text,
  languages           text[] NOT NULL DEFAULT '{}',
  consultation_fee    numeric CHECK (consultation_fee IS NULL OR consultation_fee >= 0),
  currency            text NOT NULL DEFAULT 'RUB',
  telegram_url        text,
  website_url         text,
  accepts_new_clients boolean NOT NULL DEFAULT true,
  profile_public      boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialists_types ON public.specialists USING gin (specialist_types);

ALTER TABLE public.specialists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specialists_select ON public.specialists;
CREATE POLICY specialists_select ON public.specialists
  FOR SELECT USING (profile_public = true OR id = (SELECT public.get_my_user_id()));

DROP POLICY IF EXISTS specialists_owner_insert ON public.specialists;
CREATE POLICY specialists_owner_insert ON public.specialists
  FOR INSERT WITH CHECK (
    id = (SELECT public.get_my_user_id())
    AND (SELECT public.get_my_role()) = 'specialist'
  );

DROP POLICY IF EXISTS specialists_owner_update ON public.specialists;
CREATE POLICY specialists_owner_update ON public.specialists
  FOR UPDATE USING (id = (SELECT public.get_my_user_id()))
  WITH CHECK (
    id = (SELECT public.get_my_user_id())
    AND (SELECT public.get_my_role()) = 'specialist'
  );

DROP POLICY IF EXISTS specialists_owner_delete ON public.specialists;
CREATE POLICY specialists_owner_delete ON public.specialists
  FOR DELETE USING (id = (SELECT public.get_my_user_id()));

DROP TRIGGER IF EXISTS trg_specialists_updated ON public.specialists;
CREATE TRIGGER trg_specialists_updated BEFORE UPDATE ON public.specialists
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.specialists TO authenticated;
GRANT SELECT ON public.specialists TO anon;

COMMIT;

NOTIFY pgrst, 'reload schema';
