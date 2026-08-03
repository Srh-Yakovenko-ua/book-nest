# Backend task — Series advanced filters (Phase 2 & Phase 3)

> Промпт для бекендера. Контекст, точні місця в коді, обсяг робіт і застереження.
> Проза — українською; шляхи, ідентифікатори, код і команди — англійською.

## Контекст

На сторінці списку серій (`/[locale]/series`) додано **розширений фільтр** (як на «Усі книги»).
**Фаза 1 вже зроблена суто на фронті** — фільтрація виконується в памʼяті над масивом `SeriesView`,
бо список серій завантажується у браузер повністю (див. нижче «Поточна архітектура»).

Фаза 1 покриває лише виміри, дані для яких **уже є** в списковому DTO `SeriesView`:
прогрес читання, жанр (серієвий), автор, кількість книг у серії, повнота колекції.

Цей документ описує **дві наступні фази бекенду**:

- **Phase 2** — розширити списковий DTO `SeriesView` полями-агрегатами з книжок серії,
  щоб на фронті стали можливі багатші фільтри (рейтинг, володіння, формат, мова, рік видання, теги, улюблене).
  **Міграції не потрібні** — усі дані вже є в моделі `Book`.
- **Phase 3** — перенести фільтрацію/сортування/пагінацію на сервер (потрібно **лише заради масштабу**,
  коли серій стануть сотні/тисячі й «завантажити все в браузер» перестане бути прийнятним).

---

## Поточна архітектура (чому Фаза 1 — клієнтська)

Список серій **не** фільтрується на сервері. Веб-хук тягне **всю** колекцію в браузер:

- `apps/web/src/features/series/api/use-series-list.ts` — `useInfiniteQuery` → `seriesControllerSearch`,
  шле лише `pageSize = LIST_PAGE_SIZE_MAX` (= 100, `packages/shared/src/common.ts:40`) + `pageNumber`.
  `useEffect` сам догортує всі сторінки, поки `hasNextPage`. На дроті — пагінація, по факту — «fetch-all».
- Клієнтський фільтр/сорт: `apps/web/src/features/series/model/series-derive.ts`
  (`filterSeries`, `sortSeries`) над `data.pages.flatMap(p => p.items)` в `all-series.tsx`.

Ендпоінт списку `GET /api/series` (`apps/api/src/modules/series/api/series.controller.ts:88-102`, `search()`)
приймає **тільки**: `search?` (пошук по **імені**), `authorIds?` (UUID[], але **не підключений** у веб-хуці),
`pageNumber`, `pageSize`. **Немає** параметрів `status`, стану читання, жанру; **сорт жорстко зашитий**
`orderBy: { name: "asc" }` (`series.repository.ts:322`), `sort`-параметра не існує взагалі.

Схема запиту: `SeriesSearchQuerySchema` (`packages/shared/src/series.ts:83-85`)
= `TaxonomySearchPaginationQuerySchema.extend({ authorIds: queryStringArray(z.uuid()) })`
(база: `packages/shared/src/taxonomy.ts:19-22`).

**Еталон, як зроблено «правильно» на книжках** (server-side filter + sort + пагінація):
- `LibraryBooksQuerySchema` — `packages/shared/src/books.ts:850-924` (14 фільтр-полів + діапазони + `superRefine`).
- `BooksRepository.buildLibraryWhere` — `apps/api/src/modules/books/infrastructure/books.repository.ts:1632-1709`.
- `LIBRARY_ORDER_BY` (мапа сортів) — `books.repository.ts:1415-1459`.
- `BookLibraryReadService.list` — `apps/api/src/modules/books/application/book-library-read.service.ts:68-123`.

Використай книжковий модуль як шаблон для Фази 3.

---

## Що вже є в `SeriesView` (Фаза 1, чіпати не треба)

`SeriesViewSchema` — `packages/shared/src/series.ts:105-120`. Несе на кожну серію:
`id`, `name`, `status` (`completed|ongoing|unknown`), `description`, `totalBooks` (nullable),
`genres: string[]` (серієві жанр-ключі), `authors: {id,name}[]`, `booksInSeries`, `finishedInSeries`,
`readingInSeries`, `nextBook`, `covers`, `createdAt`, `lastActivityAt`.

Мапиться в `series.mapper.ts` / `series-preview.ts` (`series-preview.ts:77-123`) з рядків, які тягне
`seriesWithBookCountArgs` (`series.repository.ts:35-53`).

---

# Phase 2 — Розширити `SeriesView` полями-агрегатами (без міграцій)

## Мета

Дати списковому DTO достатньо агрегатів по книжках серії, щоб фронт міг фільтрувати за ними **клієнтськи**
(так само, як зараз Фаза 1) — без переписування пайплайну запитів.

