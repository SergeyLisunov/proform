# Admin Command Center Design

## Goal

Привести `admin` к тому же уровню workspace, что уже получили ключевые product-экраны, и убрать заметные английские хвосты из демо-данных и интерфейса.

## Current Problem

Текущий `admin` работает как набор utilitarian tabs, но визуально и по copy сильно выбивается:

- плоский header
- старый tab-shell
- англоязычные демо-данные и системные подписи
- слабая иерархия в `users`, `privacy`, `audit`, `system`

## Scope

- Пересобрать верхнюю часть `admin` в command center hero.
- Добавить KPI-strip.
- Усилить tabs-shell и сделать каждый admin tab чище и собраннее.
- Русифицировать видимые англоязычные demo-метки в пределах этого экрана.

## Non-Goals

- Не подключать реальный backend-admin.
- Не менять маршруты `admin/orgs` и `admin/crm`.
- Не добавлять новые admin permissions или бизнес-логику.

## UX Direction

### 1. Hero

- chips `Администрирование` и `Системный контроль`
- крупный заголовок `Панель администратора`
- краткое описание того, что управляется с этого экрана
- primary CTA `Назначить атлета`
- secondary quick link в `Управление организациями`

### 2. KPI Strip

- всего пользователей
- активность
- таблицы/сущности данных
- журналы/синхронизации

### 3. Tabs Shell

Tabs остаются прежними по смыслу, но получают более цельный workspace-shell:

- `Пользователи`
- `Приватность`
- `Журнал действий`
- `Система`

### 4. Content Refresh

- `users`: сильнее list-management feel
- `privacy`: cleaner policy matrix
- `audit`: читаемее журнал и action badges
- `system`: operations/status cards выглядят как единый блок

### 5. Copy Cleanup

Заменить англоязычные демонстрационные подписи на русский, где это влияет на восприятие экрана:

- relative times
- system/service labels
- audit details
- status copy

## Implementation Notes

- Основной файл: [app/admin/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/admin/page.tsx)
- Визуально стоит переиспользовать language из обновленных organization/workspace экранов
