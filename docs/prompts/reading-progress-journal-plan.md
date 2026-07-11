# План + бриф: журнал подій прогресу читання (append-only)

> Контекст-аналіз поточної (перезаписуваної) логіки: [`docs/reading-progress-analysis.md`](../reading-progress-analysis.md).
> Ціль: перестати безповоротно затирати прогрес; зберігати кожне оновлення як подію, щоб можна було рахувати «сторінок за день», streak, темп читання. Патерн — **append-only журнал + похідний поточний стан**.

---

## Чому саме так (для розуміння, не для копіювання в код)

Зараз `BookReadingProgress` — це «останній зріз»: кожен `upsert` знищує попереднє значення `current_page`. Це як тримати в Zustand лише останнє значення без історії — намалювати графік змін уже неможливо.

Рішення — розділити дві різні відповідальності, які помилково злиті в одну таблицю:

1. **Події** (`book_reading_events`) — незмінний журнал фактів «такого-то дня дочитав до сторінки N». Append-only: тільки INSERT, ніколи UPDATE/DELETE у нормальному потоці. Джерело правди.
2. **Поточний стан** (`BookReadingProgress`) — денормалізований кеш останньої позиції для швидкого рендеру картки книги. Похідне від журналу.

Денні агрегати рахуємо **на читанні** (`GROUP BY occurred_at SUM(pages_delta)`), а не на записі — щоб не хардкодити гранулярність (день/тиждень/місяць) у схему. FE-аналогія: журнал = нормалізований server-state, агрегат = селектор поверх нього.

---

## Рішення, які треба свідомо ухвалити ПЕРЕД кодом

Ці пункти визначають скоуп. За замовчуванням бери рекомендацію, але познач у PR, що обрав.

1. **Гранулярність `occurredAt`** — тип `@db.Date` (день), як у решті полів прогресу. `currentPage` не має часу читання, лише дату. **Рекомендація: Date.** (Не Timestamptz — не вигадуємо точність, якої немає у вводі.)
2. **Дельта може бути 0?** Подію створюємо **лише коли `pagesDelta > 0`**. Повторний сейв тієї самої сторінки або `markAsFinished`, коли вже на останній сторінці, — не породжує подію (нуль прочитаних сторінок = не факт читання). **Рекомендація: пропускати нульові дельти.**
3. **Кілька оновлень за день** — зберігаємо **кожну подію окремо** (append-only, без merge на записі). Денний підсумок = сума дельт за `occurred_at`. Це навмисно: сира історія цінніша за передчасну агрегацію. (Якщо колись знадобиться «одна подія на день» — це буде окремий read-агрегат, не зміна запису.)
4. **Backfill існуючих даних** — у БД вже є рядки `BookReadingProgress` з `current_page > 0`, але без жодної події. Треба **засіяти по одній синтетичній події** на кожен такий рядок, щоб наявний прогрес не випав зі статистики: `page = current_page`, `pages_delta = current_page`, `occurred_at = COALESCE(last_progress_update_at, started_at, finished_at, created_at::date)`. **Рекомендація: робити backfill у тій самій міграції** (data-migration частина). Познач у `migration-reviewer`, що це навмисний INSERT-backfill, не втрата даних.
5. **Денормалізувати `userId` на подію?** Book уже має `userId`; для per-book статистики достатньо join. Глобальна статистика по всій бібліотеці користувача — ще не існуюча фіча. За правилом «не скафолдити наперед» (CLAUDE.md §15) — **НЕ денормалізувати зараз**, лишити `bookId` + join. Познач як свідоме рішення.
6. **Read-endpoint зараз чи потім?** Journal-запис (пункти нижче) потрібен негайно — інакше дані втрачаються далі. Read-endpoint для денної статистики додаємо **лише якщо FE вже його споживатиме в цій ітерації**. Якщо FE ще не готовий — обмежитись записом журналу + тестами, endpoint окремим PR. **Уточни у мене, чи FE-графік уже в роботі.**

---

## Скоуп (канонічний workflow додавання ендпоінта, CLAUDE.md §5)

### 1. Shared DTO — `packages/shared/src/books.ts`

Нічого не змінюємо у `UpdateReadingProgressInputSchema` (вхід той самий: `currentPage`, `markAsFinished?`, `updateDate?`).

Якщо робимо read-endpoint (рішення №6) — додати схему відповіді денної статистики, напр.:

```ts
export const ReadingDailyStatSchema = z.object({
  date: z.string(), // ISO date
  pagesRead: z.number().int().nonnegative(),
  endPage: z.number().int().nonnegative(),
});
export const ReadingHistorySchema = z.object({
  bookId: z.string().uuid(),
  totalPagesRead: z.number().int().nonnegative(),
  days: z.array(ReadingDailyStatSchema),
});
export type ReadingHistory = z.infer<typeof ReadingHistorySchema>;
```

Якщо read-endpoint відкладаємо — цей крок пропустити.

