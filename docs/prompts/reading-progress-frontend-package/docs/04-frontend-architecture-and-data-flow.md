# 4. Frontend-архітектура і data flow

## 4.1. Один endpoint — один response

Для поточного набору параметрів використовувати одну query, яка повертає:

- `summary`;
- `activity`;
- `history`.

Не створювати окремі requests для summary, chart, recent activity або full history.

## 4.2. Параметри compact block

Початково:

```ts
{
  activityRange: "7d",
  page: 1,
  limit: 3,
  sort: "desc"
}
```

Якщо backend не дозволяє `limit: 3`, використати мінімальний підтримуваний limit і відобразити перші три day groups без додаткових агрегацій.

## 4.3. Параметри full history

```ts
{
  activityRange: "7d",
  page: 1,
  limit: 20,
  sort: "desc"
}
```

Локальний state:

```ts
activityRange
historyPage
historySort
expandedDayIds або expandedDates
```

Правила:

- change range → page можна зберегти;
- change sort → `page = 1`;
- change bookId → скинути range/page/sort/accordion до defaults;
- change page → зберегти range і sort;
- після page/sort change закрити day items, яких уже немає в result set.

## 4.4. Query keys

Query key обов’язково включає:

- `bookId`;
- `activityRange`;
- `page`;
- `limit`;
- `sort`.

Не використовувати один ключ для різних ranges/pages.

Використати generated query-key helper, якщо він є.

## 4.5. Previous data і refetch

При range/page/sort changes:

- використовувати `keepPreviousData`, `placeholderData` або еквівалент поточної React Query версії;
- не прибирати весь блок;
- зберігати висоту chart/list container;
- показувати локальний loading state лише в секції, яка refetch-иться;
- уникати layout shift.

## 4.6. Invalidation

Після успішного progress mutation або status mutation, що впливає на читання:

- invalidation book details;
- invalidation усіх reading-history queries для цього `bookId`;
- оновлення compact block;
- оновлення full history;
- оновлення chart, recent activity і progress bar.

Не робити optimistic перерахунок summary/chart. Backend response залишається source of truth.

## 4.7. Орієнтовна компонентна структура

Адаптувати до реальної feature-структури:

```text
reading-progress/
  reading-progress-block.tsx
  reading-progress-summary.tsx
  reading-progress-stats.tsx
  reading-progress-forecast.tsx
  reading-activity-chart.tsx
  reading-activity-range-control.tsx
  recent-reading-activity.tsx
  reading-history-completeness-notice.tsx

reading-history/
  reading-history-tab.tsx
  reading-history-header.tsx
  reading-history-overview.tsx
  reading-history-list.tsx
  reading-history-day.tsx
  reading-history-event.tsx
  reading-history-sort.tsx
  reading-history-empty-state.tsx
  reading-history-skeleton.tsx
```

Reusable parts:

- activity chart;
- range control;
- summary metric item;
- date-only і datetime formatters, якщо їх немає.

Не дробити просту розмітку без користі й не створювати один великий файл.

## 4.8. Chart

Використати існуючу chart library.

Chart отримує готові `activity.points` і не виконує агрегацій.

Правила:

- vertical bars;
- bar height = `pagesRead`;
- нульові дні зберігають місце на осі;
- labels можна проріджувати, points/bars видаляти не можна;
- tooltip працює для кожної точки;
- fixed bar width не повинна ламати `all` range;
- не реконструювати tooltip data із сусідніх points.
