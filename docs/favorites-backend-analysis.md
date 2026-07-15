# Улюблені книги — аналіз бекенду

> Аналіз того, як `apps/api` наразі підтримує функціонал улюблених книг і яка там логіка.

## Головне: окремої сутності «favorites» немає

Улюблене — це **не окрема таблиця/модуль/зв'язок**, а **два скалярні поля на моделі `Book`**. Оскільки кожна книга належить користувачу (`userId`), улюблене автоматично **per-user** і **жорстко-перемикається** (без окремого рядка, без soft-delete). Уся логіка живе всередині модуля `books` (`apps/api/src/modules/books/`).

```prisma
// apps/api/prisma/schema.prisma:206-207
isFavorite      Boolean   @default(false) @map("is_favorite")
favoriteAddedAt DateTime? @map("favorite_added_at") @db.Timestamptz
```

- `isFavorite` — булевий прапорець, default `false`.
- `favoriteAddedAt` — nullable timestamp, ставиться при додаванні, обнуляється при знятті.
- Окремого unique/index на favorite-полях немає — запити йдуть через наявний `@@index([userId])`.
- Каскад: видалення `User` каскадить у `Book` (`onDelete: Cascade`). Видалення книги просто прибирає рядок разом із полями — окремої favorites-таблиці для каскаду немає.

> ⚠️ Не плутати: у `User` є ще `favoriteBookQuote` / `favoriteGenres` (`schema.prisma:30-31`) — це персоналізація профілю, до книжкового «улюбленого» стосунку не має.

**Чому так спроєктовано:** улюблене — це атрибут стану *конкретної книги користувача*, а не багато-до-багатьох зв'язок (як було б, якби одну книгу могли фаворитити різні юзери). Тому join-таблиця була б надлишковою. Ціна рішення — немає історії (коли додав/прибрав/знову додав), лише останній `favoriteAddedAt`.

## Endpoints (усі під `JwtAccessGuard`)

| Метод + маршрут | Що робить |
| --- | --- |
| `PATCH /api/books/:id` | Основний спосіб перемкнути одну книгу — body містить `isFavorite?` |
| `PATCH /api/books/bulk/favorite` | Масове set/unset: `{ bookIds: uuid[], isFavorite }` → `{ affected }` |
| `POST /api/books` | При створенні можна одразу `isFavorite` (default `false`) |
| `GET /api/books?isFavorite=true` | Фільтр списку тільки на улюблені + сорт `favorite_added_desc/asc` |
| `GET /api/books/favorites-summary` | Агрегована статистика по улюблених |

Окремого `POST /books/:id/favorite` / `DELETE` **немає** — додавання/зняття йде через update, create або bulk.

Контролери:

- `apps/api/src/modules/books/api/books.controller.ts` — базовий `api/books`. `favoritesSummary` (`:149-153`) оголошений **до** `GET /:id` (`:160`), щоб літеральний маршрут вигравав над параметризованим.
- `apps/api/src/modules/books/api/bulk-books.controller.ts` — `api/books/bulk`, метод `favorite` (`:54-60`), throttle 30/60s.

## Логіка перемикання

Ядро — чиста доменна функція `resolveFavoriteChange` (`apps/api/src/modules/books/domain/favorite.ts`):

```ts
export function resolveFavoriteChange({ current, next, now }) {
  if (next === current) return null;                               // no-op
  return { favoriteAddedAt: next ? now : null, isFavorite: next }; // set/clear timestamp
}
```

- Фаворит → `favoriteAddedAt = now`; зняти → `= null`.
- Якщо стан не змінюється — повертає `null`, і сервіс просто нічого не пише (ідемпотентність).

Де використовується у сервісі (`application/books.service.ts`):

- **Create** (`:247-331`) — `resolveFavoriteChange({ current: false, next: input.isFavorite, now })`, пише поля на нову книгу в межах `transactionRunner.run(...)`.
- **Update** (`applyFavoriteFields`, `:527-553`) — діє лише якщо `input.isFavorite` визначено; при незмінному значенні (`change === null`) не робить нічого.
- Власність для одиночної зміни перевіряється через `findOwnedById(userId, id)` → `NotFoundError("Book not found")` (`:334-337`).

