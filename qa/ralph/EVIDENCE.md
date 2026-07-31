# Доказательства

Каждый закрытый P0 — с воспроизведением до правки и проверкой после.
Машинные артефакты: `qa/ralph/evidence/rls-probe.json` (полный протокол
ролевых проверок), `qa/ralph/evidence/audit-workflow.json` (находки аудита
с цитатами кода и вердиктами проверяющих агентов).

Секретов, токенов и реальных персональных данных в артефактах нет.

---

## QA-P0-1 · Эскалация привилегий через собственную строку `users`

**Тест-кейс:** `qa/ralph/rls-probe.mjs`, проверка `WR-02`.
Вход настоящим паролем под `qa.athlete.alpha2@sporteo-qa.dev` → JWT роли →
`PATCH /rest/v1/users?id=eq.<свой id>` с телом `{"role":"admin"}`.

**До правки:**
```
❌ WR-02  Спортсмен НЕ может повысить себе роль до admin
     ожидалось: true · получено: false
     роль после попытки: admin (PATCH status=200)
❌ WR-03  Спортсмен НЕ может вписать себя админом в чужую организацию
     ожидалось: true · получено: false · status=201
```

**Первопричина:** политика `users_update_own` —
`USING (auth_id = auth.uid() OR get_my_role() = 'admin')`, `WITH CHECK` отсутствует
(проверено запросом к `pg_policy`: `polwithcheck IS NULL`).

**Изменённые файлы:** `supabase/migrations/104_guard_users_privileged_columns.sql`
(новый триггер), `lib/hooks/useUser.ts` (удалена `switchRole`),
`lib/db/privileged-columns.test.ts` (регрессия).

**После правки:**
```
✅ WR-02  роль после попытки: athlete (PATCH status=403)
✅ WR-03  status=403
```

**Следы теста откачены:** роль `qa.athlete.alpha2` возвращена в `athlete`,
подделанная строка `org_members` и тренировка `QA-PROBE: подделка` удалены.

**Проверка эксплуатации в проде:** в базе три администратора —
`admin@proform.test` (служебный), `waterdreamkzn@gmail.com` (владелец),
`qa.platform.owner@sporteo-qa.dev` (синтетический). Посторонних админов нет.

---

## QA-P0-2 · Регистрация сразу администратором платформы

**Тест-кейс:** воспроизведение триггерного пути на живой базе — INSERT в
`auth.users` с `raw_user_meta_data = {"role":"admin"}` (ровно те данные,
которые кладёт `supabase.auth.signUp({ options: { data } })`), затем чтение
`public.users.role`. Транзакция завершена исключением → откат, мусор не создан.

**До правки:**
```
ERROR: ПОДТВЕРЖДЕНО P0: самостоятельная регистрация даёт роль admin (откат выполнен)
```

**Первопричина:** `handle_new_auth_user`, allowlist
`('admin','coach','trainer','athlete','organization','doctor','specialist')`
включал `admin`, а источник значения — клиентские метаданные.

**Изменённые файлы:** `supabase/migrations/105_p0_signup_role_and_medical_scope.sql`.

**После правки:** allowlist самостоятельной регистрации —
`('coach','athlete','organization','doctor','specialist')`; `trainer` → `coach`;
всё прочее → `athlete`.

---

## QA-P0-3 · Медицинская рекомендация чужому спортсмену

**Тест-кейс:** `rls-probe`, проверки `MED-07` (негативная) и `MED-08`
(позитивный контроль). Врач клуба Beta пытается создать `recommendations`
для спортсмена клуба Alpha.

**После правки:**
```
✅ MED-07  Врач НЕ может выписать рекомендацию не своему пациенту   status=403
✅ MED-08  Врач ВСЁ ЕЩЁ может выписать рекомендацию своему пациенту  status=201
```
Позитивный контроль важен: правка не должна ломать легитимный сценарий.
Созданная в контроле строка удаляется тем же прогоном.

**Изменённые файлы:** `app/api/recommendations/route.ts` (проверка связи),
`supabase/migrations/105_*.sql` (политика `recommendations_doctor_insert`).

---

## QA-P0-4 · Рассылка медданных всем врачам платформы

**Первопричина (цитата из кода до правки):**
```ts
const { data } = await admin
  .from('users')
  .select('id, name, email, notification_prefs')
  .eq('role', 'doctor')          // ← без какого-либо скоупа
  .not('email', 'is', null)
  .limit(MAX_OPEN_QUEUE_FANOUT)
```
Письмо содержит имя спортсмена и клинический вопрос.

**Изменённый файл:** `app/api/doctor-inquiries/[id]/notify/route.ts` —
получатели ограничены врачами организаций, в которых состоит сам спортсмен;
при отсутствии таких врачей маршрут возвращает `sent_count: 0` с пометкой
`NO_ORG_DOCTORS` вместо веерной рассылки.

**Статус проверки:** исправление подтверждено сборкой и типами; живой
прогон отправки не выполнялся — см. BLOCKERS B-02 (реальные письма).

---

## P1 · Публичные страницы за формой входа (регрессия PR #238)

**До правки (production):**
```
/about    → 307 → /auth/login?redirectTo=%2Fabout
/contacts → 307 → /auth/login?redirectTo=%2Fcontacts
```
На эти страницы ведут ссылки с лендинга (`SocialProofSection`) и из
`/legal/privacy` — то есть их открывают анонимные посетители.

**После правки (локальная production-сборка):**
```
/about    → 200
/contacts → 200
/dashboard→ 307 (защита кабинета не ослаблена)
```

**Изменённые файлы:** `lib/routes/reserved-slugs.ts` (`PUBLIC_APP_SLUGS`),
`lib/supabase/middleware.ts` (оба гейта), `components/assistant/FloatingAssistant.tsx`,
`lib/routes/reserved-slugs.test.ts` (регрессия).

---

## Ролевая изоляция — позитивные и негативные контроли

Полный протокол — `qa/ralph/evidence/rls-probe.json`. Сводка второго прогона:

```
Проверок: 23 · прошло: 23 · упало: 0
```
В наборе одновременно есть негативные проверки (чужой клуб, чужой спортсмен,
чужие медданные, чужие AI-диалоги) и позитивные (свой спортсмен виден,
своя рекомендация создаётся) — набор, который проходит «запретив всё»,
бесполезен.

---

## Прогоны автоматических проверок

| Проверка | Команда | Результат |
|---|---|---|
| Юнит/интеграционные | `npx vitest run` | 86 из 86, 12 файлов |
| Типы | `npx tsc --noEmit` | чисто |
| Сборка | `npm run build` | EXIT 0 |
| Ролевой зонд БД | `node qa/ralph/rls-probe.mjs` | 23 из 23 (двумя прогонами) |
| E2E cross-tenant | `playwright --project=roles --grep cross-tenant` | 17 из 17 |
| E2E маршруты ролей + AI-виджет | `playwright --project=roles` | прогон 1: 82 из 84 (2 падения — дефекты самих тестов); прогон 2 после правки: 77 из 77 |
| E2E мобильный | `playwright --project=mobile` | 20 из 20 (production) |
| Линтер | `npm run lint` | 180 ошибок — все предсуществующие; в новых файлах 0 |