### 2. Prisma-модель — `apps/api/prisma/schema.prisma`

Додати нову модель поряд з `BookReadingProgress`:

```prisma
model BookReadingEvent {
  id         String   @id @default(uuid()) @db.Uuid
  bookId     String   @map("book_id") @db.Uuid
  page       Int                                      // абсолютна позиція ПІСЛЯ події
  pagesDelta Int      @map("pages_delta")             // прочитано в цій події (page - попередній page)
  occurredAt DateTime @map("occurred_at") @db.Date    // день, за який зараховуємо читання
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  book       Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@index([bookId, occurredAt])
  @@map("book_reading_events")
}
```

І зустрічне поле в `model Book`:

```prisma
readingEvents BookReadingEvent[]
```

Зверни увагу: `onDelete: Cascade` — при видаленні книги журнал теж чиститься (як і `BookReadingProgress`). Індекс `[bookId, occurredAt]` — під агрегаційний запит `GROUP BY occurred_at`.

### 3. Міграція — ДВОКРОКОВИЙ flow (CLAUDE.md §5.3, ніколи не one-shot)

```bash
pnpm --filter @app/api db:migrate --name add_book_reading_events   # create-only, НЕ застосовує
```

Далі **вручну**:

- **Перевірити `migration.sql`** через агента `migration-reviewer` (обовʼязково).
- **Прибрати spurious `DROP INDEX`** для чотирьох raw-SQL індексів (пастка з CLAUDE.md §5.3: `authors_search_text_trgm_idx`, `publishers_search_text_trgm_idx`, `book_deliveries_active_book_idx`, `book_loans_active_book_idx`) — Prisma їх не бачить і намагатиметься дропнути.
- **Дописати data-migration (backfill, рішення №4)** у ту саму `migration.sql`, після `CREATE TABLE`:

```sql
INSERT INTO book_reading_events (id, book_id, page, pages_delta, occurred_at, created_at)
SELECT gen_random_uuid(),
       book_id,
       current_page,
       current_page,
       COALESCE(last_progress_update_at, started_at, finished_at, created_at::date),
       now()
FROM book_reading_progress
WHERE current_page IS NOT NULL AND current_page > 0;
```

- Застосувати: `pnpm --filter @app/api db:migrate:deploy` (non-interactive).
- **Ніколи** `prisma migrate dev` без `--name` і **ніколи** `db push`.

### 4. Repository — `apps/api/src/modules/books/infrastructure/books.repository.ts`

Розширити існуючий `applyReadingChange`, а не робити окремий шлях запису — щоб подія, `upsert` прогресу і зміна `book.readingStatus` лишались **в одній транзакції** (атомарність зберігається).

- Додати в тип `ReadingChangePatch` опціональне поле події:

```ts
export type ReadingEventData = { page: number; pagesDelta: number; occurredAt: Date };

export type ReadingChangePatch = {
  book: Nullable<{ readingStatus?: ReadingStatus }>;
  progress: Partial<CreateReadingProgressData>;
  event: Nullable<ReadingEventData>; // NEW
};
```

- У `applyReadingChange`, всередині наявної транзакції, після `bookReadingProgress.upsert`:

```ts
if (patch.event !== null) {
  await client.bookReadingEvent.create({ data: { ...patch.event, bookId } });
}
```

- Додати read-метод для агрегації (якщо робимо endpoint, рішення №6). Групування на боці БД:

```ts
findDailyReadingStats(bookId: string): Promise<{ occurredAt: Date; pagesRead: number; endPage: number }[]> {
  return this.prisma.bookReadingEvent.groupBy({
    by: ["occurredAt"],
    where: { bookId },
    _sum: { pagesDelta: true },
    _max: { page: true },
    orderBy: { occurredAt: "asc" },
  }).then(/* map _sum/_max у плаский тип */);
}
```

Репозиторій повертає rows/примітиви — **не** ViewModel (мапінг у сервісі).

**Не** створювати `event` у місцях, де інші patch-и вже викликають `applyReadingChange` (напр. `changeReadingStatus`, `startReading`), якщо не хочемо там журналити — за замовчуванням `event: null` для них. Обговорити: чи `changeReadingStatus` з `currentPage` теж має породжувати подію (логічно — так, якщо сторінка зросла). **Рекомендація: так, обчислювати подію в обох сервісних шляхах через спільну доменну функцію.**

### 5. Domain — `apps/api/src/modules/books/domain/reading-progress-transition.ts`

`computeReadingProgressChange` тепер має ще й повертати `event`. Дельту рахуємо від попередньої збереженої сторінки, яку сервіс уже читає (`book.readingProgress?.currentPage ?? 0`) — додати її у вхід трансформації:

```ts
export type ReadingProgressTransitionInput = {
  currentPage: number;
  currentStatus: ReadingStatus;
  existingPage: number; // NEW: попередня збережена сторінка (?? 0)
  existingStartedAt: Nullable<Date>;
  markAsFinished?: boolean;
  pagesCount: Nullable<number>;
  updateDate: string;
};
```

