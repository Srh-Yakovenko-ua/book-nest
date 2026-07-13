# Аналіз: оновлення прогресу читання (гілка `dev`)

> Стан на 2026-07-13, гілка `dev`. Read-only аналіз, без змін коду.
>
> Попередня версія цього документа (2026-07-10, гілка `fix/book-details`) описувала
> стан **до** появи журналу подій і рекомендувала append-only лог. Той лог відтоді
> реалізовано (міграція `20260711163000_add_book_reading_progress_events`), тож цей
> документ описує вже новий, поточний стан.

## Коротка відповідь

Працює **і те, і те одночасно** — це дві окремі таблиці:

- **Стан** (`book_reading_progress`) — **один рядок на книгу**, `current_page` **перезатирається** через `upsert`.
- **Історія** (`book_reading_progress_events`) — **журнал append-only**, на кожне просування вперед вставляється **новий рядок**. Нічого не затирається й не групується — за одну дату може бути кілька записів.

Тобто історія всіх оновлень **зберігається** окремо від «останнього значення».

## Дві моделі (`apps/api/prisma/schema.prisma`)

```
BookReadingProgress        (266–283)   bookId @unique  → 1 рядок / книга (overwrite)
  currentPage, startedAt, finishedAt, pausedAt, abandonedAt,
  rating, note, impression, lastProgressUpdateAt

BookReadingProgressEvent   (285–296)   @@index([bookId, date])  → 0..N рядків (журнал)
  date (@db.Date), page, pagesRead, createdAt
```

Ключовий момент: індекс на подіях `(book_id, date)` **не unique** (міграція `20260711163000_add_book_reading_progress_events`, `CREATE INDEX ... _idx`). Це навмисне — таблиця-лог, куди можна класти скільки завгодно записів за один день. Натомість у стані `book_id` має `UNIQUE INDEX` (міграція `20260611085734_book_reading_progress`), тому фізично не може бути двох рядків стану на книгу — це й змушує `upsert` перезаписувати.

## Потік оновлення `POST /api/books/:id/reading-progress`

`BookReadingService.updateReadingProgress` (`apps/api/src/modules/books/application/book-reading.service.ts:92`):

1. Валідація: `currentPage` не більший за `pagesCount` і **не менший за збережений** `currentPage` (регрес назад заборонено) — рядки 99–106.
2. `computeReadingProgressChange` (`apps/api/src/modules/books/domain/reading-progress-transition.ts:24`) рахує patch: ставить `currentPage` + `lastProgressUpdateAt`, і **авто-перехід статусу** — `not_started`/`want_to_read` → `reading` при page > 0, а при `markAsFinished` → `finished` (і page підтягується до `pagesCount`).
3. `buildProgressEvent` (`book-reading.service.ts:130`): `pagesRead = resolvedPage − previousPage`. Якщо `pagesRead <= 0`, подія **не створюється** (`null`). Тобто журналюються лише кроки вперед.
4. `recordReadingProgress` (`apps/api/src/modules/books/infrastructure/books.repository.ts:631`) — **одна транзакція**: `upsert` стану **плюс** `create` події:

```ts
await this.prisma.$transaction(async (tx) => {
  await this.applyReadingChange(...)              // upsert current_page (перезапис)
  if (event !== null) {
    await tx.bookReadingProgressEvent.create({    // APPEND, ніколи не update
      data: { bookId, date, page, pagesRead },
    })
  }
})
```

Оскільки це `create`, а не `upsert`-по-даті, два оновлення в один день дадуть **дві** події.

## Що віддає історія

`GET /api/books/:id/reading-history` → `toReadingHistoryView` (`apps/api/src/modules/books/domain/reading-history.mapper.ts`) повертає:

```
events[]        — всі сирі події (date, page, pagesRead) по порядку
daily[]         — агрегація pagesRead по днях (Map date → сума)
daysRead        — к-сть унікальних днів
totalPagesRead  — сума всіх pagesRead
```

Тобто бек тримає повний журнал **і** дає готову агрегацію по днях (для графіка «сторінок за день»).

## Яку логіку підтримує бек

- **Update progress** (`POST /reading-progress`) — просування вперед з валідацією меж, авто-старт/авто-фініш статусу, запис події в журнал.
- **Change status** (`POST /reading-status`) — ручна зміна статусу (`reading`/`finished`/`paused`/`abandoned`…) з побічними ефектами по датах, `resetProgress`, rating/note/impression. Іде через `applyReadingChange` (лише `upsert` стану, **без** запису події в журнал).
- **Reading history** (`GET /reading-history`) — читання журналу + денна агрегація.
- `markAsFinished` як шорткат: підтягує `currentPage` до `pagesCount` і ставить `finished`.

Контролер: `apps/api/src/modules/books/api/book-reading.controller.ts`.

## Shared DTO (`packages/shared/src/books.ts`)

- `UpdateReadingProgressInputSchema` (214–218): `{ currentPage, markAsFinished?, updateDate? }`.
- `ReadingHistoryEventViewSchema` (911–916): `{ date, id, page, pagesRead }`.
- `ReadingHistoryDayViewSchema` (920–923): `{ date, pagesRead }`.
- `ReadingHistoryViewSchema` (927–932): `{ daily[], daysRead, events[], totalPagesRead }`.

## Стан фронту

Журнал повністю реалізований і виставлений через API (є згенерований хук `useBookReadingControllerGetReadingHistory`), **але жоден рукописний FE-компонент його наразі не споживає**. UI (`apps/web/src/features/books/components/reading-progress-block.tsx`) показує тільки поточний стан з одного рядка (`resolveReadingProgress` → `currentPage`/`percent`) і `lastProgressUpdateAt`.

Дані історії накопичуються на беку, але екрана «історія читання / графік по днях» на фронті ще немає.

## Підсумкова таблиця

| Аспект        | Стан (overwrite)                       | Історія (append-only)                     |
| ------------- | -------------------------------------- | ----------------------------------------- |
| Таблиця       | `book_reading_progress`                | `book_reading_progress_events`            |
| Модель Prisma | `BookReadingProgress`                  | `BookReadingProgressEvent`                |
| Обмеження     | `UNIQUE(book_id)`                      | `INDEX(book_id, date)`, не unique         |
| Запис         | `bookReadingProgress.upsert`           | `bookReadingProgressEvent.create`         |
| Рядків/книга  | рівно 1                                | 0..N (один на кожне просування вперед)    |
| Зберігає      | `current_page`, дати, rating, note     | `date`, `page`, `pages_read` на оновлення |
