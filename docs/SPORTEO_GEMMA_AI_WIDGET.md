# Sporteo — плавающий ролевой AI-помощник (Gemma)

## Почему AI убран из сайдбара

Продуктовое решение: ассистент — вспомогательный инструмент «всегда под
рукой», а не отдельный раздел навигации. Пункт «AI-помощник» удалён из
`lib/sidebar/config.ts`; вход — плавающая кнопка на всех авторизованных
страницах. Route `/assistant` живёт как скрытый фолбэк (deep-links, таб
в хабе `/ai`) — решение зафиксировано, редиректов не потребовалось.

## Где монтируется виджет

`components/assistant/FloatingAssistant.tsx`, смонтирован один раз в
`components/ui/ClientOverlays.tsx` (root layout) → состояние панели
переживает клиентские переходы между страницами.

Компонент **не рендерится** (return null, не CSS):

1. `isAssistantPublicPath(pathname)` — лендинг `/`, `/auth/*`, `/legal/*`,
   `/demo/*`, `/tools/*`, `/invite/*`, `/p/*`, `/pricing`, публичные
   страницы клубов (одиночный slug вне зарезервированных разделов);
2. нет живой Supabase-сессии (`getSession` + `onAuthStateChange`);
3. сервер вернул `available:false` (роль без ассистента — например
   admin, — или тариф без AI).

## Роли

Роль определяет ТОЛЬКО сервер (`GET /api/assistant/capabilities` →
Role Policy по `users.role`): врач (+specialist) / тренер / спортсмен /
организация. Ролевые названия, подсказки, allowlist-контекст и
ограничения — `lib/ai/assistant/{policy,prompts,context}.ts` (см.
основную документацию Gateway).

## Контекстные кнопки

`components/assistant/AskAiButton.tsx` — «Спросить AI об этом
спортсмене» в профиле атлета (виден связанному тренеру/врачу под тем же
гейтом, что мед-досье). Кнопка диспатчит событие
`sporteo-assistant:open` c `{contextType, contextEntityId, contextLabel}`
— наружу уходит только идентификатор; сервер перепроверяет доступ
(trainer_athletes / connections doctor_athlete) при создании диалога и
на каждом сообщении. Контекст показан чипом в панели, очищается кнопкой,
применяется только к новому диалогу.

## История

Разделена по `user_id` (RLS owner-only) × `role_snapshot` (серверный
фильтр списка + 403 на продолжение диалога чужой роли). Организация у
пользователя одна (tenant-модель Sporteo), отдельного переключателя нет;
conversations хранят `organization_id` на будущее.

## Провайдер

Gemma 4 через Ollama Cloud (`lib/ai/ollama.ts`, server-only ключ
`OLLAMA_API_KEY`) + mock-провайдер (`AI_ASSISTANT_PROVIDER=mock`) для
разработки без ключа. Во frontend-бандле ключей нет.

**Anthropic**: ассистент его не использует. `lib/ai/claude.ts` и
`ANTHROPIC_API_KEY` НЕ удалены — их используют 14 независимых модулей
(AI-тренер, брифинги, инсайты, adaptive-plan, anomaly-check,
medical-summary, diary weekly-summary, club-audit, team-risk и др.).
Их перевод на Gemma — отдельное решение (см. «Можно после MVP»).
Пользовательские строки «добавьте ANTHROPIC_API_KEY» из UI убраны
(нейтральная копия без внутренних env-имён).

## Лимиты

Без изменений: `tariffs.ai_config` (free 20 · pro 100 · trainer 300 ·
club 1000-пул + soft 200), календарный месяц, списание только после
успешного ответа (идемпотентно, атомарный RPC), anti-burst 30/час.
Остаток и дата сброса — в шапке панели; quota-state оставляет историю и
показывает CTA (личный тариф → /pricing, орг-пул → «обратитесь к
администратору клуба»).

## A11y / адаптивность

Кнопка: `aria-label`, focus-ring, mobile `bottom-24` (над нижней
навигацией). Панель: `role="dialog"` + `aria-modal`, Escape закрывает,
фокус в поле ввода при открытии и обратно на кнопку при закрытии;
mobile — bottom-sheet (inset-x-2, 78vh), desktop — 420px справа снизу.

## Тесты

`components/assistant/floating-assistant.test.ts` — isAssistantPublicPath
(публичные/приватные пути) + отсутствие пункта в SIDEBAR_CONFIG.
Гейтвей-тесты — `lib/ai/assistant/assistant.test.ts` (19 шт.).

## Troubleshooting

- Кнопки нет на внутренней странице → проверьте сессию (401 в
  capabilities) и что роль поддержана; admin не видит ассистента.
- Кнопка есть на публичной странице → путь не покрыт
  `isAssistantPublicPath` — добавьте префикс и тест.
- «Диалог создан в другой роли» → роль аккаунта менялась; начните новый
  диалог.
