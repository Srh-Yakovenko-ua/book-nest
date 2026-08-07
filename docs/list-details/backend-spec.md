# Backend — сторінка деталей кастомного списку

Реалізація серверної частини `docs/booknest-list-details-spec.md`. Рішення й порядок етапів —
у [`README.md`](./README.md).

## Межі

- **Жодної міграції на всіх шести етапах.** Усі потрібні дані вже в моделях `Book`,
  `BookList`, `BookListItem`, `BookReadingProgress`. Якщо здається, що потрібна нова колонка —
  зупинись і перечитай цей документ.
- **Не чіпати `apps/web/**`** — фронт окремим документом.
- Шари сакральні: Prisma — лише в репозиторіях, обчислення — у домені, контролер валідує й делегує.
- Zod-first: схема в `packages/shared`, `createZodDto` для Swagger, `ZodQueryPipe` / `ZodBodyPipe`.
- Нуль ≠ «невідомо». Де даних нема — `null`, ніколи не `0` (особливо для сторінок).
- Наприкінці кожного етапу: `pnpm --filter @app/api generate:openapi`, далі `pnpm gen:api`.

## Поточний стан (щоб не шукати)

| Що                              | Де                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Контролер деталей               | `apps/api/src/modules/books/api/list-details.controller.ts`                                                                                          |
| Сервіс деталей                  | `apps/api/src/modules/books/application/list-details.service.ts`                                                                                     |
| Репозиторій книг списку         | `apps/api/src/modules/books/infrastructure/list-books.repository.ts`                                                                                 |
| Мутації членства                | `apps/api/src/modules/books/application/list-membership.service.ts`, `infrastructure/list-membership.repository.ts`                                  |
| CRUD списку                     | `apps/api/src/modules/lists/**`                                                                                                                      |
| Конструктор фільтрів бібліотеки | `apps/api/src/modules/books/infrastructure/book-library-read.repository.ts` → `buildLibraryWhere` (рядок 412), приватна функція модуля               |
| Мапи сортування                 | `apps/api/src/modules/books/infrastructure/books.repository.ts` → `LIBRARY_ORDER_BY` (рядок 1070); `list-books.repository.ts` → `LIST_BOOK_ORDER_BY` |
| Складач `BookView`              | `apps/api/src/modules/books/application/book-view-assembler.ts`                                                                                      |
| Схеми                           | `packages/shared/src/lists.ts`, `packages/shared/src/books.ts`                                                                                       |
| Прецедент агрегатів             | `LibraryOverviewViewSchema` (`packages/shared/src/books.ts:1144`) + `BookLibraryReadService.overview`                                                |
| Advisory-locks                  | `apps/api/src/core/database/advisory-lock.ts` → `listMembership: 4`                                                                                  |

---

# Етап 1 — фільтри, швидкі таби, фасети, сортування

## 1.1 Винести `buildLibraryWhere` у спільний модуль

Зараз це приватна функція `book-library-read.repository.ts`. Імпортувати її в
`list-books.repository.ts` крізь інший репозиторій — порушення шарів.

**Створити** `apps/api/src/modules/books/infrastructure/book-where.ts` і перенести туди
`LibraryFilter`, `buildLibraryWhere`, `buildIntRange` **без зміни поведінки**.
`book-library-read.repository.ts` імпортує їх звідти. Реекспорт `LibraryFilter` із
`books.repository.ts` лишити, якщо він вже комусь потрібен (перевірити `knip`).

## 1.2 Додати фільтр «у черзі читання» в `LibraryFilter`

Його немає навіть у «Моїй бібліотеці». Додати в `LibraryFilter`:

```ts
inQueue?: boolean;
```

і в `buildLibraryWhere`:

```ts
if (filter.inQueue === true) {
  where.queuePosition = { not: null };
}
if (filter.inQueue === false) {
  where.queuePosition = null;
}
```

Одночасно додати `inQueue: z.stringbool().optional()` у `LibraryBooksQuerySchema` і прокинути
в `BookLibraryReadService.list` — фільтр стає доступним і бібліотеці, і списку з одного місця.