## Ключове спостереження

Дані **вже є** в моделі `Book` (`apps/api/prisma/schema.prisma:211-280`) і `BookReadingProgress`
(`schema.prisma:305-322`). Бракує лише **вибірки + агрегації на рівні списку**.
Логіка агрегації **вже написана** для сторінки деталей: `SeriesStatsViewSchema`
(`packages/shared/src/series.ts:153-167`) рахує `averageRating`, `averagePages`, `pagesCount`,
`readingDurationDays` тощо — але **тільки для detail-ендпоінта**, не для списку.
Переглянь, як `SeriesStatsView` збирається для деталей, і винеси/перевикористай ту саму агрегацію для списку.

## Обсяг робіт

1. **Розширити `seriesWithBookCountArgs`** (`series.repository.ts:35-53`), щоб `book`-relation тягнув додаткові
   колонки, потрібні для агрегатів: `ownershipStatus`, `isFavorite`, `formats`, `language`, `ageCategory`,
   `pagesCount`, `publicationYear`, `publisherId`, `tags` (через `BookTag`), а рейтинг — через
   `readingProgress.rating` (`BookReadingProgress`). Тягнути **тільки** те, що реально потрібно для нових полів,
   щоб не роздувати вибірку списку.

2. **Порахувати агрегати в мапері** (`series.mapper.ts` / `series-preview.ts:77-123`). Додати per-series:
   - `averageRating: number | null` — середнє по книжках із рейтингом (як у `SeriesStatsView`).
   - `pagesCount: number | null` та/або `averagePages: number | null`.
   - `ownership: { ownedCount: number; total: number }` **або** булеві прапорці
     `hasOwnedBook` / `fullyOwned` — обери форму, зручну для фільтра «є придбані / зібрана повністю».
   - `formats: BookFormat[]` — множина форматів, наявних у серії (union).
   - `languages: BookLanguage[]` — union мов.
   - `ageCategories: AgeCategory[]` — union вікових категорій.
   - `publisherIds: string[]` (або `publishers: {id,name}[]`, якщо потрібні назви у фільтрі) — union видавництв.
   - `publicationYearRange: { min: number; max: number } | null` — діапазон років видання по книжках.
   - `hasFavoriteBook: boolean`.
   - `tags: {id,name}[]` — union тегів книжок серії (за потреби).

3. **Розширити `SeriesViewSchema`** (`packages/shared/src/series.ts:105-120`) відповідними Zod-полями.
   Перевикористай наявні енуми (`BookFormatSchema`, `BookLanguageSchema`, `AgeCategorySchema`, `GenreKeySchema`)
   з `packages/shared`. Тримай поля опційними/nullable там, де серія може не мати книжок.

4. **Оновити контракт**: `pnpm --filter @app/api generate:openapi` → `pnpm gen:api`
   (Orval перегенерує типізований клієнт + zod у `apps/web/src/shared/api/generated/**`).

5. **Тести**: unit на мапер (агрегати рахуються правильно на 0/1/багатьох книжках, книжки без рейтингу,
   серія без `totalBooks`), і оновити наявні тести серій, якщо DTO змінився.

## Чого **не** робити у Phase 2

- Жодних міграцій — нові поля обчислювані, не зберігаються.
- Не додавати серверних query-параметрів (це Phase 3). Фронт і далі фільтрує клієнтськи, просто вже за
  ширшим набором полів.
- Слідкувати за вартістю вибірки списку: якщо тягнути всі книжки з усіма колонками стане важко на великих
  колекціях — це сигнал, що час переходити на Phase 3, а не роздувати Phase 2.

## Застереження щодо продуктивності

Список зараз тягне до `pageSize=100` серій, і для кожної — усі активні книжки з підмножиною колонок.
Додавання `tags`/`readingProgress`/`publisher` relations збільшує розмір вибірки. Це прийнятно, поки
колекції невеликі. Якщо помітиш N+1 або важкі join-и — переходь до Phase 3 (агрегувати в БД, а не в памʼяті Node).

---

# Phase 3 — Серверна фільтрація/сортування (заради масштабу)

## Коли це потрібно

Тільки коли «завантажити всі серії в браузер» перестане бути прийнятним (сотні/тисячі серій).
Функціонально Phase 1+2 покривають usability; Phase 3 — про масштаб і час до першого рендеру.

## Обсяг робіт