**Bulk-варіант** (`infrastructure/bulk-books.repository.ts:189-205`) робить усе однією `updateMany`:

```ts
const updated = await this.prisma.book.updateMany({
  data: { favoriteAddedAt: isFavorite ? now : null, isFavorite },
  where: { id: { in: bookIds }, isFavorite: !isFavorite, userId }, // line 202
});
return updated.count;
```

Два важливі моменти:

1. `isFavorite: !isFavorite` у `where` — оновлюються лише рядки, які реально в протилежному стані. Тому `affected` = кількість *справжніх* змін, а повторний виклик поверне `0`. Це «ідемпотентність на рівні SQL», без попереднього SELECT.
2. `userId` у `where` — це і є перевірка власності. Чужі/неіснуючі `bookIds` просто не потрапляють під update і **тихо ігноруються** (не рахуються, помилки немає).

Явної помилки «вже в улюблених» ніде не кидається — повторне фаворитення є тихим no-op.

## Статистика улюблених (`favoritesSummary`)

`GET /api/books/favorites-summary` повертає (`FavoritesSummaryView`):

```
{ total, reading, finished, wantToRead, series, solo, averageRating }
```

Під капотом — 7 паралельних запитів у `Promise.all` (`infrastructure/books.repository.ts:472-502`): загальна кількість (`countFavorites`), розбивка за статусами читання, series-part vs solo, і `bookReadingProgress.aggregate({ _avg: { rating } })` для середнього рейтингу по улюблених.

Додатково `LibraryOverviewView.summary.favorites` (`countFavorites`, `:393-403`) дає простий лічильник на дашборді.

Сортування списку — `LIBRARY_ORDER_BY` (`:860-874`): `favorite_added_asc` / `favorite_added_desc` за `favoriteAddedAt` з `nulls: "last"`, далі `createdAt desc`, `id asc` як tiebreakers.

Маппінг у ViewModel (`domain/book.mapper.ts`): `favoriteAddedAt` → ISO-рядок або `null` (`:42`), `isFavorite` → as-is (`:55`).

## Shared DTOs (`packages/shared/src/books.ts`)

- `CreateBookInputSchema.isFavorite: z.boolean().default(false)` (`:516`).
- `UpdateBookInputSchema.isFavorite: z.boolean().optional()` (`:618`).
- `BulkFavoriteInputSchema = BulkBookIdsSchema.extend({ isFavorite: z.boolean() })` (`:705-707`); `bookIds: uuid[].min(1).max(BULK_BOOK_IDS_MAX)`. Результат `BulkActionResultSchema = { affected: int >= 0 }` (`:736-738`).
- `LibraryBooksQuerySchema.isFavorite: z.stringbool().optional()` (`:784`).
- `LibrarySortSchema` містить `"favorite_added_desc"`, `"favorite_added_asc"` (`:760-761`).
- `BookViewSchema`: `favoriteAddedAt: z.string().nullable()` (`:974`), `isFavorite: z.boolean()` (`:981`).
- `LibraryOverviewViewSchema.summary.favorites: z.number()` (`:1024`).
- `FavoritesSummaryViewSchema` (`:1054-1064`).

DTO-обгортки: `api/input-dto/bulk-favorite.input-dto.ts`, `api/view-dto/favorites-summary.view-dto.ts` (тонкі `createZodDto`).

## Module wiring

Окремого favorites-модуля немає. Усе реєструє `apps/api/src/modules/books/books.module.ts` — `BooksController` + `BulkBooksController` у `controllers`; `BooksService`, `BulkBooksService`, `BooksRepository`, `BulkBooksRepository` у `providers`.

## Гепи / на що звернути увагу

- **Немає single-toggle endpoint** — одну книгу фаворитиш через загальний `PATCH /:id`. Ергономіку мультивибору закриває bulk.
- **Немає історії/аудиту** — тільки останній timestamp; повторне фаворитення перезаписує його.
- **Bulk мовчки ковтає чужі id** — повертає лише `affected`, не повідомляє, які саме id пропущені.
- Іменування всюди американське — `favorite` (жодних `favourite`/`liked`/`bookmark`/`wishlist`).
