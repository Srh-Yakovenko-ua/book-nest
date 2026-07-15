# 08. Фронтенд: стани, edge cases, i18n та accessibility

> Містить розділи 31–37: loading/error/empty, оновлення після mutation, локалізацію, accessibility та analytics.

## 31. Loading state

Показати skeleton:

- заголовка;
- трьох рядків серій;
- обкладинок;
- тексту;
- кнопок.

Не показувати стрибок висоти блока після завантаження.

---

## 32. Error state

Компактний стан:

```text
Не вдалося завантажити продовження серій
```

Кнопка:

```text
Спробувати ще раз
```

Не ламати всю сторінку «Улюблені книги» через помилку одного sidebar endpoint.

---

## 33. Empty states

### 33.1. Немає улюблених книг у серіях

```text
Серед улюблених поки немає книг із серій
```

### 33.2. Усі релевантні серії завершено

```text
Усі улюблені серії вже завершено
```

Підтекст:

```text
Наступні книги з’являться тут, коли буде що продовжити
```

### 33.3. Є улюблені книги, але порядок серій не визначено

Не показувати технічну помилку користувачу.

Можна показати загальний empty state:

```text
Поки немає серій, які можна продовжити
```

Проблему порядку логувати для розробників.

### 33.4. Усі наступні книги мають `NONE` або `WANT_TO_BUY`

Блок все одно показується.

Це важливий кейс: він допомагає зрозуміти, які книги потрібно придбати.

---

## 34. Frontend edge cases

### 34.1. Одна серія

Показати один item. Не заповнювати блок випадковими даними.

### 34.2. Більше трьох серій

Показати перші три за backend ranking.

### 34.3. Зміна ownership через CTA

Оновити item без повного reload сторінки:

- optimistic update, якщо безпечно;
- або invalidation/refetch.

### 34.4. Книга перестала бути улюбленою

Якщо це була остання улюблена книга серії, серія має зникнути після refetch.

### 34.5. Книга завершена

Після зміни на `finished`:

- backend має повернути наступну актуальну книгу цієї ж серії;
- якщо серію завершено — item зникає;
- порядок інших items може змінитися.

### 34.6. Книга позначена DNF

За рекомендованою логікою:

- поточна книга закривається;
- блок переходить до наступної книги серії.

### 34.7. Книгу прибрали із серії

Після invalidation backend перераховує результат.

### 34.8. Серію видалено

Item зникає.

### 34.9. Немає обкладинки

Показати стандартний placeholder книги.

### 34.10. Немає автора

Не показувати порожній рядок.

### 34.11. Довга локалізація

Кнопка й layout не повинні ламатися англійською або українською.

---

## 35. Локалізація

Усі тексти мають бути в i18n.

Приблизні ключі:

```text
favorites.seriesContinuations.title
favorites.seriesContinuations.subtitle
favorites.seriesContinuations.viewAll
favorites.seriesContinuations.empty.noSeries
favorites.seriesContinuations.empty.completed
favorites.seriesContinuations.empty.noContinuations
favorites.seriesContinuations.error
favorites.seriesContinuations.retry
favorites.seriesContinuations.bookPosition
favorites.seriesContinuations.progress
favorites.seriesContinuations.actions.continueReading
favorites.seriesContinuations.actions.resumeReading
favorites.seriesContinuations.actions.addToQueue
favorites.seriesContinuations.actions.openQueue
favorites.seriesContinuations.actions.openLoan
favorites.seriesContinuations.actions.openOrder
favorites.seriesContinuations.actions.openWishlist
favorites.seriesContinuations.actions.addToWishlist
favorites.seriesContinuations.actions.openBook
```

Pluralization для книг використовувати через наявну i18n/pluralization-логіку.

---

## 36. Accessibility

- Усі кнопки доступні з клавіатури.
- Обкладинка має коректний `alt`.
- Chip не є єдиним джерелом інформації про статус.
- Focus state відповідає проєкту.
- Tooltip не є єдиним способом прочитати важливу інформацію.
- Клік на всю картку не повинен конфліктувати з внутрішніми кнопками.
- Для кнопок-іконок потрібні `aria-label`.

---

## 37. Аналітика подій

Додавати лише якщо в проєкті вже є analytics.

Можливі події:

```text
favorite_series_continuation_viewed
favorite_series_continuation_book_opened
favorite_series_continuation_action_clicked
favorite_series_continuation_view_all_clicked
```

Параметри:

```text
seriesId
bookId
readingStatus
ownershipStatus
rankReason
positionInBlock
```

Не передавати персональні тексти нотаток або інші чутливі дані.

---
