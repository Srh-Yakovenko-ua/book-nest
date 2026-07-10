# Задача (backend): додати `impression` у флоу «зміна статусу читання»

**Навіщо.** Модалка «Змінити статус читання» на сторінці деталей ходить у ендпоінт `changeReadingStatus` з контрактом `ChangeReadingStatusInputSchema`, і цей контракт зараз приймає `status/date/currentPage/note/rating/resetProgress` — **без `impression`**. Форма створення/редагування книги зберігає враження через _інший_ флоу (`ReadingProgressInputSchema`), тому там воно є, а в зміні статусу — ні. Треба, щоб при переведенні книги в `finished` через модалку можна було задати/оновити враження.

**Міграції не треба** — колонка `book_reading_progress.impression` уже існує, і репозиторій уже вміє її persist-ити: тип `CreateReadingProgressData` містить `impression` (`apps/api/src/modules/books/infrastructure/books.repository.ts:82`).

## 1. Контракт (shared)

`packages/shared/src/books.ts`, у `ChangeReadingStatusInputSchema` додати поле:

```ts
impression: ReadingImpressionSchema.nullable().optional(),
```

`ReadingImpressionSchema` уже визначена в цьому ж файлі (`string` → `collapseHorizontalSpaces` → `NoHtmlString.max(5000)`). Порядок полів — за наявним стилем (алфавітний).

## 2. Домен

`apps/api/src/modules/books/domain/reading-status-transition.ts`, `computeReadingStatusChange`. **Дзеркалити логіку `rating`:**

- у `ReadingStatusTransitionInput` додати `impression?: null | string;`
- `case "finished"`:
  ```ts
  if (input.impression !== undefined) {
    progress.impression = input.impression;
  }
  ```
- `case "not_started"` / `"want_to_read"` (у блоці `if (input.hasExistingProgress)`, поряд зі скиданням `rating`/`note`):
  ```ts
  progress.impression = null;
  ```
- решта статусів (`reading` / `rereading` / `paused` / `dnf`) — impression **не чіпати** (так само як `rating`).

## 3. Сервіс

`apps/api/src/modules/books/application/book-reading.service.ts`, у `changeReadingStatus` пробросити поле в перехід:

```ts
const patch = computeReadingStatusChange({
  // …решта полів без змін…
  impression: input.impression,
  note: input.note,
  // …
});
```

## 4. Тести

- домен `reading-status-transition.test.ts`:
  - `finished` + `impression` → `progress.impression` дорівнює вхідному;
  - `not_started` / `want_to_read` з наявним прогресом → `progress.impression === null`;
  - не-`finished` / не-reset статус — impression без змін.
- контролер/сервіс: `changeReadingStatus` з `impression` → значення round-trip-иться у `BookView.readingProgress.impression`.

## Не чіпати

- Флоу створення/редагування книги.
- Схему БД / міграції.
- Репозиторій (persist уже є).

## Після беку (робить фронтенд)

Коли контракт змержено — на фронті додається сам інпут «Враження» в модалці `change-reading-status-dialog.tsx` для статусу `finished`, за зразком форми створення: `<Textarea maxLength={5000}>` + лічильник `/5000`, поле в `ChangeStatusValues` / `fieldsFor("finished")` / `buildPayload`.
