# ProForm — Claude Instructions

## Проект
Платформа для отслеживания спортивных тренировок.
- **Репозиторий:** sergeylisunov/proform
- **Деплой:** proform-delta.vercel.app
- **Supabase:** atlet-pro (hhyjihbctidtucvpgjzv, eu-central-1)

## Стек
- Next.js 14, TypeScript
- Metronic Tailwind v4
- Supabase (PostgreSQL + Auth + RLS)
- Vercel (деплой)
- Resend (email)

## Роли пользователей
athlete | coach | organization | admin

## Критически важно про схему БД
- Таблица называется `users`, НЕ `profiles`
- `auth_id` в `users` → ссылка на `auth.users.id`
- Все FK используют `users.id` (не `auth.uid()`)
- Функция `get_my_user_id()` → возвращает `users.id` через `WHERE auth_id = auth.uid()`
- `calendar_events` использует `owner_id`, НЕ `user_id`
- `workouts` использует `athlete_id`
- После каждой миграции: `NOTIFY pgrst, 'reload schema';`

## Деплой
```bash
git push origin main
# Vercel деплоит автоматически
```
При ошибке ECONNRESET — переключись на мобильный хотспот.

---

## Obsidian Knowledge Vault

Хранилище знаний: `/Users/sergeylisunov/Downloads/proform-vault/`

### При старте сессии
1. Прочитай `00-home/index.md` — карта всех заметок
2. Прочитай `00-home/текущие приоритеты.md` — что сейчас в работе
3. Если задача касается конкретного модуля — найди и прочитай нужную заметку из `knowledge/`

### В процессе работы
- Незнакомый паттерн → смотри `knowledge/decisions/`
- Дебаг → смотри `knowledge/debugging/`
- Новая интеграция → смотри `knowledge/integrations/`

### При завершении (пользователь: "сохрани сессию")
1. Создай заметку в `sessions/` → `YYYY-MM-DD описание.md`
2. Обнови `00-home/текущие приоритеты.md`
3. Решение → `knowledge/decisions/`
4. Баг → `knowledge/debugging/`
5. Паттерн → `knowledge/patterns/`
6. Обнови `00-home/index.md` если новые заметки

### Правила именования заметок
Называй утверждениями, не категориями:
✔ `rate limit Supabase 100 запросов в секунду.md`
✖ `supabase.md`