> **Чому не `isInReadingQueue` як у `BookView`.** У view це похідне булеве поле, у фільтрі —
> предикат по колонці `queue_position`. Колонка вкрита частковим індексом
> `books_user_queue_position_idx` (`WHERE queue_position IS NOT NULL AND deleted_at IS NULL`),
> тому `{ not: null }` іде по індексу, а не по seq scan.

## 1.3 Розширити `CustomListBooksQuerySchema`

`packages/shared/src/lists.ts`:

```ts
export const ListBookTabSchema = z.enum(["all", "not_started", "reading", "finished"]);

export type ListBookTab = z.infer<typeof ListBookTabSchema>;

export const CustomListBooksQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  author: queryStringArray(z.uuid()),
  bookType: BookTypeSchema.optional(),
  format: queryStringArray(BookFormatSchema),
  genre: queryStringArray(GenreKeySchema),
  inQueue: z.stringbool().optional(),
  isFavorite: z.stringbool().optional(),
  owner: queryStringArray(OwnershipStatusSchema),
  sort: ListBookSortSchema.default("position"),
  status: queryStringArray(ReadingStatusSchema),
  tab: ListBookTabSchema.default("all"),
});
```

`BookTypeSchema` закриває фільтр «Серійність» зі спеки (`solo` / `series_part` / відсутній = усі).
Конкретна серія — не в цьому етапі.

### Взаємодія `tab` ↔ `status` — це серверне правило, не UI-угода

```
статуси = status.length > 0 ? status : TAB_STATUSES[tab]
```

Тобто **`tab` розкривається в набір статусів лише коли `status` порожній**. Фронт зобов'язаний
віддзеркалити це правило: при виборі конкретних статусів у розширеній панелі він скидає таб на
`all`. Але навіть якщо фронт помилиться, сервер поведеться детерміновано.

```ts
const TAB_STATUSES: Record<ListBookTab, ReadingStatus[] | undefined> = {
  all: undefined,
  finished: ["finished"],
  not_started: ["not_started", "want_to_read"],
  reading: ["reading", "rereading"],
};
```

Дві семантичні деталі, які треба зафіксувати саме так:

- **`not_started` = `not_started` + `want_to_read`.** Обидва означають «читання ще не починалося»
  (вимога спеки, рядки 297–302).
- **`reading` включає `rereading`.** Спека каже «тільки активний статус `Читаю`», але
  перечитування — це теж активне читання, і швидкий фільтр бібліотеки вже трактує його так
  (`apps/web/src/features/books/model/library-quick-filters.ts` → `reading: ["reading","rereading"]`).
  Дві різні семантики того самого слова на двох сторінках — гарантований баг довіри до цифр.

## 1.4 Застосувати фільтри в репозиторії

`list-books.repository.ts` → `buildListItemWhere`. Зараз він будує мінімальний `where` руками.
Замінити тіло на композицію з `buildLibraryWhere`:

```ts
function buildListItemWhere({ filter, listId }: ListItemWhereInput): Prisma.BookListItemWhereInput {
  return {
    book: buildLibraryWhere(filter),
    list: { ...SOFT_DELETE_SCOPE.active, userId: filter.userId },
    listId,
  };
}
```

`buildLibraryWhere` уже містить `SOFT_DELETE_SCOPE.active`, `userId` і пошук — дублювати їх не треба.
Сервіс збирає `LibraryFilter` із query рівно так само, як `BookLibraryReadService.list`
(включно з `searchGenreKeys` через `genresService.searchKeys`).

> **Чому це безпечно з боку планувальника.** `book_list_items` фільтрується по `list_id`
> (частина складеного PK), а предикати на книгу лягають у nested join по `book_id`
> (`@@index([bookId])`). Списки — це десятки-сотні рядків; ніяких додаткових індексів не треба.

## 1.5 Лічильники швидких табів

Додати в `CustomListDetailSchema` (`packages/shared/src/books.ts:1246`):

```ts
statusCounts: z.object({
  all: z.number().int().nonnegative(),
  finished: z.number().int().nonnegative(),
  not_started: z.number().int().nonnegative(),
  reading: z.number().int().nonnegative(),
}),
```

