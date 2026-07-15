# Backend: ignore, disable, транзакційність і помилки

## Ігнорування конкретного конфлікту

Дія **«Залишити як є»**:

- не змінює чергу;
- зберігає ignore для конкретного fingerprint;
- приховує лише поточний стан конфлікту.

Рекомендований fingerprint включає дані, достатні для зміни при новому стані:

```text
userId
seriesId
problemType
affectedBookId
previousBookId
current relevant queue positions
reading statuses
series-order version або relevant series positions
```

Не обов’язково включати всю `queueVersion`, якщо будь-яка стороння зміна черги не повинна повертати warning. Fingerprint має змінюватися лише тоді, коли змінюється сутність конфлікту.

Issue з’являється повторно, якщо змінилися:

- порядок відповідних книг;
- reading status;
- склад серії;
- канонічні позиції;
- affected/previous book;
- problem type.

## Вимкнення перевірки серії

Дія **«Не перевіряти цю серію»** зберігається per-user та per-series.

Потрібно підтримати:

- вимкнення з issue card;
- повторне ввімкнення в налаштуваннях серії;
- відсутність issues для вимкненої серії;
- user isolation.

## Транзакційність

Усі queue changes в apply виконуються в одній транзакції:

- validation;
- повторне обчислення issue;
- перевірка queue version;
- додавання/переміщення;
- нормалізація позицій;
- збільшення version;
- commit.

У разі будь-якої помилки — повний rollback.

## Optimistic concurrency

Використати наявний механізм:

```text
queueVersion
updatedAt
ETag
expectedPositions
```

Рекомендований request field:

```json
{
  "expectedQueueVersion": 12
}
```

Якщо черга змінилася:

```http
409 Conflict
```

Доменний код:

```text
QUEUE_STALE
```

## Рекомендовані помилки

### `409 QUEUE_STALE`

Черга змінилася після preview.

### `409 ISSUE_STALE`

Fingerprint більше не описує актуальну проблему.

### `409 ALREADY_IN_QUEUE`

Книга вже є в черзі. Frontend виконує refetch.

### `422 QUEUE_LIMIT_REACHED`

Неможливо додати всі потрібні книги.

### `404 BOOK_NOT_FOUND` / `SERIES_NOT_FOUND`

Сутність видалено або більше не доступна.

### `403 FORBIDDEN`

Користувач не має доступу.

### `422 INVALID_FIX_STRATEGY`

Стратегія не дозволена для цього issue.

## Безпека

- userId береться з authentication context;
- server не довіряє book IDs або positions від клієнта без повторної перевірки;
- apply не приймає довільний готовий queue array як джерело істини;
- усі сутності перевіряються на належність користувачу;
- endpoint-и мають чинні auth guards.

## Продуктивність

Не допускати N+1:

```text
1 запит на issues
+ окремий запит на кожну серію
+ окремий запит на кожну книгу
```

Допустимо пакетно завантажити:

- релевантні queue items;
- активне читання;
- книги та series relations;
- ignore/preferences;

і виконати детерміноване обчислення у domain/service layer.
