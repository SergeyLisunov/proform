-- ──────────────────────────────────────────────────────────────────────────
-- 117_private_medical_storage.sql
--
-- Закрытое хранилище для медицинских файлов.
--
-- ЗАЧЕМ. Вложения медицинского дневника (рецепты, сканы анализов, выписки)
-- и выгрузки Apple Health (пульс, лекарства, история болезней) лежали в
-- бакете note-attachments, который публичный: файл отдаётся по прямой
-- ссылке без какой-либо проверки прав (033 закрыла только перечисление
-- файлов, не чтение). Кто однажды получил ссылку — тренер, которому врач
-- показал запись, бывший врач, кто угодно, кому ссылку переслали, — читает
-- файл всегда; отозвать доступ нельзя. Путь выгрузки Apple Health ссылкой
-- наружу не отдавался, но собирается из id пользователя и метки времени.
--
-- ЧТО ДЕЛАЕМ. Бакет medical-private, не публичный. Файл лежит в папке
-- своего автора — первый сегмент пути равен users.id автора. Права:
--   • загрузить — только в свою папку;
--   • прочитать — автору; и тому, кому RLS показывает запись медицинского
--     дневника, которая ссылается на этот файл (attachments[].path) и
--     написана владельцем папки. Последнее условие не даёт сослаться на
--     чужой файл из своей записи и так получить к нему доступ;
--   • удалить — только автору.
-- Права записи дневника решают 036/048/114: спортсмен видит запись, если
-- врач ею поделился, тренер — если поделился с тренером, бывший врач — свою.
-- Отозвал врач показ — пропал и доступ к файлу: клиент получает файл по
-- подписанной ссылке на 10 минут (lib/medical-attachments), а не по вечной;
-- уже выданная ссылка действует до конца этого срока.
--
-- Старые файлы переносит scripts/migrate-medical-attachments.mjs (service
-- role, по умолчанию — пробный прогон без изменений).
-- ──────────────────────────────────────────────────────────────────────────

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('medical-private', 'medical-private', false, 26214400)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit;

-- Поиск записи по пути вложения при каждой выдаче подписанной ссылки.
CREATE INDEX IF NOT EXISTS idx_medical_diary_attachments
  ON public.medical_diary USING gin (attachments jsonb_path_ops)
  WHERE attachments IS NOT NULL;

DROP POLICY IF EXISTS "medical-private: upload to own folder" ON storage.objects;
CREATE POLICY "medical-private: upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-private'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_user_id())::text
  );

DROP POLICY IF EXISTS "medical-private: read own or shared record" ON storage.objects;
CREATE POLICY "medical-private: read own or shared record" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-private'
    AND (
      (storage.foldername(name))[1] = (SELECT public.get_my_user_id())::text
      OR EXISTS (
        SELECT 1 FROM public.medical_diary d
        WHERE d.attachments @> jsonb_build_array(jsonb_build_object('path', objects.name))
          AND d.doctor_id::text = (storage.foldername(objects.name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "medical-private: delete own" ON storage.objects;
CREATE POLICY "medical-private: delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical-private'
    AND (storage.foldername(name))[1] = (SELECT public.get_my_user_id())::text
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