**Правило обчислення (важливе):** лічильники рахуються по тому самому `where`, але **без**
`tab`/`status` і **з** усіма іншими активними фільтрами й пошуком. Інакше при ввімкненому фільтрі
за жанром таби покажуть цифри всього списку — і користувач перестане їм вірити.

Реалізація — один `groupBy`:

```ts
const rows = await this.prisma.bookListItem.groupBy({
  by: ["bookId"],           // groupBy по readingStatus книги напряму Prisma не вміє
  ...
});
```

Prisma не групує по полю зв'язаної моделі, тому робимо або чотири `count` (просто, читабельно,
4 дешевих запити), або один raw-SQL `GROUP BY b.reading_status`. **Бери чотири `count` у
`Promise.all`** — на списку в сотні книг різниця непомітна, а код лишається на Prisma й
типобезпечним. Групування статусів у `all/not_started/reading/finished` — у домені
(`apps/api/src/modules/books/domain/list-status-counts.ts`), не в репозиторії.

## 1.6 Два нових сортування

`ListBookSortSchema` — додати `author_desc` і `rating_asc`. У `LIST_BOOK_ORDER_BY` вони мапляться
через уже наявний `nestBookOrderBy`, бо в `LIBRARY_ORDER_BY` обидва вже є:

```ts
author_desc: nestBookOrderBy("author_desc"),
rating_asc: nestBookOrderBy("rating_asc"),
```

`nulls: "last"` для рейтингу вже стоїть в обох напрямках — вимога спеки «книги без оцінки завжди
в кінці» виконується без додаткової роботи.

`Непрочитані / Прочитані спочатку` та `Новіші / Старіші видання` — **етап 6**, див. нижче.

## 1.7 `GET /api/lists/:listId/facets`

Без нього фронт не може намалювати `Стівен Кінг — 7` — глобальний довідник авторів тут не годиться.

```ts
export const ListFacetEntrySchema = z.object({
  count: z.number().int().positive(),
  id: z.string(),
  name: z.string(),
});

export const ListGenreFacetSchema = z.object({
  count: z.number().int().positive(),
  key: z.string(),
  name: z.string(),
});

export const ListFacetsViewSchema = z.object({
  authors: z.array(ListFacetEntrySchema),
  genres: z.array(ListGenreFacetSchema),
});
```

**Лічильники статичні по всьому списку** — вони не залежать від активних фільтрів. Це свідоме
рішення: динамічні фасети треба перераховувати на кожну зміну фільтра, і опції з нулем зникають
із панелі просто в момент, коли користувач цілиться в них мишею.

- Тільки активні книги (`deleted_at IS NULL`) активного списку користувача.
- Сортування: `count DESC`, потім `name ASC` (детермінований порядок при рівних лічильниках).
- Safety cap `200` записів на кожну групу з `log.warn`, як зроблено для `WISHLIST_MAX_BOOKS`.

Автори — через `book_authors` join. Жанри — це `String[]` на книзі, тому потрібен raw SQL:

```sql
SELECT g.key, count(*)::int AS count
FROM book_list_items i
JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL
CROSS JOIN LATERAL unnest(b.genres) AS g(key)
WHERE i.list_id = $1 AND b.user_id = $2
GROUP BY g.key
ORDER BY count DESC, g.key ASC
LIMIT 200
```

Імена жанрів — через уже наявний `genresService.findNamesByKeys`; ключі без імені відкидати не
можна, показувати сам ключ (так робить фронт бібліотеки).

## Файли етапу 1