Логіка дельти:

```ts
const pagesDelta = resolvedPage - input.existingPage;   // валідація в сервісі гарантує >= 0
const event = pagesDelta > 0
  ? { page: resolvedPage, pagesDelta, occurredAt: date }
  : null;
return { book: ..., progress: ..., event };
```

Оновити повернення функції під новий `ReadingChangePatch` (додати `event`). Тримати чистою (без Prisma, без `req`).

### 6. Service — `apps/api/src/modules/books/application/book-reading.service.ts`

- У `updateReadingProgress` передати `existingPage: book.readingProgress?.currentPage ?? 0` у `computeReadingProgressChange`. Валідація «не можна назад» уже є (`PAGE_BELOW_PROGRESS_MESSAGE`) — вона гарантує `pagesDelta >= 0`.
- Якщо `changeReadingStatus`/`startReading` теж мають журналити (див. 4) — прокинути туди `existingPage` і збирати `event` тією ж доменною функцією. Інакше явно передавати `event: null`.
- Якщо робимо read-endpoint: новий метод `getReadingHistory(userId, bookId): Promise<ReadingHistory>` — перевірити власність (`findOwnedByIdOrThrow`), викликати `repo.findDailyReadingStats`, змапити у `ReadingHistorySchema`. Кидати `HttpError`-підкласи з `core/exceptions`.

### 7. Input/Output DTO + Controller (тільки якщо робимо read-endpoint, рішення №6)

- `api/view-dto/reading-history.view-dto.ts` через `createZodDto(ReadingHistorySchema)`.
- `GET /api/books/:id/reading-history` у `BookReadingController` — `@UseGuards(JwtAccessGuard)`, `ParseUUIDPipe`, повний `@Api*` Swagger, віддає `ReadingHistory`.
- Запис журналу (кроки 2–6) НЕ додає нового write-endpoint — використовує наявний `POST :id/reading-progress`.

### 8. Тести (делегувати `backend-test-engineer`)

- **Domain** (`reading-progress-transition.test.ts`): додати кейси — `pagesDelta` рахується правильно; нульова дельта → `event === null`; `markAsFinished` при `existingPage < pagesCount` → подія з дельтою до кінця; при `existingPage === pagesCount` → без події.
- **Service** (`book-reading.service.test.ts`): `updateReadingProgress` двічі за один день → **дві** події, поточний стан = останній; спадна сторінка досі 422; `markAsFinished` створює подію + статус finished.
- **Repository/controller integration** (`createTestApp`): подія реально інсертиться в одній транзакції з `upsert`; при 422 (сторінка < збереженої) **жодної** події не створено (rollback/none); read-endpoint (якщо є) повертає денні агрегати у правильному порядку.
- **Backfill**: (мінімум) інтеграційний тест, що після наявного прогресу без подій `findDailyReadingStats` дає осмислений результат — або окремо задокументувати ручну перевірку backfill на seed-даних.

---

## Quality gates (усі мають пройти перед «done», CLAUDE.md §8)

```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm knip
```

BE-специфічно:

- `pnpm dev:api` стартує чисто;
- `curl -i http://localhost:4000/api/health` → 200 + `x-request-id`;
- прогнати сценарій руками через curl:
  - `POST /api/books/:id/reading-progress {currentPage: 30, updateDate: "2026-07-10"}` → 200;
  - той самий книжковий id, `{currentPage: 55, updateDate: "2026-07-10"}` → 200;
  - перевірити в БД: **дві** події (`pages_delta` 30 і 25) з `occurred_at = 2026-07-10`, а `book_reading_progress.current_page = 55`. Захопити вивід.

---

## Обмеження скоупу (щоб не розповзлось)

- **Не** чіпати FE у цьому завданні (запис журналу — суто BE; графік/UI — окремий frontend-engineer тікет після того, як read-endpoint готовий).
- **Не** денормалізувати `userId`, **не** додавати глобальну статистику по бібліотеці, **не** робити тижневі/місячні агрегати наперед (рішення №5, CLAUDE.md §15 — не скафолдити roadmap).
- **Не** видаляти/змінювати наявні поля `BookReadingProgress` — вона лишається джерелом «поточного стану».
- Дотримати шаруватість (CLAUDE.md §7.8): Prisma лише в repository; сервіс без `req/res` і без `PrismaService`; repository не повертає ViewModel; помилки — підкласи `HttpError`.

## Що повернути після виконання

1. Список змінених/створених файлів.
2. Фінальний `migration.sql` (з backfill і без spurious `DROP INDEX`) + вердикт `migration-reviewer`.
3. Вивід curl-сценарію вище (дві події + поточний стан).
4. Результат усіх quality gates.
5. Явно: які з «Рішень» (№1–6) обрано, і чи зроблено read-endpoint у цій ітерації.
