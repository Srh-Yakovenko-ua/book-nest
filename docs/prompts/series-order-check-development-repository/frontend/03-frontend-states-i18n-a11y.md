# Frontend: стани, помилки, i18n та accessibility

## Loading

Показати skeleton із фіксованою приблизною висотою:

- header;
- count;
- 3 issue cards;
- текст;
- кнопки.

Не допускати сильного layout shift.

## Empty

Для повного view:

```text
Порядок серій перевірено
У черзі не знайдено порушень порядку.
```

Для компактного sidebar допустимо приховати весь блок або показати короткий success state відповідно до чинного патерну сторінки.

## Error loading issues

```text
Не вдалося перевірити порядок серій
```

CTA:

```text
Спробувати ще раз
```

Помилка блока не повинна ламати всю сторінку Черги читання.

## Mutation errors

### `409 QUEUE_STALE`

```text
Черга змінилася. Онови дані й перевір порядок ще раз.
```

Закрити або оновити preview після refetch.

### `409 ISSUE_STALE`

```text
Ця проблема вже змінилася. Перевір оновлений порядок.
```

### `409 ALREADY_IN_QUEUE`

```text
Книга вже є в черзі.
```

Виконати refetch, не залишати UI у broken state.

### `422 QUEUE_LIMIT_REACHED`

```text
Не вдалося додати книги: досягнуто ліміт черги.
```

### `404`

```text
Книгу або серію більше не знайдено.
```

### `403`

```text
Немає доступу до цієї книги або серії.
```

## Рекомендовані i18n namespaces

```text
readingQueue.seriesOrderCheck.title
readingQueue.seriesOrderCheck.subtitle
readingQueue.seriesOrderCheck.viewAll
readingQueue.seriesOrderCheck.empty.title
readingQueue.seriesOrderCheck.empty.description
readingQueue.seriesOrderCheck.error.load
readingQueue.seriesOrderCheck.error.queueStale
readingQueue.seriesOrderCheck.error.issueStale
readingQueue.seriesOrderCheck.error.queueLimit
readingQueue.seriesOrderCheck.error.alreadyInQueue
readingQueue.seriesOrderCheck.actions.retry
readingQueue.seriesOrderCheck.actions.fixOrder
readingQueue.seriesOrderCheck.actions.addBefore
readingQueue.seriesOrderCheck.actions.addNext
readingQueue.seriesOrderCheck.actions.addAll
readingQueue.seriesOrderCheck.actions.openBook
readingQueue.seriesOrderCheck.actions.resumeBook
readingQueue.seriesOrderCheck.actions.addToWishlist
readingQueue.seriesOrderCheck.actions.openPurchase
readingQueue.seriesOrderCheck.actions.openOrder
readingQueue.seriesOrderCheck.actions.openLoan
readingQueue.seriesOrderCheck.actions.ignore
readingQueue.seriesOrderCheck.actions.disableSeries
readingQueue.seriesOrderCheck.preview.title
readingQueue.seriesOrderCheck.preview.current
readingQueue.seriesOrderCheck.preview.recommended
readingQueue.seriesOrderCheck.success.fixed
readingQueue.seriesOrderCheck.success.ignored
readingQueue.seriesOrderCheck.success.disabled
```

Додати окремі ключі для кожного `problemType` та pluralization незакритих книг.

## Accessibility

- Усі дії доступні клавіатурою.
- Кнопки-іконки мають `aria-label`.
- Severity не передається лише кольором.
- Модалка має focus trap.
- Після закриття focus повертається на trigger.
- Після успішного reorder focus переходить на релевантну книгу або live-region повідомлення.
- Snackbar/success/error повідомлення доступні screen reader.
- Клік на картку не конфліктує з внутрішніми кнопками.
- Current і recommended order мають зрозумілу текстову структуру, а не лише візуальні стрілки.

## Responsive

На вузьких екранах:

- кнопки можуть переходити в колонку;
- preview order не виходить за межі;
- довгі назви обрізаються;
- модалка скролиться всередині;
- primary action залишається доступною без горизонтального скролу.