```
packages/shared/src/lists.ts                     ListBookTabSchema, CustomListBooksQuerySchema, ListFacetsViewSchema, +2 сорти
packages/shared/src/books.ts                     CustomListDetailSchema.statusCounts, LibraryBooksQuerySchema.inQueue
apps/api/src/modules/books/infrastructure/book-where.ts            новий — LibraryFilter + buildLibraryWhere + inQueue
apps/api/src/modules/books/infrastructure/book-library-read.repository.ts   імпорт замість локальної функції
apps/api/src/modules/books/infrastructure/list-books.repository.ts          фільтри, +2 сорти, лічильники
apps/api/src/modules/books/infrastructure/list-facets.repository.ts         новий — фасети
apps/api/src/modules/books/domain/list-status-counts.ts                     новий — групування статусів
apps/api/src/modules/books/application/list-details.service.ts              збирання LibraryFilter, statusCounts
apps/api/src/modules/books/application/list-facets.service.ts               новий
apps/api/src/modules/books/api/list-details.controller.ts                   @ApiQuery на нові параметри, GET :listId/facets
apps/api/src/modules/books/api/input-dto/custom-list-books-query.input-dto.ts
apps/api/src/modules/books/api/view-dto/list-facets.view-dto.ts             новий
```

---

# Етап 2 — `GET /api/lists/:listId/overview`

Чотири статкартки, блок «Про добірку» і блок «Зараз читаються» **неможливо порахувати на фронті**:
він бачить лише поточну сторінку пагінації. Показати «20 книг від 12 авторів», порахувавши по 24
завантажених із 100 — це показати користувачу неправду.

```ts
export const ListOverviewViewSchema = z.object({
  currentlyReading: z
    .object({ book: ListBookViewSchema, othersCount: z.number().int().nonnegative() })
    .nullable(),
  distinctAuthorsCount: z.number().int().nonnegative(),
  finishedCount: z.number().int().nonnegative(),
  genresCount: z.number().int().nonnegative(),
  inQueueCount: z.number().int().nonnegative(),
  ownedCount: z.number().int().nonnegative(),
  pagesKnownCount: z.number().int().nonnegative(),
  seriesCount: z.number().int().nonnegative(),
  soloCount: z.number().int().nonnegative(),
  topGenres: z.array(ListGenreFacetSchema),
  totalBooks: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
```

## Семантика кожного поля — не імпровізувати

| Поле                   | Визначення                                                                                                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `totalBooks`           | активні книги активного списку. Той самий `countItems`, що вже годує `bookCount`.                                                                                                                                                                                                                  |
| `distinctAuthorsCount` | `count(DISTINCT ba.author_id)` по `book_authors` книг списку. Книга без автора не додає нікого.                                                                                                                                                                                                    |
| `finishedCount`        | `readingStatus = 'finished'`. **`rereading` не рахується** — людина перечитує, статус зараз не «прочитано», і фільтр `Прочитані` її теж не покаже. Дві різні відповіді на те саме питання на одній сторінці неприпустимі.                                                                          |
| `inQueueCount`         | `queuePosition IS NOT NULL`.                                                                                                                                                                                                                                                                       |
| `ownedCount`           | `ownershipStatus IN ('owned','borrowed_from_someone','lent_to_someone')` — книга фізично в обігу користувача. Це рівно `physicalOwnershipStatuses` із `book-library-read.service.ts:42`. **Не вигадувати другу семантику** — інакше «Є у власності» на сторінці списку й у бібліотеці розійдуться. |
| `genresCount`          | кількість **унікальних** ключів жанрів серед книг списку.                                                                                                                                                                                                                                          |
| `seriesCount`          | `count(DISTINCT series_id) WHERE series_id IS NOT NULL`.                                                                                                                                                                                                                                           |
| `soloCount`            | книги з `series_id IS NULL`. `seriesCount + soloCount ≠ totalBooks` — це нормально й очікувано (4 серії можуть містити 9 книг).                                                                                                                                                                    |
| `totalPages`           | сума `pagesCount` лише по книгах із непорожнім значенням.                                                                                                                                                                                                                                          |
| `pagesKnownCount`      | скільки книг мали `pagesCount`. Фронт із цього робить `Для 17 із 20 книг`; порівняння з `totalBooks` — його справа, сервер лічильник не інтерпретує.                                                                                                                                               |
| `topGenres`            | 3 найчастіші жанри з іменами. Той самий обчислювач, що й у `/facets` — виніс його в домен і виклич з обох місць.                                                                                                                                                                                   |
| `currentlyReading`     | книги списку зі статусом `reading` або `rereading`. Головна — за `readingProgress.lastProgressUpdateAt DESC NULLS LAST`, тайбрейкер `book.updatedAt DESC`. `othersCount` = решта таких книг. `null`, коли жодної немає — блок повністю ховається, порожнього стану немає.                          |

