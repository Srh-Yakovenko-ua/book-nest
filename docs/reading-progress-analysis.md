# Аналіз: як зараз працює оновлення прогресу читання

> Стан на 2026-07-10. Гілка `fix/book-details`. Read-only аналіз, без змін коду.

## TL;DR

Прогрес **перезатирається** (overwrite), а не накопичується. У БД зберігається **лише один рядок на книгу** з поточним станом. Ані посторінкова історія за кожен день, ані агрегація «скільки сторінок прочитано за день» — **не ведуться взагалі**. Кілька оновлень за один день просто перезаписують одне одного; останнє перемагає.

---

## 1. Модель зберігання

`apps/api/prisma/schema.prisma:265`

```prisma
model BookReadingProgress {
  id                   String    @id @default(uuid()) @db.Uuid
  bookId               String    @unique @map("book_id") @db.Uuid   // одна книга = один рядок
  currentPage          Int?      @map("current_page")
  startedAt            DateTime? @map("started_at") @db.Date
  finishedAt           DateTime? @map("finished_at") @db.Date
  pausedAt             DateTime? @map("paused_at") @db.Date
  abandonedAt          DateTime? @map("abandoned_at") @db.Date
  rating               Float?
  note                 String?
  impression           String?
  lastProgressUpdateAt DateTime? @map("last_progress_update_at") @db.Date  // дата, без часу
  createdAt            DateTime  @default(now()) @db.Timestamptz
  updatedAt            DateTime  @updatedAt @db.Timestamptz
  book                 Book      @relation(fields: [bookId], references: [id], onDelete: Cascade)
  @@map("book_reading_progress")
}
```

Ключове:

- `bookId @unique` → зв'язок `Book ⇄ BookReadingProgress` **1:1**. Фізично неможливо мати два записи прогресу для однієї книги.
- `currentPage` — це **абсолютна позиція-курсор** (на якій сторінці ти зараз), а **не** «кількість прочитаних сторінок». Дельта «+30 сторінок сьогодні» ніде не рахується й не зберігається.
- `lastProgressUpdateAt` — тип `@db.Date` (тільки дата, без часу). Це «дата останнього оновлення», яку щоразу перезаписують.
- Окремої таблиці reading-session / daily-log / history **немає**. Перевірено всі 27 моделей схеми — прогресу стосується рівно одна: `BookReadingProgress`. Моделі зі словами session/history/log (`Session`, `ChangelogEntry`, `ChangelogRead`) до читання не мають стосунку.

## 2. Шлях запиту

```
POST /api/books/:id/reading-progress
  → BookReadingController.updateReadingProgress      (api/book-reading.controller.ts:72)
  → BookReadingService.updateReadingProgress         (application/book-reading.service.ts:76)
  → computeReadingProgressChange                     (domain/reading-progress-transition.ts:24)
  → BooksRepository.applyReadingChange               (infrastructure/books.repository.ts:283)
```

**Вхідний DTO** (`packages/shared/src/books.ts:214`):

```ts
export const UpdateReadingProgressInputSchema = z.object({
  currentPage: ReadingCurrentPageSchema,
  markAsFinished: z.boolean().optional(),
  updateDate: notInFutureDate("Update date must not be in the future").optional(),
});
```

**Сервіс** (`book-reading.service.ts:76`) валідує:

- `currentPage > pagesCount` → 422 (`PAGE_EXCEEDS_PAGES_MESSAGE`) — не можна більше за обсяг книги;
- `currentPage < existingPage` → 422 (`PAGE_BELOW_PROGRESS_MESSAGE`) — **прогрес не можна зменшити**, лише вперед.

**Доменна логіка** (`reading-progress-transition.ts:24`) будує patch:

```ts
progress.currentPage = resolvedPage; // нове абсолютне значення (або pagesCount при markAsFinished)
progress.lastProgressUpdateAt = date; // з updateDate або сьогодні
// авто-переходи статусу:
//   not_started/want_to_read + page>0 → "reading" (+ startedAt = existing ?? date)
//   markAsFinished                    → "finished" (+ finishedAt = date, currentPage = pagesCount)
```

## 3. Як саме пишеться в БД

`apps/api/src/modules/books/infrastructure/books.repository.ts:307`

```ts
await client.bookReadingProgress.upsert({
  create: { ...patch.progress, bookId },
  update: patch.progress, // ← UPDATE перезаписує current_page і last_progress_update_at
  where: { bookId },
});
```

`upsert` по унікальному `bookId`: якщо рядок є — **UPDATE перезаписує** поля; якщо нема — створює. Усе загорнуто в `$transaction` разом з можливим оновленням `book.readingStatus` (атомарність статусу і прогресу).

---

## 4. Прямі відповіді на поставлені питання

| Питання                                                      | Відповідь                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Перезатираються дані чи зберігаються за кожен окремий день?  | **Перезатираються.** Один рядок на книгу, історії днів немає.                                                                                 |
| Агрегуються сторінки за день при кількох оновленнях на день? | **Ні.** Кожне оновлення просто перезаписує `currentPage`. Останній виклик за день = фінальне значення. Дельти не рахуються.                   |
| Що взагалі зберігається?                                     | Лише **поточний стан**: абсолютна сторінка-курсор, дати старту/завершення/паузи/відмови, дата останнього оновлення, рейтинг/нотатка/враження. |

## 5. Наслідки для продукту

З поточною схемою **неможливо** побудувати без зміни моделі даних:

- графік «сторінок за день»;
- reading-streak (серії днів читання);
- статистику темпу читання (сторінок/день, прогноз дати завершення);
- історію «коли на якій сторінці був».

Причина одна: зберігається лише останній зріз, а не події. Кожне оновлення знищує попередній стан безповоротно.

## 6. Рекомендація

Перейти на патерн **append-only журнал подій + похідний поточний стан**:

- нова таблиця-журнал `book_reading_events` — рядок на кожне оновлення прогресу (`bookId`, `page`, `pagesDelta`, `occurredAt`);
- `BookReadingProgress` лишити як денормалізований «поточний стан» (швидке читання для картки книги);
- денні/тижневі агрегати рахувати **на читанні** через `GROUP BY occurred_at SUM(pages_delta)` — сирі події лишаються джерелом правди, з них можна вивести будь-яку статистику пізніше.

Детальний план впровадження та бриф для backend-інженера: [`docs/prompts/reading-progress-journal-plan.md`](./prompts/reading-progress-journal-plan.md).
