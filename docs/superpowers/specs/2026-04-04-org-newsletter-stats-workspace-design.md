# Organization Newsletter Stats Workspace Design

## Goal

Привести экран статистики рассылки к тому же communication language, что уже есть у `org/newsletters`, не меняя расчетов и источников данных.

## Current Problem

Сейчас `org/newsletters/[id]/stats` функционален, но визуально отстает от нового экрана рассылок:

- старый плоский header
- слабая верхняя иерархия
- KPI и rate cards выглядят как старые utility-блоки
- preview рассылки не встроен в новый communication workspace

## Scope

- Пересобрать верхний блок в communication hero.
- Усилить KPI-strip и cards для delivery/open metrics.
- Сделать preview рассылки и audience meta более цельными.

## Non-Goals

- Не менять `getNewsletter`, `getNewsletterStats`.
- Не менять логику вычисления `openRate` и `deliveryRate`.
- Не добавлять новые графики, фильтры или экспорт.

## UX Direction

### 1. Hero

- back-link к `org/newsletters`
- chips `Организация` и `Статистика`
- subject как главный заголовок
- secondary meta: дата отправки, аудитория, статус

### 2. KPI Strip

- отправлено
- доставлено
- открыто
- ошибки

Карточки должны выглядеть как продолжение communication workspace, а не как старый admin-list.

### 3. Rates

Блоки доставляемости и открываемости становятся сильнее визуально:

- cleaner progress presentation
- больший акцент на процент
- понятный supporting text

### 4. Content Preview

Preview рассылки становится отдельной контентной карточкой с более сильной иерархией и context meta.

## Implementation Notes

- Основной файл: [app/org/newsletters/[id]/stats/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/[id]/stats/page.tsx)
- Визуально нужно переиспользовать язык из [app/org/newsletters/page.tsx](/Users/sergeylisunov/Documents/Playground/proform/app/org/newsletters/page.tsx)
