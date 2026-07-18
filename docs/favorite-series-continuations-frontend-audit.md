# Frontend audit: favorite series continuations

> Read-only аудит перед реалізацією фронтенд-блоку «Продовжити улюблені серії».
> Джерело істини — фактичний код бекенду та `@app/shared`, а не текст специфікації.

## Уже реалізовано на бекенді

Бекенд-частина **повністю готова** (модуль `apps/api/src/modules/series`), фронтенду залишається лише споживання.

- **endpoint:** `GET /api/series/favorite-continuations`
  - контролер: `apps/api/src/modules/series/api/series.controller.ts`
  - domain: `apps/api/src/modules/series/domain/favorite-continuations.ts`
  - тести: `series.controller.favorite-continuations.test.ts`, `favorite-continuations.test.ts`
- **query params:** `limit` (coerce number, `min 1`, `max 50`, `default 3`) — `FavoriteSeriesContinuationsQuerySchema` у `packages/shared/src/series.ts`. Курсорної пагінації немає (`nextCursor` завжди в контракті, але наразі не використовується).
- **response contract** (`FavoriteSeriesContinuationsViewSchema`, `packages/shared/src/series.ts`):

  ```
  { total: number; nextCursor: string | null; items: FavoriteSeriesContinuationItem[] }

  FavoriteSeriesContinuationItem = {
    series: { id; title; status: SeriesStatus; totalBooks: number };   // ← БЕЗ cover
    favoriteBooksCount: number;
    lastFavoriteAddedAt: string | null;
    progress: { finishedBooks; closedBooks; totalBooks };              // totalBooks = кількість ВІДОМИХ книг
    rankReason: "reading"|"paused"|"available"|"lent"|"in_transit"|"want_to_buy"|"not_owned";
    nextBook: {
      id; title; authors: {id;name}[];
      cover: MediaView | null;
      seriesPosition: number | null;                                   // ← лише number, не string
      readingStatus: ReadingStatus;
      ownershipStatus: OwnershipStatus;
      isFavorite: boolean; favoriteAddedAt: string | null;
      queue:  { position: number; priority: "low"|"normal"|"high"|null } | null;  // ← немає isInQueue
      readingProgress: { currentPage: number; totalPages: number|null; percentage: number|null } | null;
    };
  }
  ```

- **statuses/enums** (`packages/shared/src/book-enums.ts`) — **lowercase snake_case**, не uppercase як у специфікації:
  - `ReadingStatus`: `not_started | want_to_read | reading | paused | finished | dnf | rereading`
  - `OwnershipStatus`: `none | want_to_buy | in_transit | owned | borrowed_from_someone | lent_to_someone`
  - `QueuePriority`: `low | normal | high`
- **queue/progress fields:** присутні всередині `nextBook` (див. вище). `queue` non-null лише коли книга справді в черзі; `readingProgress` non-null лише коли є `currentPage`.
- **бізнес-логіка (`rankReason`, обчислюється бекендом, FE не дублює):**
  - `reading` → `readingStatus ∈ {reading, rereading}`
  - `paused` → `readingStatus = paused`
  - інакше за ownership: `available` ← `owned|borrowed_from_someone`; `lent` ← `lent_to_someone`; `in_transit`; `want_to_buy`; `not_owned` ← `none`
  - серії з `< 2` книг та серії без «наступної» книги (усі `finished|dnf`) не повертаються; ранжування та ізоляція за користувачем — на бекенді.

### Згенерований клієнт (споживати як є)

`apps/web/src/shared/api/generated/endpoints/series/series.ts`:

- hook `useSeriesControllerFavoriteContinuations(params, options)`
- query-key `getSeriesControllerFavoriteContinuationsQueryKey(params?)` → `["/api/series/favorite-continuations", { limit }]`
- моделі/zod — `FavoriteSeriesContinuationsViewSchema` та типи у `@app/shared`.

## Уже є на фронтенді

- **page/sidebar components:**
  - сторінка: `apps/web/src/app/[locale]/(app)/favorites/page.tsx` → `<FavoritesView/>` (`features/books`)
  - контейнер: `features/books/components/favorites-view.tsx` — передає правий бар пропом `sidebar` (рядок ~447)
  - layout сайдбара: `features/books/components/books-library-view.tsx` (`sidebar` prop, рендер у flex-row, лише коли `showToolbar`)
  - існуючий блок-шаблон: `features/books/components/favorites-unrated-block.tsx` («Улюблені без оцінки») — саме він задає візуальний патерн (aside → section → header з іконкою/лічильником → стани loading/error/empty → рядки з обкладинкою+CTA)
- **reusable cards/chips/buttons:**
  - `StatusBadge` (`components/ui/status-badge.tsx`) + мапи `book-status.ts` (`readingStatuses`, `ownershipStatuses`, `queuePriorities`, `seriesStatuses`) — chips рендеряться через `StatusEntry`
  - локалізація лейблів chips: `useTranslations("books.readingStatus.options")`, `useTranslations("books.ownershipStatus.options")` (див. `favorites-view.tsx:55-56`, `library-book.ts:81-94`)
  - `Button` (`components/ui/button.tsx`, варіанти `secondary/outline/...`, `loading`, `asChild`), `Skeleton`, `UiIcon`, `Link` з `@/i18n/navigation`
  - обкладинка-прев'ю з плейсхолдером — інлайн-патерн `PreviewCover` (`favorites-unrated-block.tsx:187`), плейсхолдер = ініціал назви або `UiIcon name="book"`
