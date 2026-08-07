# Backend — читацькі цілі

Реалізація серверної частини фічі. Рішення — у [`README.md`](./README.md).

## Межі

- Новий модуль `apps/api/src/modules/reading-goals/**` за шаблоном feature-sliced
  (`api / application / domain / infrastructure`). **Не розмазувати цілі по модулю `books`.**
- **Одна міграція**, двокроково: `db:migrate --name add_reading_goals` (create-only) → рев'ю →
  `db:migrate:deploy`. Ніколи `db push`.
- Шари сакральні: Prisma лише в репозиторії, обчислення в домені, контролер валідує й делегує.
- Усі дати — через `date-fns`. Жодного `getTime()`, жодних `24*60*60*1000`, жодних мутаторів
  (`setHours`, `setDate`). `startOfDay`, `isAfter`, `isBefore` — і все.
- Не чіпати `apps/web/**`.

---

# 1. Модель

```prisma
model ReadingGoal {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  listId      String?   @map("list_id") @db.Uuid
  name        String?
  targetCount Int       @map("target_count")
  deadline    DateTime  @db.Date
  archivedAt  DateTime? @map("archived_at") @db.Timestamptz
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  list        BookList? @relation(fields: [listId], references: [id], onDelete: Cascade)

  @@index([userId, archivedAt])
  @@map("reading_goals")
}
```

Зворотний зв'язок додати в `User` (`readingGoals ReadingGoal[]`) і в `BookList`
(`readingGoals ReadingGoal[]`).

## Чому саме так

- **`listId` nullable попри те, що зараз цілі бувають тільки за списком.** Nullable-колонка
  коштує нічого, а додати загальні цілі пізніше без міграції — коштує багато. `NOT NULL` тут був
  би передчасним звуженням.
- **`deadline` — `@db.Date`, не timestamptz.** «До 30 листопада» — це календарний день, а не мить.
  Timestamptz змусив би вирішувати, у чиєму часовому поясі настає північ, і породив би
  «дедлайн уже минув» для користувача, у якого ще вчора.
- **Немає колонки `status`.** Статус похідний від прогресу й дати, а похідне поле в БД — це поле,
  яке рано чи пізно розійдеться з правдою. Зберігається лише `archivedAt` — єдина частина стану,
  яку користувач задає явно.
- **Немає `completedAt`.** Дата виконання — це `finishedAt` тієї книги, що закрила ціль; вона вже є
  в `BookReadingProgress` і обчислюється разом із прогресом.
- **`onDelete: Cascade` на `listId`.** Purge списку не має лишати сиріт. Soft-delete списку ціль
  **не чіпає взагалі** — тоді відновлення списку повертає й ціль безкоштовно.

## Частковий унікальний індекс — руками в міграції

Prisma не виражає предикат у `model`, тому індекс пишеться в `migration.sql` руками:

```sql
CREATE UNIQUE INDEX "reading_goals_active_list_idx"
  ON "reading_goals" ("list_id")
  WHERE "archived_at" IS NULL AND "list_id" IS NOT NULL;
```

Інваріант: **не більше однієї неархівованої цілі на список**. Сервісна перевірка «а чи вже є
активна» без індексу програє гонці подвійного сабміту — індекс тут не оптимізація, а замок.

### Три обов'язкові дії навколо цього індексу

1. Додати його в `apps/api/src/core/database/raw-sql-indexes.test.ts` — тест зараз стверджує, що
   існує **девʼять** raw-SQL-індексів; стане **десять**.
2. Оновити `CLAUDE.md` §6 (розділ «Raw-SQL-index trap»): перелік і слово «Nine» → «Ten».
3. Пам'ятати сам trap: індексу немає в `schema.prisma`, тому **кожна наступна міграція** генеруватиме
   для нього паразитний `DROP INDEX`. Ці рядки треба вирізати руками **перед** `db:migrate:deploy`.

## Рев'ю міграції

Делегувати `migration-reviewer`. Очікувана класифікація: `CREATE TABLE` + `CREATE INDEX` на порожній
таблиці — **SAFE**, блокувань немає, форвард-онлі відкатність тривіальна (`DROP TABLE`).

## Новий клас advisory-lock

`apps/api/src/core/database/advisory-lock.ts`:

```ts
readingGoals: 14,
```

---

# 2. Контракти

`packages/shared/src/reading-goals.ts` (новий файл, підключити в барель `src/index.ts`).

