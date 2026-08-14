# Backend / API specification — Loan History

## 1. Головний принцип

**Не створювати нову history table.**

Існуючий `BookLoan` уже зберігає завершену позику через:
- `status = "returned"`;
- `returnedAt != null`.

Потрібен окремий read-model / query API поверх `book_loans`.

---

## 2. Поточна модель

Перевір актуальний working tree.

У базовій моделі вже є:

```text
BookLoan
- id
- userId
- bookId
- type
- personName
- contact
- loanDate
- expectedReturnDate
- note
- remindToReturn
- status
- returnedAt
- createdAt
- updatedAt
```

Якщо локально вже додані reminder fields (`remindBeforeDays`, `nextReminderAt`) — зберегти їх і не відкочувати.

Для history нові business fields у таблиці не потрібні.

---

## 3. Data invariant

Completed history record:

```text
status = "returned"
returnedAt != null
```

Return mutation повинна залишатися єдиним стандартним способом завершити активну позику.

History endpoint не змінює ownership.

---

## 4. Shared contracts

Додати окремі schemas/types, не перевантажувати active `LoansQuerySchema`.

Рекомендовано:

```ts
LoanHistoryResultSchema = z.enum([
  "on_time",
  "late",
  "no_due_date",
]);
```

```ts
LoanHistoryFilterSchema = z.enum([
  "all",
  "on_time",
  "late",
  "no_due_date",
]);
```

```ts
LoanHistorySortSchema = z.enum([
  "returned_desc",
  "returned_asc",
  "loan_date_desc",
  "duration_desc",
  "title_asc",
  "person_asc",
]);
```

### History query

```ts
LoanHistoryQuerySchema = z.object({
  ...pagination,
  type: LoanTypeSchema.optional(),
  result: LoanHistoryFilterSchema.default("all"),
  person: z.string().trim().optional(),
  search: z.string().trim().max(...).optional(),
  returnedFrom: IsoDateSchema.optional(),
  returnedTo: IsoDateSchema.optional(),
  sort: LoanHistorySortSchema.default("returned_desc"),
});
```

Назви exact schemas адаптувати до conventions проєкту.

---

## 5. History list view

Рекомендована структура:

```ts
LoanHistoryListItemView = {
  id: string;
  type: LoanType;

  book: LoanBookPreview;

  personName: string;

  loanDate: string | null;
  expectedReturnDate: string | null;

  returnedAt: string;
  returnedDate: string;

  historyResult: "on_time" | "late" | "no_due_date";

  durationDays: number | null;
  delayDays: number | null;
}
```

List response не повинен тягнути зайві поля, якщо вони потрібні тільки detail drawer.

---

## 6. Detail view

```ts
LoanHistoryDetailView = {
  ...LoanHistoryListItemView;

  contact: string | null;
  note: string | null;

  createdAt: string;
  updatedAt: string;
}
```

Якщо локальний reminder lifecycle уже реалізований, reminder metadata можна залишити в backend domain, але не треба робити його ключовою частиною history UI.

---

## 7. Derived date rules

### returnedDate

`returnedAt` — timestamp.
`expectedReturnDate` / `loanDate` — date-only.

Для business comparisons отримати calendar `returnedDate` через чинну project date/timezone normalization.

Не робити:

```text
returnedAt timestamp > expectedReturnDate timestamp
```

без нормалізації.

---

## 8. historyResult

Pseudo:

```ts
if (expectedReturnDate === null) {
  return "no_due_date";
}

if (returnedDate <= expectedReturnDate) {
  return "on_time";
}

return "late";
```

---

## 9. delayDays

Тільки для late:

```text
delayDays = calendarDiff(returnedDate, expectedReturnDate)
```

Інакше:
`null`.

---

## 10. durationDays

Якщо `loanDate` є:

```text
durationDays = calendarDiff(returnedDate, loanDate)
```

Same-day loan/return:
`0`.

Якщо `loanDate = null`:
`null`.

Не підміняти `loanDate` на `createdAt`.

---

## 11. GET /api/loans/history

Повертає тільки current user's completed loans.

Base scope:

```text
userId = currentUser.id
status = "returned"
returnedAt IS NOT NULL
```

Дотримуйся чинної soft-delete політики books.

### Search

Перевикористати existing book text search helper, де можливо.

Search fields:
- title
- originalTitle
- author
- personName
- contact
- note

### Direction

`type = borrowed_from_someone | lent_to_someone`

### Result filter

Filter повинен виконуватися **в БД до pagination**.

Не можна:
- завантажити всі returned loans;
- визначити result у JS;
- потім slice.

Якщо Prisma не дозволяє надійно порівняти `returnedAt::date` та `expectedReturnDate`, використати safe parameterized SQL.

### Person

Case-insensitive exact/normalized match за current project pattern.

### Returned period

Filter за фактичною датою повернення.

- `returnedFrom` inclusive
- `returnedTo` inclusive

### Pagination

Default за conventions, наприклад 10.

---

## 12. Sorting

Усе backend-side.

### returned_desc

`returnedAt DESC`, then `id ASC`.

### returned_asc