1. **Розширити `SeriesSearchQuerySchema`** (`packages/shared/src/series.ts:83-85`) параметрами (за зразком
   `LibraryBooksQuerySchema`, `books.ts:850-924`): `status`, `readingState`, `genre[]`, `authorIds` (вже є —
   лишити), `sort`, `progressMin/Max`, `booksMin/Max`, `completeness`, а також Phase-2 агрегатні фільтри
   (`format[]`, `language[]`, `ageCategory[]`, `publisher[]`, `ratingMin/Max`, `yearMin/Max`, `hasFavorite`,
   `tag[]`). Додати `superRefine` для перевірки узгодженості діапазонів (`min <= max`), як у книжках.

2. **Додати `sort`-параметр і мапу ORDER BY** у репозиторії (зараз `orderBy` жорстко `name asc`,
   `series.repository.ts:322`). За зразком `LIBRARY_ORDER_BY` (`books.repository.ts:1415-1459`) — з детермінованими
   тай-брейкерами (`createdAt`/`id`) і `nulls: "last"` для nullable-колонок. Значення сортів мають збігатися з
   фронтовими (`SERIES_SORT_OPTIONS` у `series-derive.ts`: `name_asc/desc`, `progress_asc/desc`, `books_desc`,
   `activity_desc`).

3. **Навчити `buildOwnedWhere` + `searchOwned`** (`series.repository.ts:318-404`) враховувати нові параметри.
   Прямі колонки серії (`status`, `genres`, `totalBooks`, `createdAt`, `name`) фільтруються тривіально.
   **Агрегатні фільтри по книжках** (рейтинг, формат, мова, рік, володіння, теги, прогрес, к-сть книг) —
   через `where.books = { some/none/every: {...} }` або через попередньо пораховані/денормалізовані значення.
   ⚠️ Складні агрегати (напр. «середній рейтинг серії в діапазоні», «прогрес = finished/total») погано лягають
   у простий `WHERE` — може знадобитися:
   - обчислювані підзапити / `GROUP BY HAVING`, або
   - денормалізовані лічильники на `Series` (тоді **буде** міграція + тригери/перерахунок при зміні книжок), або
   - матеріалізований вид.
   Оціни складність поокремо для кожного фільтра; прості (status/genre/author/formats-hasSome) зроби першими.

4. **Підключити параметри у веб-хуці** `use-series-list.ts` (зараз шле лише `pageSize`, `:12,20`) — передавати
   `search`, `sort`, фільтри. Прибрати «fetch-all» `useEffect`-догортування; повернутися до звичайної
   пагінації/`fetchNextPage` по скролу.

5. **Перенести/прибрати клієнтський `filterSeries`/`sortSeries`** (`series-derive.ts`) — або лишити як тонкий
   fallback, або видалити, коли сервер став джерелом істини. Узгодити типи фільтрів між FE-станом і query-схемою.

6. **Вирівняти пошук.** Серверний `search` шукає **лише по `name`** (`series.repository.ts:386`), а клієнтський —
   ще й по іменах авторів (`series-derive.ts:90`). Під час переносу пошуку на сервер розшир умову, щоб поведінка
   не змінилась (напр. `OR` по `name` та `authors.some(author.name contains)`).

7. **`authorIds` вже реалізований** серверно (`buildOwnedWhere`, `series.repository.ts:389-400`), але **не
   підключений** у хуці — підключити його першим як найдешевший серверний фільтр.

## Trade-offs (для рішення «коли»)

- Phase 1 (клієнт): миттєвий, нуль-бек, але вантажить усе → лінійно гіршає з ростом колекції.
- Phase 2 (ширший DTO, клієнт-фільтр): ще трохи важча вибірка списку, але UX багатший без переписування запитів.
- Phase 3 (сервер): масштабується, але агрегатні фільтри по книжках коштовні; частина з них може вимагати
  денормалізації (+міграції +інваріанти при зміні книжок). Робити поетапно: спершу дешеві прямі фільтри
  (status/genre/author/sort/пагінація), агрегати — за реальною потребою.

---

## Definition of done (обидві фази)

Дотримуйся `CLAUDE.md` §5–§6 (шарова архітектура: Prisma лише в репозиторії, сервіс мапить model → ViewModel,
`HttpError`-підкласи, `TransactionRunner` для multi-write — тут не потрібен, лише читання).

Гейти перед «готово»:
```bash
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```
Плюс для Phase 2: `pnpm gen:api` без діфу-сюрпризів; `pnpm dev:api` стартує чисто;
`curl -i http://localhost:4000/api/series?pageSize=5` → 200 з новими полями в `items[]`.
Якщо зачепиш schema.prisma (лише Phase 3, за денормалізації) — двокрокова міграція за `CLAUDE.md` §6
і **не забудь про raw-SQL-index trap** (strip зайвих `DROP INDEX` перед `db:migrate:deploy`).
