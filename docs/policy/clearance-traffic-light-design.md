# Светофор допуска — design memo (P3 ров)

> 2026-06-05: решения founder'а приняты (см. §«Принятые решения» ниже).
> Этот файл фиксирует контекст до и после; в коде ориентируемся на принятые ответы.

## Принятые решения (founder, 05.06.2026)

1. **Состояния**: 4 — `full` 🟢 · `limited` 🟡 (60% нормы) · `light_only` 🟠 (реаб) · `banned` 🔴.
2. **Gating**: **Hybrid** — warning + обязательный `override_reason` + запись в `audit_log`. Тренер может проигнорировать, но осознанно и под учёт.
3. **Срок действия**: `valid_until` обязателен для не-full допусков. Default 30 дней. После истечения — переход в системный stage **«required_review»** (серый), не green/red.
4. **Видят светофор**: athlete (свой), coach (связанный через `trainer_athletes`/`connections`), org-владелец/админ (агрегаты — count by state, без диагноза), parent (через `parent_links`, как часть safe-surfaces #171).
5. **Меняет**: только doctor. Coach — read-only. Athlete/Parent/Org — read-only.
6. **История**: **append-only journal** (`clearances` table). Каждое изменение = новая строка. Текущее = `MAX(created_at)`. Audit trail обязателен для медданных.

## Что мы строим

Дискретный канал между **доктором** и **тренером** про допуск спортсмена к
нагрузке. Тренер видит **состояние** (можно / частично / нельзя), но **НЕ
диагноз**. Привязано к атлету как «текущий допуск».

**Зачем**: дифференциатор Sporteo — если светофор реально работает (тренер не
поставит ударную нагрузку после операции на мениск, потому что увидит красный
индикатор), это и есть «врач + ACWR» moat, заявленный в стратегии.

## Текущая реальность (из аудита #162-серии)

✅ Privacy-модель есть: `recommendations.visibility_level='coach_only'`,
`recommendations.category='clearance'`, RLS-защита `recommendations_doctor_all` /
`recommendations_coach_only_select`.

❌ **0 строк в проде** этой категории. Нет state machine, нет «текущего
допуска», нет gating'а перед созданием тренировки. Полностью UI-эпик с
небольшим schema-добавлением.

## Решения, нужные ДО кода

### 1. Состояния светофора

Аудит предложил 4: `full` / `limited` / `light_only` / `banned`. Конкретное
семантическое значение:

| Состояние | UI | Тренировка |
|---|---|---|
| `full` | 🟢 зелёный | без ограничений |
| `limited` | 🟡 жёлтый | до X% обычной нагрузки (например 60%) |
| `light_only` | 🟠 оранжевый | только лёгкая зона / реабилитация |
| `banned` | 🔴 красный | тренировку нельзя создавать |

**Вопрос:** ОК с 4 состояниями? Менять подписи? Добавить 5-е (например
«post-surgery recovery week 1»)?

### 2. История или только текущее?

**A.** Одна строка на атлета — current clearance (`UPDATE` доктором).
- Просто, быстро, но история теряется.

**B.** Append-only journal — каждое изменение = новая строка, current = MAX(created_at).
- Audit trail, можно построить timeline восстановления, но больше работы.

**Рекомендую B** — медицинская инфа должна иметь след. Можно отдельную таблицу
`clearances` или расширить существующую `recommendations` (category='clearance'
уже там, добавить enum-колонку `clearance_status`).

### 3. Gating перед `INSERT workouts` / `calendar_events`

Что делает система когда тренер планирует тренировку для атлета с активным
ограничением?

**A.** Жёсткий block при `banned` (DB CHECK или RLS), warning при `light_only`/`limited`.
- Безопасно, но если doctor забыл снять `banned` после выздоровления — атлет в ловушке.

**B.** Только UI-warning, без БД-блокировки. Тренер видит красную плашку, но кнопка работает.
- Гибко, но если тренер игнорирует — нарушение медицинского запрета на нашей платформе.

**C.** Hybrid: банер + требование «confirm override» (`override_reason`).
- Тренер обязан написать причину. Запись в audit_log.

**Рекомендую C** — баланс безопасности и реальности (тренер может проигнорировать
medical decision только осознанно).

### 4. Кто и как меняет

- Doctor: всегда. UI — в карточке athlete'а у доктора.
- Coach: НЕ может менять, только видит.
- Athlete: видит? (свой статус — наверное да).
- Org admin: видит? (агрегаты — наверное да; конкретные состояния — нет).

**Вопрос:** доступы 4 уровней — confirm? Athlete видит свой светофор или нет?

### 5. Срок действия

Допуск имеет `valid_from` / `valid_until`? Например доктор ставит `light_only`
на 2 недели, потом автоматически возврат к `full`?

**A.** Allowance NEVER auto-expires. Doctor закрывает явно.
- Просто. Риск: «забытый» banned.

**B.** Allowance имеет `valid_until` (default 30 дней). После истечения
светофор показывает «требуется review» (не green, не red — gray).
- Принуждает доктора пересмотреть.

**Рекомендую B** — медицинский decay плюс forcing function для review.

---

## Если ответы получены — план инкрементов

1. **Migration**: таблица `clearances` (или extension of recommendations) + state enum + RLS.
2. **Backend write**: doctor server route POST /api/doctor/clearance.
3. **Backend gate**: BEFORE INSERT trigger на workouts/calendar_events (если
   reaction = block) или check function для UI.
4. **Coach UI**: светофор-badge на athlete-row в /athletes, /coach/athletes/[id].
   Banner в WorkoutAddDrawer при `banned`/`limited`.
5. **Doctor UI**: форма выставить/обновить clearance в medical-section атлета.
6. **Athlete UI** (опц.): свой светофор в athlete dashboard.

Ориентировочно **5-7 PR**.

---

## Что я НЕ буду делать без ответов

Без ответов на 5 вопросов выше — не пишу схему БД и RLS. Слишком много dimension'ов
расходится (4 вопроса × 2-3 варианта каждый = 12+ возможных архитектур).
