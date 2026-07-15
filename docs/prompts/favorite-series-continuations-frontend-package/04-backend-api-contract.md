# 04. Endpoint, API-контракт і прогрес серії

> Містить розділи 13–15. Фронтенд-агент має порівняти цей очікуваний контракт із реальною реалізацією.

## 13. Рекомендований endpoint

Оскільки результат є серієцентричним, рекомендований маршрут:

```http
GET /api/series/favorite-continuations
```

Query:

```text
limit
cursor або page — лише якщо це відповідає поточній пагінації
```

Для правого бара:

```http
GET /api/series/favorite-continuations?limit=3
```

Для перегляду всіх:

```http
GET /api/series/favorite-continuations
```

### Альтернативний маршрут

Якщо в архітектурі вся логіка улюблених централізована в `books`:

```http
GET /api/books/favorite-series-continuations
```

Остаточний маршрут потрібно вибрати після аудиту модулів.

Не додавати дані цього блока до:

```http
GET /api/books/favorites-summary
```

`favorites-summary` має залишатися легкою агрегацією, а не повертати вкладений список серій і книг.

---

## 14. Рекомендований API-контракт

```ts
type FavoriteSeriesContinuationsView = {
  total: number;
  items: FavoriteSeriesContinuationItem[];
  nextCursor?: string | null;
};

type FavoriteSeriesContinuationItem = {
  series: {
    id: string;
    title: string;
    cover?: string | null;
    status?: string | null;
    totalBooks: number;
  };

  favoriteBooksCount: number;

  progress: {
    finishedBooks: number;
    closedBooks: number;
    totalBooks: number;
  };

  nextBook: {
    id: string;
    title: string;
    cover?: string | null;
    authors: Array<{
      id: string;
      name: string;
    }>;

    seriesPosition: number | string | null;
    readingStatus: string;
    ownershipStatus: string;

    isFavorite: boolean;
    favoriteAddedAt: string | null;

    queue?: {
      isInQueue: boolean;
      position: number | null;
      priority: "low" | "normal" | "high" | null;
    } | null;

    readingProgress?: {
      currentPage: number | null;
      totalPages: number | null;
      percentage: number | null;
    } | null;
  };

  rankReason:
    | "reading"
    | "paused"
    | "available"
    | "lent"
    | "in_transit"
    | "want_to_buy"
    | "not_owned";

  lastFavoriteAddedAt: string | null;
};
```

### Важливо

- Не повертати готові українські тексти.
- Не повертати готовий label кнопки.
- Не дублювати повний `BookView`, якщо він дуже важкий.
- Якщо в проєкті вже є компактні `BookListItemView` та `SeriesListItemView`, перевикористати їх.
- `rankReason` можна не зберігати в БД — це computed enum для стабільного контракту або діагностики.

---

## 15. Розрахунок прогресу серії

Рекомендовано повертати:

```text
finishedBooks
closedBooks
totalBooks
```

Де:

```text
finishedBooks = readingStatus === finished
closedBooks = readingStatus IN (finished, dnf)
```

Це дозволяє фронтенду:

- показувати чесний прогрес «Прочитано 2 з 5»;
- не називати DNF прочитаною;
- водночас правильно визначати наступну книгу.

Не використовувати `closedBooks` як текст «прочитано».

---