- **query keys/hooks:**
  - патерн hand-written прев'ю-хука: `features/books/api/use-unrated-favorites.ts`
  - мутації: `useAddToReadingQueue` (`api/use-reading-queue.ts`, вхід `{ bookId, placement, position? }`), `useWantToBuy` (`api/use-ownership.ts`, вхід `{ id, payload: WantToBuyInput }` — `{}` валідний)
  - інвалідація: `use-book-mutation-sync.ts` (books/series/delivery). **Важливо:** ключ continuations починається з `/api/series/favorite-continuations`, тож наявні інвалідації по `["/api/series"]`/`["/api/books"]` його **не** зачіпають — потрібна явна інвалідація `getSeriesControllerFavoriteContinuationsQueryKey()`.
- **supported mutations and routes (для CTA):**
  - book detail `/books/[id]`, series detail `/series/[id]` (`Link` з `@/i18n/navigation`)
  - reading queue `/reading-queue`; wishlist «Хочу купити» `/books-to-buy`; loans `/loans`; delivery in-transit `/delivery/in-transit`
  - reading progress / зміна статусу — модалки (`UpdateReadingProgressDialog`, `ChangeReadingStatusDialog`) вимагають **повного `BookView`**, якого урізаний `nextBook` не містить

## Розбіжності зі специфікацією

| Специфікація                                                                 | Фактично                                                    | Наслідок для FE                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| enum-и `NONE/OWNED/LENT_TO/...` (uppercase)                                  | lowercase snake_case (`none/owned/lent_to_someone/...`)     | працюємо з фактичними значеннями та `rankReason`                              |
| `series.cover`                                                               | у контракті **немає**                                       | картка показує обкладинку `nextBook` (спец §24 і так вимагає next-book cover) |
| `queue.isInQueue`                                                            | немає; `queue` = `null` або `{position, priority}`          | «в черзі» = `queue !== null`                                                  |
| `seriesPosition: number` або `string`                                        | лише `number` або `null`                                    | `partNumber` як число                                                         |
| `readingProgress.percentage` завжди                                          | `percentage` може бути `null` (коли `pagesCount` невідомий) | показуємо `%` лише коли не null                                               |
| окремі порожні стани (`empty.noSeries` / `completed` / `noContinuations`)    | бекенд повертає `items: []` **без коду причини**            | один нейтральний empty-state (не можемо надійно розрізнити причину)           |
| «Переглянути всі» → сторінка серій із фільтром «має улюблені + не завершена» | такого фільтра/маршруту **немає**                           | посилання «Переглянути всі» **не додаємо** (спец §27 це дозволяє)             |
| CTA «Продовжити читання» → модалка прогресу                                  | модалка потребує повного `BookView`                         | навігуємо на `/books/[id]` (там блок прогресу) — спец §26.1 допускає          |

**Backend gaps:** відсутні. Endpoint дозволяє реалізувати всі обов'язкові вимоги блоку, тож `docs/favorite-series-continuations-backend-gaps.md` не створюється.

## План інтеграції

1. **API-хук** `features/books/api/use-favorite-series-continuations.ts`:
   - `useFavoriteSeriesContinuations()` = `useSeriesControllerFavoriteContinuations({ limit: 3 }, { query: { select: (d) => FavoriteSeriesContinuationsViewSchema.parse(d) } })`
   - `useInvalidateFavoriteSeriesContinuations()` → `invalidateQueries({ queryKey: getSeriesControllerFavoriteContinuationsQueryKey() })`
2. **Компоновка сайдбара:** винести `<aside>` зі `favorites-unrated-block.tsx` у новий `FavoritesSidebar` (aside → `<FavoritesUnratedBlock/>` + `<FavoriteSeriesContinuationsBlock/>`), підключити у `favorites-view.tsx`. Порядок: unrated → continuations (спец §22).
3. **Блок** `favorite-series-continuations-block.tsx` за патерном unrated-блоку: header, skeleton (3 рядки), error+retry, один нейтральний empty, `<ul>` з рядків.
4. **Рядок:** обкладинка `nextBook` (плейсхолдер), назва книги (2 рядки, link → book), рядок серії (1 рядок ellipsis, link → series) + `книга N із M`, series-progress `Прочитано X з Y`, chip (reading/paused → reading chip, інакше ownership chip), `У черзі · №N` коли `queue`, page-progress для reading/paused, CTA за `rankReason`.
5. **CTA-мапа:** `reading`→«Продовжити читання» (→book); `paused`→«Повернутися до читання» (→book); `available`+у черзі→«Перейти до черги» (→/reading-queue); `available`+не в черзі→«Додати в чергу» (mutation); `lent`→«Переглянути позику» (→/loans); `in_transit`→«Переглянути замовлення» (→/delivery/in-transit); `want_to_buy`→«Перейти до покупки» (→/books-to-buy); `not_owned`→«Додати до „Хочу купити“» (mutation). Після mutation — інвалідація continuations.
6. **i18n** `favorites.seriesContinuations.*` у `uk.json` + `en.json` (ru.json у проєкті немає), плюралізація для лічильників за наявним ICU-патерном.
7. **Тести** (Vitest + RTL, мок fetch на межі `/api/series/favorite-continuations`): loading, error/retry, empty, max 3, CTA за станами, книга в черзі, mutation+invalidation, кліки навігації, відсутня обкладинка, довгий текст.
8. **Accessibility:** клавіатура/focus, `alt`/`aria-label` для обкладинки та icon-CTA, chip не єдине джерело статусу, клік по картці не конфліктує з кнопками.