Книга в `currentlyReading` віддається як повний `ListBookView` через наявний `BookViewAssembler` —
фронту одразу приходять обкладинка, автори й `readingProgress.currentPage`, нового мапера не треба.

## Реалізація

Новий `apps/api/src/modules/books/infrastructure/list-overview.repository.ts`. Порядок:
`Promise.all` із ~6 агрегатів (`count` × 4, `groupBy` для жанрів/серій, `aggregate` для сторінок)
плюс окремий `findFirst` для книги, що читається. Групування й похідні — у домені
(`domain/list-overview.ts`), як `computeSeriesStats` у серіях.

**Не пиши один мега-SQL.** Шість дешевих запитів по індексованих колонках читабельніші й
профілюються по одному; список — це не таблиця на мільйон рядків.

## Файли етапу 2

```
packages/shared/src/lists.ts                                        ListOverviewViewSchema
apps/api/src/modules/books/infrastructure/list-overview.repository.ts   новий
apps/api/src/modules/books/domain/list-overview.ts                      новий
apps/api/src/modules/books/application/list-overview.service.ts         новий
apps/api/src/modules/books/api/list-details.controller.ts               GET :listId/overview
apps/api/src/modules/books/api/view-dto/list-overview.view-dto.ts       новий
```

---

# Етап 3 — `GET /api/lists/:listId/related`

```ts
export const RelatedListViewSchema = z.object({
  bookCount: z.number().int().nonnegative(),
  id: z.string(),
  name: z.string(),
  sharedCount: z.number().int().positive(),
});

export const ListRelatedViewSchema = z.object({ lists: z.array(RelatedListViewSchema) });
```

- `sharedCount` — скільки книг **поточного** списку входять також у той список.
- `bookCount` — усього активних книг у тому списку. Потрібен для сценарію зі спеки «помічати
  списки, які майже повністю дублюють один одного» (`6 з 8`).
- Поточний список у результат не потрапляє; списки з нулем перетинів — теж.
- Сортування `sharedCount DESC, name ASC`. **Ліміт 10** — фронт показує 3 і розгортає решту
  всередині блока, окремої сторінки немає.

Один raw SQL, self-join по `book_list_items` (індекс `@@index([bookId])` уже є):

```sql
SELECT
  other.list_id                                       AS id,
  bl.name                                             AS name,
  count(*)::int                                       AS "sharedCount",
  (SELECT count(*)::int
     FROM book_list_items i
     JOIN books ab ON ab.id = i.book_id AND ab.deleted_at IS NULL
    WHERE i.list_id = other.list_id)                  AS "bookCount"
FROM book_list_items current_item
JOIN books b        ON b.id = current_item.book_id AND b.deleted_at IS NULL
JOIN book_list_items other ON other.book_id = current_item.book_id AND other.list_id <> current_item.list_id
JOIN book_lists bl  ON bl.id = other.list_id AND bl.deleted_at IS NULL AND bl.user_id = $2
WHERE current_item.list_id = $1
GROUP BY other.list_id, bl.name
ORDER BY "sharedCount" DESC, bl.name ASC
LIMIT 10
```

Параметризовані плейсхолдери через `Prisma.sql` — жодної конкатенації. Результат парсити Zod-ом
(`$queryRaw` повертає `unknown`, `count(*)::int` — щоб не прилетів `BigInt`).

Перед видачею перевірити володіння списком через `listsService.assertOwned` — інакше ендпоїнт
розкаже, чи існує чужий список.

---

# Етап 4 — дрібне, але помітне

## 4.1 `notInList` у запиті бібліотеки

Реальна дірка, яку спека сама фіксує (рядок 698): діалог додавання будує «вже в списку» з
завантаженої сторінки деталей. У списку на 100 книг при `pageSize = 24` користувач побачить як
доступні 76 книг, які вже там є.

