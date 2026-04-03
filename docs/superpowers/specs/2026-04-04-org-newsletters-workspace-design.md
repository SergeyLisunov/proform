# Organization Newsletters Workspace Design

## Goal

Привести `org/newsletters` к тому же уровню organization workspace, что уже получили `org`, `org/members` и `org/wall`, без изменения бизнес-логики рассылок.

## Current Problem

Текущий экран рассылок работает, но визуально ощущается как старый список:

- слабый верхний блок
- секции `черновики / запланированные / отправленные` не образуют цельный communication workspace
- карточки рассылок дают мало сигнала по аудитории, таймингу и статусу
- create modal функционален, но не звучит как часть нового shell

## Scope

- Пересобрать верхнюю часть `org/newsletters` в communication workspace hero.
- Добавить KPI-strip по состояниям рассылок.
- Сделать секции рассылок более выразительными и собранными.
- Улучшить карточки рассылок, сохранив текущую логику действий.
- Подтянуть create modal к новому organization content language.

## Non-Goals

- Не менять сервисы `getNewsletters`, `createNewsletter`, `updateNewsletterStatus`.
- Не переписывать stats-route `/org/newsletters/[id]/stats`.
- Не добавлять новые типы статусов, scheduling logic или delivery backend.

## UX Direction

### 1. Hero

Экран становится communication command center:

- чипы `Организация` и `Коммуникации`
- крупный заголовок `Рассылки`
- короткое описание экрана
- primary CTA `Новая рассылка`
- secondary context про текущий объем отправок и ближайшее состояние очереди

### 2. KPI Strip

Сразу под hero появляются основные метрики:

- всего рассылок
- черновики
- запланированные
- отправленные

Это делает экран ближе к рабочему центру коммуникаций, а не просто к списку объектов.

### 3. Section Rails

Секции `Черновики`, `Запланированные`, `Отправленные` становятся отдельными product-зонами:

- собственные заголовки и короткие пояснения
- cleaner badges с количеством элементов
- stronger empty states

### 4. Newsletter Cards

Карточки должны лучше отвечать на три вопроса:

- что это за рассылка
- кому она идет
- когда она отправлена или будет отправлена

Для этого усиливаются:

- status badge
- audience summary
- timing row
- action CTA (`Отправить`, `Статистика`)

### 5. Create Modal

Модал остается тем же по логике, но получает:

- более сильный header
- cleaner field grouping
- более понятное разделение действий `черновик / запланировать / отправить`

## Implementation Notes

- Основные изменения ожидаются в [app/org/newsletters/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/page.tsx).
- Визуально стоит переиспользовать композиционный язык из [app/org/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/page.tsx) и [app/org/wall/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/wall/page.tsx).
- Приоритет — консистентный organization-flow, а не добавление новых коммуникационных функций.
