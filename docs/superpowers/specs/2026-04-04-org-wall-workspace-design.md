# Organization Wall Workspace Design

## Goal

Привести `org/wall` к тому же продуктному уровню, что уже есть у `org` и `org/members`, не меняя существующую логику публикаций.

## Current Problem

Текущий экран стены выглядит как старый CRUD-интерфейс:

- слабая верхняя иерархия
- закрепленные публикации визуально почти не отличаются от обычной ленты
- фильтры и summary-метрики отсутствуют
- create modal функционален, но не ощущается частью единого organization workspace

Из-за этого `org/wall` выбивается из уже обновленного organization-flow.

## Scope

- Пересобрать верхнюю часть `org/wall` в organization content workspace.
- Добавить summary strip с ключевыми сигналами по контенту.
- Выделить закрепленные публикации в отдельную визуальную зону.
- Сделать feed публикаций плотнее и выразительнее.
- Подтянуть create modal до того же визуального языка.

## Non-Goals

- Не менять сервисы `getWallPosts`, `createWallPost`, `togglePin`, `softDeletePost`.
- Не добавлять новый backend, pagination, сортировку или новые права доступа.
- Не переписывать типы `WallPost`, `PostType`, `PostVisibility`.

## UX Direction

### 1. Hero

Верхний блок страницы становится content command center:

- чипы уровня `Организация` и `Контент`
- крупный заголовок `Стена`
- подзаголовок с названием организации и коротким описанием назначения экрана
- primary CTA `Новая публикация`
- secondary meta-сигналы вроде количества закрепленных постов и состояния ленты

### 2. Summary Strip

Сразу под hero появляется KPI-лента:

- всего публикаций
- закреплено
- событий
- публичных публикаций

Это помогает экрану считываться как рабочий центр публикаций, а не просто список карточек.

### 3. Pinned Zone

Закрепленные публикации становятся отдельным premium-блоком:

- собственный section header
- более сильная подложка
- визуально заметный статус `закреплено`

Если закрепленных постов нет, блок не шумит и просто не показывается.

### 4. Feed

Основная лента публикаций получает более сильную композицию:

- richer badges по типу публикации и видимости
- чище мета-строка
- лучшее разделение между title/body/meta/actions
- stronger empty-state, согласованный с `org/members`

### 5. Create Modal

Модал создания публикации остается тем же по логике, но становится ближе к новому shell:

- более сильный header
- аккуратнее поля
- лучше визуально выделенный submit CTA

## Implementation Notes

- Основные изменения ожидаются в [app/org/wall/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/wall/page.tsx).
- Разумно переиспользовать цветовой и compositional language из [app/org/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/page.tsx) и [app/org/members/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/members/page.tsx).
- Приоритет у визуальной консистентности и ясной иерархии, а не у добавления новых функций.