```ts
export const READING_GOAL_NAME_MAX = 120;
export const READING_GOAL_TARGET_MAX = 1000;

export const ReadingGoalStatusSchema = z.enum(["active", "completed", "expired", "archived"]);

export type ReadingGoalStatus = z.infer<typeof ReadingGoalStatusSchema>;

export const CreateReadingGoalInputSchema = z.object({
  deadline: z.iso.date(),
  name: z
    .string()
    .transform(collapseSpaces)
    .pipe(NoHtmlString.max(READING_GOAL_NAME_MAX))
    .optional(),
  targetCount: z.number().int().min(1).max(READING_GOAL_TARGET_MAX),
});

export const ReadingGoalViewSchema = z.object({
  completedAt: z.string().nullable(),
  completedCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  daysLeft: z.number().int().nullable(),
  deadline: z.iso.date(),
  id: z.string(),
  list: z.object({ id: z.string(), name: z.string() }).nullable(),
  name: z.string().nullable(),
  remainingCount: z.number().int().nonnegative(),
  status: ReadingGoalStatusSchema,
  targetCount: z.number().int().positive(),
});

export const ReadingGoalBookSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable(),
  finishedAt: z.iso.date(),
  id: z.string(),
  title: z.string(),
});

export const ReadingGoalDetailSchema = ReadingGoalViewSchema.extend({
  countedBooks: z.array(ReadingGoalBookSchema),
  listBookCount: z.number().int().nonnegative(),
});
```

`ReadingGoalView` — для блока в правому барі (дешевий, без книг).
`ReadingGoalDetail` — для сторінки `/goals/:id`.

`countedBooks` — книги, які **вже зараховані**, у порядку `finishedAt ASC`, ліміт `100` з
`log.warn` при перевищенні. Без них сторінка цілі — це самотнє число.

---

# 3. Ендпоїнти

Модуль `reading-goals`, контролер `@Controller("api")` з явними шляхами (частина маршрутів висить
на списку, частина — на цілі).

| Метод    | Шлях                         | Тіло / відповідь                                                                     |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| `POST`   | `/api/lists/:listId/goal`    | `CreateReadingGoalInput` → `201 ReadingGoalView`                                     |
| `GET`    | `/api/lists/:listId/goal`    | → `200 ReadingGoalView` або `204` (цілі немає)                                       |
| `GET`    | `/api/goals/:goalId`         | → `200 ReadingGoalDetail`                                                            |
| `PATCH`  | `/api/goals/:goalId`         | `UpdateReadingGoalInput` (`name`, `targetCount`, `deadline`) → `200 ReadingGoalView` |
| `POST`   | `/api/goals/:goalId/archive` | → `200 ReadingGoalView`                                                              |
| `DELETE` | `/api/goals/:goalId`         | → `204`                                                                              |

- Усе під `@JwtProtected()`; `MUTATION_THROTTLE` на мутації, `READ_THROTTLE` на читання.
- Володіння списком — через `listsService.assertOwned`; володіння ціллю — по `userId` у `where`.
- Чужий або неіснуючий ресурс — завжди `404`, ніколи `403`: інакше ендпоїнт підтверджує існування
  чужих даних.
- `GET /api/lists/:listId/goal` повертає `204 No Content`, коли неархівованої цілі немає. Не `404` —
  404 означав би «немає такого списку», а це інша ситуація, і фронт мусив би їх розрізняти.

## Правила створення

У транзакції під `acquireAdvisoryLock({ classId: readingGoals, key: listId })`:

1. `assertOwned(listId, userId)`;
2. знайти неархівовану ціль цього списку;
3. якщо вона є і її похідний статус `active` → `ConflictError` («Для цього списку вже є активна ціль»);
4. якщо вона є і статус `completed` або `expired` → **проставити їй `archivedAt = now`** і йти далі.
   Саме тому UI ніколи не впирається в глухий кут «ціль виконана, нову створити не можна»;
5. створити нову;
6. на `P2002` по `reading_goals_active_list_idx` → той самий `ConflictError`
   (`rethrowUniqueConstraintAs` уже є в `core/prisma-errors.ts`).

## Валідація

- `deadline` має бути **пізнішою за сьогодні**: `isAfter(parseIsoDate(deadline), startOfDay(now))`.
  Помилка — `400` з `path: ["deadline"]`, щоб фронт підсвітив саме це поле.
- `targetCount` ∈ `[1, min(1000, кількість активних книг списку)]`. Верхня межа перевіряється в
  сервісі (Zod її не знає), помилка з `path: ["targetCount"]`.
- `PATCH` над архівованою ціллю → `400`. Архівована ціль — це історія, не чернетка.

---

# 4. Обчислення прогресу

`apps/api/src/modules/reading-goals/domain/reading-goal-progress.ts` — чистий, без Prisma.

## Що зараховується

Книга рахується в ціль, якщо:

- вона активна (`deleted_at IS NULL`) і належить активному списку цілі;
- `readingProgress.finishedAt IS NOT NULL`;
- `finishedAt >= startOfDay(goal.createdAt)`.

> **Чому `startOfDay` від дати створення.** `finishedAt` має тип `@db.Date` (лише день), а
> `createdAt` — момент. Порівнювати день із моментом напряму не можна. Беремо початок дня
> створення: книга, дочитана вранці того дня, коли ціль створили ввечері, зараховується. Це
> свідомо м'яка межа — вона щедра до користувача й не залежить від часового поясу.