`LibraryBooksQuerySchema`:

```ts
notInList: z.uuid().optional(),
```

`buildLibraryWhere`:

```ts
if (filter.notInList !== undefined) {
  where.lists = { none: { listId: filter.notInList } };
}
```

Перевірка володіння списком не потрібна: `none` по чужому `listId` просто нічого не відфільтрує,
а книги й так скоуплені по `userId`. Витоку немає.

## 4.2 Масове прибирання зі списку

`POST /api/lists/:listId/books/remove` (не `DELETE` з тілом — так само, як уже зроблено
`POST bulk/delete` у `bulk-books.controller.ts`).

```ts
export const RemoveBooksFromListInputSchema = z.object({
  bookIds: z.array(z.uuid()).min(1).max(LIST_PAGE_SIZE_MAX),
});

export const RemoveBooksFromListResultSchema = z.object({
  bookCount: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
});
```

У транзакції під `acquireListLock`: `deleteMany` по `(listId, bookId in ...)`, потім **щільна
перенумерація всього списку** (див. 5.2), потім `touchList`. Ідемпотентно: книги, яких у списку
немає, просто не рахуються в `removed`.

## 4.3 Дублювання списку

`POST /api/lists/:listId/duplicate` → `CustomListCard`.

- Назва: `«{name} (копія)»`; якщо зайнято — `(копія 2)`, `(копія 3)`, … Ліміт спроб 50 → `ConflictError`.
- Копіюються опис і **позиції** (інакше це не дублікат).
- Створення — під `acquireCreateLock(userId)`, як у `ListsService.resolveOrCreate`, бо унікальність
  імені тримає частковий індекс `book_lists_user_id_normalized_name_key`.
- Копіювання членства — `createMany` з тими самими `position`, у тій самій транзакції.

## 4.4 `previewCovers` у деталях

Додати `previewCovers: z.array(MediaViewSchema)` в `CustomListDetailSchema` — для колажу в шапці.
Мапер уже є (`ListsService.toCard`), джерело те саме, `PREVIEW_COVERS_LIMIT = 4`.

Альтернатива «фронт бере обкладинки з першої сторінки книг» не годиться: вона працює лише при
`sort=position` без фільтрів і ламається щоразу, коли користувач щось відфільтрує.

---

# Етап 5 — drag-and-drop і щільні позиції

## 5.1 Переміщення на індекс

Наявний контракт вміє лише міняти книгу місцями із сусідом. Замінити тіло запиту на
дискриміноване об'єднання (обидві операції лишаються, невалідні стани стають невиразними):

```ts
export const MoveListBookInputSchema = z.discriminatedUnion("kind", [
  z.object({ direction: MoveListBookDirectionSchema, kind: z.literal("step") }),
  z.object({ kind: z.literal("index"), position: z.number().int().positive() }),
]);
```

Це ламаюча зміна контракту — фронт оновлюється в тому самому слайсі.

Алгоритм для `kind: "index"`, у транзакції під `acquireListLock`:

1. прочитати всі активні членства списку, впорядковані за `position`;
2. якщо їх більше `LIST_REORDER_MAX = 2000` — `BadRequestError` (реальні списки на два порядки менші;
   без стелі одна мутація може переписати необмежену кількість рядків);
3. вийняти книгу з масиву, вставити на `position - 1` (кліп у межі `0..len-1`);
4. записати `1..N` **тільки для рядків, у яких номер змінився**;
5. `touchList`.

Побічний ефект пункту 4 — щільна перенумерація, тобто будь-яке перетягування само лікує дірки.

## 5.2 Дірки в нумерації — наявний баг, якого спека не бачить

`shiftUpAfter` викликається лише при явному прибиранні книги зі списку
(`list-membership.service.ts:128`). Коли книгу відправляють у **кошик**, її `BookListItem`
лишається з позицією, а з видачі вона зникає (`buildListItemWhere` фільтрує `book: active`).
Результат — позиції `1, 2, 4, 7`, і чіп «Позиція N» показує пропуски.

