# 2. Аудит готовності бекенду

Аудит виконується **до frontend-реалізації**, але не повинен перетворюватися на довге окреме дослідження, якщо generated client уже підтверджує контракт.

## 2.1. Endpoint і query

Перевірити наявність реального endpoint:

```http
GET /api/books/:id/reading-history
```

Перевірити підтримку:

```ts
activityRange?: "7d" | "14d" | "all";
page?: number;
limit?: number;
sort?: "asc" | "desc";
```

Перевірити defaults або фактичну поведінку:

```ts
activityRange = "7d";
page = 1;
limit = 20;
sort = "desc";
```

## 2.2. Response readiness

Підтвердити, що один response містить:

- `summary`;
- `activity`;
- `history`.

Підтвердити, що бекенд уже повертає готові:

- current page, pages count, percent, remaining pages;
- status-specific dates;
- reading period і calendar days;
- active days, update count, tracked pages;
- average pages per active day;
- best day;
- last activity;
- estimated active days remaining;
- completeness metadata;
- activity summary;
- chart points, включно з нульовими календарними днями;
- history, згруповану за календарними днями;
- events усередині дня;
- server-side pagination metadata.

## 2.3. Semantics

Перевірити:

- `date` у day groups і activity points є календарною датою, а не datetime;
- `recordedAt` є datetime і означає час збереження оновлення;
- `pagesRead`, `startPage`, `finalPage`, `updatesCount` уже розраховані бекендом;
- `history.days` уже відсортовані відповідно до query `sort`;
- pagination рахується за day groups, не за events;
- `historyCompleteness` коректно обробляє legacy progress;
- `null` означає відсутність/недостатність даних, а не нуль.

## 2.4. Generated client

Знайти та зафіксувати:

- точну назву generated hook;
- тип параметрів;
- тип response;
- enum статусів;
- query key helper, якщо він генерується;
- чи підтримується `limit: 3`;
- мінімальний і максимальний `limit`;
- фактичні назви полів, якщо вони відрізняються від очікуваних.

Не створювати ручний дубль DTO.

## 2.5. Mutations та invalidation

Перевірити mutation для:

```http
POST /api/books/:id/reading-progress
```

або фактичний endpoint оновлення прогресу.

Також перевірити mutations зміни reading status.

Після success frontend має мати можливість інвалідовувати:

- book details query;
- усі reading-history queries конкретного `bookId` незалежно від range/page/sort.

## 2.6. Backend tests / generation

Якщо у репозиторії є відповідні scripts, виконати релевантні команди:

- backend typecheck;
- backend tests для reading history;
- OpenAPI/schema generation;
- generated client generation або consistency check.

Не запускати важкі unrelated suites без потреби.

## 2.7. Критичні блокери

Критичним вважається відсутність будь-чого з цього:

- endpoint або generated hook;
- grouped history days;
- activity points;
- server pagination;
- summary calculations, які специфікація забороняє рахувати на frontend;
- book-scoped access до даних;
- query sort/range, необхідних UI.

## 2.8. Результат аудиту

Створити звіт за `templates/backend-readiness-report.md` зі статусом:

- `READY`;
- `READY_WITH_DIFFERENCES`;
- `PARTIALLY_READY`;
- `BLOCKED`.

Якщо контракт семантично повний, але назви відрізняються, це не блокер: використовувати generated client і описати mapping.
