# ProForm — Реальная схема БД
## Версия: 1.2.0 (Апрель 2026)

> Этот документ описывает РЕАЛЬНУЮ схему БД Supabase, а не планируемую из ТЗ v1.1.0.

---

## Ключевые отличия от TЗ v1.1.0

| TЗ v1.1.0 (было)              | Реальная БД (стало)                     |
|-------------------------------|------------------------------------------|
| Таблица `profiles`            | Таблица `users` (id, auth_id, email, role, name, language) |
| `workouts.user_id`           | `workouts.athlete_id`                    |
| `calendar_events.user_id`    | `calendar_events.owner_id`               |
| 7 таблиц + 8 org таблиц      | 26 таблиц (добавлены chats, messages, subscriptions и др.) |
| `calendar_blocks` таблица     | Удалена (дубль `cycle_blocks`)           |
| `workout_sessions` таблица    | Удалена (дубль `workouts`)               |
| RLS через `auth.uid() = id`  | RLS через `get_my_user_id()` функцию     |

---

## 26 таблиц

### Основные (с данными)
| Таблица            | Строк | RLS | Описание                           |
|--------------------|-------|-----|------------------------------------|
| users              | 6     | 3   | Пользователи (auth_id bridge)      |
| athletes           | 3     | 7   | Профиль атлета (32 колонки)        |
| workouts           | 6     | 4   | Тренировки (athlete_id, HR zones)  |
| calendar_events    | 18    | 4   | События (owner_id, event_date)     |
| cycle_blocks       | 9     | 3   | Тренировочные циклы                |
| cycle_days         | 30    | 2   | Дни внутри цикла                   |
| competitions       | 5     | 2   | Соревнования                       |
| observation_diary  | 5     | 3   | Дневник наблюдений тренера         |
| privacy_settings   | 5     | 3   | Настройки приватности              |
| notifications      | 3     | 3   | Уведомления                        |
| audit_logs         | 4     | 2   | Аудит-лог                          |
| subscriptions      | 6     | 2   | Подписки (free/pro/team)           |

### Организации (0 данных)
| Таблица                | RLS | Описание                    |
|------------------------|-----|-----------------------------|
| organizations          | 10  | Профиль организации         |
| org_members            | 5   | Участники                   |
| newsletters            | 2   | Рассылки                    |
| newsletter_deliveries  | 3   | Статус доставки             |
| wall_posts             | 5   | Стена событий               |

### Коммуникации (0 данных)
| Таблица   | RLS | Описание              |
|-----------|-----|-----------------------|
| chats     | 2   | Чаты тренер-атлет     |
| messages  | 2   | Сообщения             |

### Тренерские инструменты (0 данных)
| Таблица            | RLS | Описание                    |
|--------------------|-----|-----------------------------|
| trainer_athletes   | 3   | Связка тренер-атлет         |
| training_marks     | 3   | Пометки к тренировкам       |
| workout_comments   | 2   | Комментарии                 |
| daily_metrics      | 3   | Метрики (WHOOP-ready)       |
| crm_notes          | 3   | CRM заметки                 |

### Утилиты
| Таблица       | RLS | Описание                |
|---------------|-----|-------------------------|
| saved_views   | 2   | Сохранённые фильтры     |
| user_events   | 2   | Аналитика               |

---

## Хелпер-функции

| Функция                 | Описание                                    |
|-------------------------|---------------------------------------------|
| `get_my_user_id()`      | SELECT id FROM users WHERE auth_id = auth.uid() |
| `get_my_role()`         | SELECT role FROM users WHERE auth_id = auth.uid() |
| `handle_new_auth_user()` | Триггер: создаёт users при регистрации       |
| `sync_event_date()`     | Триггер: sync event_date <-> start_date      |
| `update_updated_at()`   | Триггер: updated_at при UPDATE               |

---

## RLS паттерн

```sql
-- Правильно:
CREATE POLICY "owner_access" ON workouts
  FOR ALL USING (athlete_id = get_my_user_id());

-- НЕПРАВИЛЬНО (400 ошибки):
CREATE POLICY "bad" ON workouts
  FOR ALL USING (auth.uid() = (SELECT auth_id FROM users WHERE id = athlete_id));
```

---

## Удалённые таблицы (апрель 2026)

- `calendar_blocks` — дубль cycle_blocks, 0 строк
- `workout_sessions` — дубль workouts, 0 строк
