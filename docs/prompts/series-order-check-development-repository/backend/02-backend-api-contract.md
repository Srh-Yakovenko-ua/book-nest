# Backend API contract

Наведені маршрути є рекомендованими. Їх потрібно адаптувати до чинного стилю API після аудиту.

## 1. Отримання issues

```http
GET /api/reading-queue/series-order-issues?limit=3
```

### Response

```ts
type SeriesOrderIssuesView = {
  total: number;
  queueVersion: number | string;
  items: SeriesOrderIssueView[];
};

type SeriesOrderIssueView = {
  fingerprint: string;

  series: {
    id: string;
    title: string;
    cover?: string | null;
  };

  severity: "error" | "warning" | "info";

  problemType:
    | "missing_previous_from_queue"
    | "previous_book_after_later_book"
    | "multiple_previous_missing"
    | "previous_book_paused"
    | "current_reading_ahead_of_order"
    | "previous_book_want_to_buy"
    | "previous_book_not_owned"
    | "previous_book_in_transit"
    | "previous_book_lent_out"
    | "multiple_books_out_of_order";

  affectedBook: SeriesOrderBookView;
  previousBook: SeriesOrderBookView | null;

  unresolvedPreviousCount: number;

  currentOrder: SeriesOrderPositionView[];
  recommendedOrder: SeriesOrderPositionView[];

  allowedActions: SeriesOrderActionCode[];
  relatedProblems: Array<{
    problemType: string;
    affectedBookId: string;
    previousBookId: string | null;
  }>;
};

type SeriesOrderBookView = {
  id: string;
  title: string;
  cover?: string | null;
  seriesPosition: number | string | null;
  readingStatus: string;
  ownershipStatus: string;
  queuePosition: number | null;
  isCurrentReading: boolean;
};

type SeriesOrderPositionView = {
  bookId: string;
  title: string;
  queuePosition: number | null;
  seriesPosition: number | string | null;
};

type SeriesOrderActionCode =
  | "ADD_NEXT_PREVIOUS_BEFORE"
  | "ADD_ALL_PREVIOUS_BEFORE"
  | "REORDER_SERIES_SLOTS"
  | "OPEN_PREVIOUS_BOOK"
  | "RESUME_PREVIOUS_BOOK"
  | "ADD_PREVIOUS_TO_WISHLIST"
  | "OPEN_PURCHASE"
  | "OPEN_ORDER"
  | "OPEN_LOAN"
  | "IGNORE_ISSUE"
  | "DISABLE_SERIES_CHECK";
```

### Правила контракту

- Не повертати локалізовані UI-тексти.
- Не повертати готові назви кнопок.
- Не повертати дії, які фактично недоступні.
- `currentOrder` і `recommendedOrder` мають бути достатніми для preview.
- Одна серія повертається один раз.
- `limit` валідовується shared schema; рекомендований default для sidebar — `3`.

## 2. Preview виправлення

```http
POST /api/reading-queue/series-order-issues/:fingerprint/preview
```

```json
{
  "strategy": "ADD_NEXT_PREVIOUS_BEFORE",
  "expectedQueueVersion": 12
}
```

Можливі `strategy` для queue mutation:

```text
ADD_NEXT_PREVIOUS_BEFORE
ADD_ALL_PREVIOUS_BEFORE
REORDER_SERIES_SLOTS
```

### Response

```ts
type SeriesOrderFixPreviewView = {
  fingerprint: string;
  strategy: string;
  queueVersion: number | string;

  series: {
    id: string;
    title: string;
  };

  before: QueuePreviewItem[];
  after: QueuePreviewItem[];

  changes: Array<{
    type: "add" | "move";
    bookId: string;
    title: string;
    fromPosition: number | null;
    toPosition: number;
  }>;

  shiftedUnrelatedBooksCount: number;
  addedBooksCount: number;
  movedBooksCount: number;
  warnings: string[];
};

type QueuePreviewItem = {
  bookId: string;
  title: string;
  queuePosition: number;
  belongsToAffectedSeries: boolean;
};
```

Backend повторно обчислює preview. Frontend не надсилає готовий новий масив позицій як джерело істини.

## 3. Застосування виправлення

```http
POST /api/reading-queue/series-order-issues/:fingerprint/apply
```

```json
{
  "strategy": "REORDER_SERIES_SLOTS",
  "expectedQueueVersion": 12
}
```

Backend повторно перевіряє issue та стратегію в транзакції.

### Response

```ts
type ApplySeriesOrderFixResponse = {
  success: true;
  queueVersion: number | string;
  changedBookIds: string[];
  addedBookIds: string[];
  resolvedFingerprint: string;
};
```

## 4. Ігнорування конкретного issue

```http
POST /api/reading-queue/series-order-issues/:fingerprint/ignore
```

Body може бути порожнім або містити audit metadata за поточними правилами проєкту.

## 5. Вимкнення перевірки серії

```http
PUT /api/series/:seriesId/order-check-preference
```

```json
{
  "enabled": false
}
```

Повторне ввімкнення:

```json
{
  "enabled": true
}
```

## 6. Ownership/navigation actions

Для `NONE`, `WANT_TO_BUY`, `IN_TRANSIT`, `LENT_TO` перевикористати чинні endpoint-и та routes. Не створювати нові дублікати лише для sidebar.

Після будь-якої пов’язаної mutation frontend інвалідовує issues query.