`returnedAt ASC`, then `id ASC`.

### loan_date_desc

`loanDate DESC NULLS LAST`, then `returnedAt DESC`, `id ASC`.

### duration_desc

За calendar duration DESC.

Якщо Prisma не може виразити duration sort — safe parameterized SQL / repository query.

### title_asc

Book title ASC + id.

### person_asc

personName ASC + returnedAt DESC + id.

Не робити client sort.

---

## 13. GET /api/loans/history/overview

Query scope:

- `type?`
- `person?`
- `returnedFrom?`
- `returnedTo?`

Не застосовувати:
- `search`
- `result`
- pagination
- sort

### Response

Рекомендовано:

```ts
{
  summary: {
    totalCompleted: number;

    borrowedCount: number;
    lentCount: number;

    onTimeCount: number;
    onTimePercent: number;

    lateCount: number;
    latePercent: number;
    averageDelayDays: number | null;

    noDueDateCount: number;

    averageDurationDays: number | null;
  };

  topPeople: Array<{
    personName: string;
    totalCount: number;
    borrowedCount: number;
    lentCount: number;
  }>;

  duration: {
    averageDays: number | null;
    longestDays: number | null;
    shortestDays: number | null;
  };

  reliability: {
    onTimeCount: number;
    lateCount: number;
    noDueDateCount: number;
    onTimePercent: number;
  };
}
```

Backend повертає готові числа. Frontend не рахує відсотки/середні з list items.

---

## 14. Percent rules

Для consistency:

```text
onTimePercent = onTimeCount / totalCompleted * 100
latePercent = lateCount / totalCompleted * 100
```

Якщо `totalCompleted = 0`:
- percent = 0.

Округлення:
- backend повертає стабільне округлене значення за project convention;
- UI не повинен мати іншу formula.

---

## 15. Average rules

### averageDelayDays

Denominator:
тільки `late`.

Якщо late = 0:
`null`.

### averageDurationDays

Denominator:
тільки records із non-null `loanDate`.

Якщо таких немає:
`null`.

### longest / shortest

Тільки records із calculable duration.

---

## 16. Top people

Group by current `personName`.

Top:
5.

Order:
1. totalCount DESC
2. personName ASC

Не намагайся в цій задачі нормалізувати людей у `LoanContact`.

Відоме обмеження:
`Олена` і `олена` можуть залишатися різними raw values, якщо поточна система не має canonical normalization.

---

## 17. GET /api/loans/history/people

Додавати тільки якщо немає reusable існуючого source для person filter.

Повернути distinct `personName` із completed history current user.

Можна підтримати `search` для autocomplete.

Не брати options із current history page.

---

## 18. GET /api/loans/history/:loanId

Security:

```text
id = loanId
userId = currentUser.id
status = returned
```

Інакше 404/appropriate existing error semantics.

Повернути detail view.

---

## 19. Restricted correction endpoint

Якщо реалізуємо history correction:

```text
PATCH /api/loans/history/:loanId
```

Input тільки:

```ts
{
  returnedDate?: string;
  note?: string | null;
}
```

Не приймати:
- status;
- type;
- personName;
- contact;
- loanDate;
- expectedReturnDate;
- ownership fields;
- reminder fields.

### returnedDate validation

Якщо `loanDate != null`:
`returnedDate >= loanDate`.

Не дозволяти endpoint перетворювати completed loan назад в active.

Після correction derived fields не зберігати — вони автоматично зміняться при наступному read/overview.

---

## 20. Expected return date semantics

Історичний `expectedReturnDate` — **останній погоджений строк на момент фактичного повернення**.

Приклад:

- спочатку строк 10.08;
- quick action +7 -> 17.08;
- фактично повернули 18.08.

History result:
`late by 1 day`, не 8.

Не створювати event log попередніх due dates у цій задачі.

---

## 21. Reminder lifecycle integration

History page не відновлює reminders.

Якщо локально вже є:
- `remindBeforeDays`;
- `nextReminderAt`;

переконайся, що return flow не залишає pending reminder для completed loan, згідно вже погодженого lifecycle.

Не робити нову notification систему в history task.

---

## 22. Repository architecture

Зберегти layering:

- api/controller
- application/service
- domain calculations
- infrastructure/repository

Рекомендація:
- pure date/result helpers — domain;
- query/filter/sort — repository;
- assembling response + media — service.

Не класти бізнес-формули в controller.

---

## 23. Performance

Не допускати:
- N+1 cover/book loading;
- fetch all history for pagination;
- frontend aggregates;
- frontend sorting.

Перевір індекс.

Рекомендований, якщо немає еквівалента:

```prisma
@@index([userId, status, returnedAt])
```

Не додавати дублюючий index без потреби.

---

## 24. Soft delete

Не змінювати глобальну purge/soft-delete модель у межах history task.

History query повинна поводитися узгоджено з чинними project rules для trashed books.

---

## 25. API docs/client

- Zod contracts в `@app/shared`.
- OpenAPI DTOs за чинним pattern.
- після backend API змін — regenerate typed API client (`pnpm gen:api` або актуальна команда).
- не писати ручні дублікати generated client types.