> **Чому не «всі прочитані книги списку».** Тоді ціль «прочитати 8» на списку, де вже 8 прочитаних,
> виконана в мить створення. Це не виклик, а лічильник.

> **Наслідок, який приймаємо.** Домен скидає `finishedAt` при будь-якому переході зі статусу
> `Прочитано`, зокрема в `Перечитую`
> (`apps/api/src/modules/books/domain/reading-status-transition.ts:82`). Тому початок перечитування
> зарахованої книги **зменшує прогрес**. Задокументовано в [`README.md`](./README.md).

## Похідні поля

```ts
status =
  archivedAt !== null                    → "archived"
  completedCount >= targetCount          → "completed"
  isAfter(startOfDay(now), deadline)     → "expired"
  інакше                                 → "active"
```

Порядок перевірок важливий: ціль, виконана до дедлайну і не архівована, лишається `completed`
назавжди, навіть коли дедлайн мине.

- `remainingCount = max(0, targetCount - completedCount)`.
- `completedAt` — `finishedAt` тієї книги, що закрила ціль: узяти зараховані `finishedAt`,
  відсортовані `ASC`, і взяти елемент `[targetCount - 1]`. `null`, якщо ціль ще не виконана.
- `daysLeft = differenceInCalendarDays(deadline, startOfDay(now))`; `null` для `completed` і
  `archived`. Для `expired` — від'ємне число (фронт покаже «прострочено на N днів»).

Ніякого `Date.now()` у домені — «зараз» приходить параметром, інакше функцію не протестуєш.

## Репозиторій

`reading-goals.repository.ts` — CRUD цілі + один запит прогресу:

```ts
findCountedFinishedDates({ listId, since }): Promise<Date[]>
```

```sql
SELECT p.finished_at
FROM book_list_items i
JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL AND b.user_id = $userId
JOIN book_reading_progress p ON p.book_id = b.id
WHERE i.list_id = $listId AND p.finished_at IS NOT NULL AND p.finished_at >= $since
ORDER BY p.finished_at ASC
```

Один запит дає і `completedCount` (довжина), і `completedAt` (елемент `[target-1]`). Для деталей
цілі той самий join із додатковими полями книги — окремий метод, щоб дешевий вид не тягнув
обкладинки.

---

# 5. Каскади й життєвий цикл списку

| Подія                             | Що з ціллю                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Список у кошик (soft-delete)      | Ціль не чіпаємо. `GET /api/lists/:listId/goal` вже недосяжний, бо `assertOwned` не бачить видалений список. |
| Список відновлено                 | Ціль повертається сама — нічого робити не треба.                                                            |
| Список остаточно вичищено (purge) | `onDelete: Cascade` прибирає ціль. Перевірити, що `list-purge.processor.ts` не падає на новому FK.          |
| Книгу прибрано зі списку          | Прогрес перерахується вниз при наступному читанні. Це очікувано.                                            |
| Користувача видалено              | `onDelete: Cascade` через `userId`.                                                                         |

---

# 6. Тести

`backend-test-engineer`.

**Домен (чистий, без БД):**

- `status`: усі чотири гілки + пріоритет `completed` над `expired` при простроченому дедлайні;
- `completedAt` = `finishedAt` рівно `target`-ї книги, а не останньої;
- `daysLeft` від'ємний для простроченої, `null` для `completed` і `archived`;
- `remainingCount` не буває від'ємним при перевиконанні.

**Сервіс (репозиторій замоканий):**

- створення при активній цілі → `409`;
- створення при виконаній цілі → попередня архівується, нова створюється;
- `targetCount` більший за кількість книг списку → `400` з `path: ["targetCount"]`;
- дедлайн сьогодні або в минулому → `400` з `path: ["deadline"]`;
- `PATCH` архівованої → `400`.

**Інтеграційні (реальна БД):**

- дві паралельні спроби створити ціль для одного списку → рівно одна `201`, друга `409`
  (перевірка, що індекс справді ловить гонку);
- книга, дочитана **до** створення цілі, не зараховується; дочитана після — зараховується;
- книга, дочитана того самого дня до створення цілі, **зараховується** (межа `startOfDay`);
- книга в кошику не зараховується;
- прибирання книги зі списку зменшує `completedCount`;
- purge списку видаляє ціль;
- чужа ціль → `404` на `GET`, `PATCH`, `DELETE`, `archive`;
- `GET /api/lists/:listId/goal` без цілі → `204`.

---

# 7. Гейти

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
pnpm --filter @app/api db:migrate --name add_reading_goals   # create-only
# рев'ю migration.sql через migration-reviewer, вирізати паразитні DROP INDEX
pnpm --filter @app/api db:migrate:deploy
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm knip
pnpm --filter @app/api generate:openapi && pnpm gen:api
```

Плюс живий curl повного циклу: створити ціль → прочитати книгу зі списку → перечитати ціль і
побачити, що `completedCount` зріс. Без цієї перевірки «готово» не рахується.
