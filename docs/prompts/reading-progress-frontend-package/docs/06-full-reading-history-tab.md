# 6. Підтаба «Повна історія читання»

## 6.1. Header

UA:

```text
Повна історія читання
Детальна активність і всі зафіксовані оновлення прогресу.
```

EN:

```text
Full reading history
Detailed activity and every recorded progress update.
```

Не дублювати великий title книги, якщо він уже є в page header.

## 6.2. Структура

```text
[Header]
[Wide summary card]
[Activity chart + 7d / 14d / all]
[Усі оновлення прогресу + sort]
[Day accordion]
[Pagination]
```

## 6.3. Summary overview

Показати:

- current page;
- pages count;
- progress percent;
- progress bar;
- status chip;
- reading period.

Metric items — до чотирьох:

- active days;
- updates count;
- average pages per active day;
- best day pages.

Calendar duration показувати лише з `readingPeriod.calendarDays`.

Не перевантажувати картку всіма можливими полями.

## 6.4. Chart

Використати той самий reusable chart/range components, що й compact block.

У full tab chart може бути вищим і мати більше місця для labels.

## 6.5. Усі оновлення прогресу

Title:

- UA `Усі оновлення прогресу`;
- EN `All progress updates`.

Не використовувати назву «сесії читання» — events не є реальними сесіями.

Sort:

- `desc` → `Спочатку нові` / `Newest first`;
- `asc` → `Спочатку старі` / `Oldest first`.

Default: `desc`.

При sort change:

- set page to 1;
- виконати server query;
- зберегти activityRange;
- очистити нерелевантний accordion state.

## 6.6. Day accordion

Collapsed header desktop:

```text
12 бер. 2026   +35 сторінок · 3 оновлення   До сторінки 250   ▼
```

Mobile:

```text
12 бер. 2026
+35 сторінок · 3 оновлення
До сторінки 250                           ▼
```

Не дублювати `startPage` у collapsed header.

Default open behavior має відповідати наявному Accordion pattern. Не відкривати всі дні одночасно.

## 6.7. Events усередині дня

Формат:

```text
10:20     +10 сторінок     До сторінки 225
```

Використовувати тільки:

- `event.pagesRead`;
- `event.page`;
- `event.recordedAt`.

Tooltip/description для часу:

UA:

```text
Час збереження оновлення. Він може відрізнятися від фактичного часу читання.
```

EN:

```text
The time the update was saved. It may differ from the actual reading time.
```

Не називати його «час читання», «сесія» або «тривалість».

Якщо `recordedAt` відсутній:

- не показувати `00:00`;
- не вигадувати час;
- показати лише delta і final page.

Події можна оформити як делікатну вертикальну timeline.

## 6.8. Pagination

Використовувати лише `history.pagination`.

Показувати, якщо `totalPages > 1`.

При page change:

- передати server page;
- зберегти range і sort;
- закрити accordion старої сторінки;
- скролити до заголовка секції «Усі оновлення прогресу», не до самого верху сторінки;
- не merge-ити локально сторінки при звичайній pagination.

Не пагінувати events усередині дня.

Якщо current page стала невалідною після зміни даних, перейти на останню доступну або page 1 без refetch loop.