**Рішення — рахувати номер для показу, а не читати колонку.** Колонка `position` лишається
розрідженою й авторитетною для порядку; для відображення репозиторій рахує ранг:

```sql
SELECT i.book_id, row_number() OVER (ORDER BY i.position)::int AS rank
FROM book_list_items i
JOIN books b ON b.id = i.book_id AND b.deleted_at IS NULL
WHERE i.list_id = $1
```

Мапа `bookId → rank` накладається на сторінку в `toListBookView`.

Два наслідки, які роблять це дешевим:

- ранг потрібен **лише при `sort === "position"`** — за прийнятим рішенням номер показується тільки
  тоді. При інших сортуваннях запит не виконується взагалі;
- запит тягне два стовпці без join-ів по relations; safety cap `2000` рядків із `log.warn`.

Альтернативу «перенумеровувати список при відправленні книги в кошик» **відкинуто**: тоді
відновлення книги з кошика повертає її в кінець списку, а це видима втрата даних у сценарії, який
для користувача є undo.

## 5.3 Режим списку

Серверної роботи немає — `ListBookView` уже містить усе для компактного рядка.

---

# Етап 6 — відкладене

## 6.1 `Непрочитані спочатку` / `Прочитані спочатку`

Єдине сортування зі спеки, яке не виражається в Prisma `orderBy`: сортування по `reading_status` —
це сортування рядка за алфавітом (`dnf < finished < not_started < paused < reading`), що для
користувача безглуздо. Потрібен вираз:

```sql
ORDER BY (CASE WHEN b.reading_status = 'finished' THEN 1 ELSE 0 END) ASC, i.position ASC
```

Це тягне raw-SQL-гілку в репозиторій, який зараз повністю на Prisma. Тому — окремо й пізніше.
Значення сортувань: `status_unread_first`, `status_read_first`.

## 6.2 Рік видання

`year_desc` / `year_asc` — по два рядки через `nestBookOrderBy`, `nulls: "last"` уже стоїть.

## 6.3 Фільтри «Оцінка» і «Кількість сторінок»

`ratingMin` / `ratingMax` / `hasRating` / `pagesMin` / `pagesMax` **уже є** в `LibraryFilter`.
Після етапу 1 достатньо додати ці поля в `CustomListBooksQuerySchema` і прокинути в фільтр —
серверної логіки писати не треба взагалі.

---

# Тести

`backend-test-engineer`, Vitest + supertest через `createTestApp`.

**Сервісні (юніт, репозиторій замоканий):**

- `TAB_STATUSES`: `not_started` дає обидва статуси; `reading` включає `rereading`; непорожній
  `status` перебиває `tab`.
- `statusCounts` рахуються з рештою фільтрів, але без `tab`/`status`.
- Овервʼю: `finishedCount` не рахує `rereading`; `ownedCount` = три статуси володіння;
  `pagesKnownCount` не рахує книги без сторінок; `currentlyReading = null` при відсутності активних;
  `othersCount` = решта.
- Дублювання: конфлікт імені → `(копія 2)`.

**Інтеграційні (реальна БД):**

- Фільтри списку: книга поза списком не потрапляє в результат навіть якщо підходить під фільтр.
- `notInList` виключає книги списку, яких немає на поточній сторінці пагінації.
- `/related`: soft-deleted список і soft-deleted книга не потрапляють у перетини; поточний список
  відсутній у видачі; сортування за `sharedCount`.
- `/facets`: жанри з `unnest` не дублюються; лічильники не залежать від переданих фільтрів.
- Ранг позиції: після відправлення книги списку в кошик решта книг має ранги `1..N-1` без дірок,
  а `position` у БД лишається розрідженою.
- Move-to-index: переміщення першої книги на останню позицію дає щільні `1..N`; вихід за межі
  кліпається, а не падає.
- Чужий список → `404` на всіх нових ендпоїнтах.

# Гейти

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm knip
pnpm --filter @app/api generate:openapi && pnpm gen:api
```

Плюс живий curl на кожен новий ендпоїнт із `x-request-id` у відповіді — без цього «готово» не рахується.
