# SPEC 03 — Publisher Details Books integration

Authoritative spec for embedding canonical Books inside Publisher Details. Publisher identity/stats/Overview semantics remain in `02-DETAIL-OVERVIEW.md`; do not merge Publisher read semantics with canonical Books quick-filter semantics.

---

## 27. Books tab — canonical contextual archive

`Книги` is a contextual instance of canonical `/books` `scope=all`, not a new feature and not the whole page-level `<BooksLibrary>` shell. Reuse/refactor the inner archive core so Detail does not render a second header/summary/sidebar/h1.

Fixed `publisherId` comes from route context, outside browser filter state. Use existing `GET /api/books` publisher scope; no `/publishers/:id/books`. Universe = all active caller books for publisher, including `want_to_buy`, in-transit and other ownership states. Unfiltered total must equal detail.booksCount. No PublisherBookCard/Row forks.

---

## 28. Books tab search, sort and quick filters

**Search:** canonical `q`, placeholder `Назва книги, автор або серія`, 300 ms, whitespace normalization, ordinary min 2 chars, current short-ISBN exception, immediate clear, fresh first page while preserving publisher/sort/filters/view. Search title/originalTitle, authors, series, genres, tags, ISBN, translator, illustrator. In this context **exclude publisher identity**; implement a required Publisher-Details contextual switch whose default for existing callers preserves global search including publisher.

**Sort:** reuse all current 15 canonical Books sorts/labels/tie-breakers/null handling; default `created_desc`; no Publisher-only sort.

**Quick filters:** full canonical order: `Усі`, `Читаю`, `Хочу прочитати`, `Прочитано`, `Улюблені`, `У списку бажань`, `В дорозі`, `Позичені`, `Частина серії`, `Соло книга`. Wishlist maps owner=`want_to_buy`. Keep intentional difference: Books quick `Прочитано` = finished only; Publisher summary `Прочитано` = finished+rereading. Counts are publisher-scoped and may be base fixed-scope counts rather than recomputed under every q/filter; result counter reflects actual current filters. `Усі` clears quick dimensions only, never fixed publisher.

---

## 29. Books tab Advanced Filters

Use every current canonical section except `Видавництво`: reading status, ownership, format, genres, tags, age category, language, author, book type, rating, publication year, pages, cover. Ownership still includes `want_to_buy`. Do not add a Publisher-only Series selector.

Fixed publisher is never shown as control/chip/badge count and survives `Очистити фільтри` / `Очистити все`.

Author+Genre facets must be current-user + fixed-publisher scoped. Extend canonical `/api/books/facets` with optional publisher context for compatibility, but Publisher Details **must pass it**. v1 facets need not recalc against every active filter. Tags stay canonical/unscoped. No `/publishers/:id/facets`.

---

## 30. Books scoped counts/facets APIs

Default-preserving extensions only:

- `GET /api/books/overview`: optional publisher context; omitted = current behavior, Publisher Details must pass current publisher; all quick counts then scoped to it. Keep canonical fields total/reading/finished/favorites/wantToRead/wantToBuy/inTransit/borrowed/series/solo.
- `GET /api/books/facets`: optional publisher context; omitted = current behavior, Detail must pass it; Author+Genre options/counts scoped to caller+publisher while preserving existing scope/q semantics.

No Publisher-specific counts/facets endpoints and no full interdependent faceted-search engine.

---

## 31. Books tab Grid/List/actions

Reuse canonical BookCard, BookRow, actions, cover viewer, Selection Mode, sticky LibraryBulkBar and URL-backed Grid/List. In fixed publisher context hide redundant publisher metadata in both card and row via a shared optional presentation prop whose global default remains visible; keep publisher data in the model.

Keep all current single-book and bulk actions. No Publisher-specific bulk change-publisher or “select all results”. Preserve Book Details, Series links and cover-viewer navigation.

---

## 32. Books result/pagination/states

Canonical infinite pagination, page size 24, explicit Load More, no numbered pagination. Counter `Показано {shown} з {total} ...`, where total = server total under fixed publisher + current user q/filters.

Zero states:

1. detail.booksCount=0 → `Ще немає книг цього видавництва` / `Додайте першу книгу цього видавництва до своєї бібліотеки.` / `+ Додати книгу`.
2. Publisher has books, q-only zero → `Нічого не знайдено` / `Спробуй змінити пошуковий запит або очистити пошук.` / `Очистити пошук`.
3. Filters active (including q+filters) zero → `Немає книг за вибраними фільтрами` / `Спробуй змінити фільтри або очистити їх, щоб побачити більше книг.` / `Очистити фільтри` + `Очистити все`.

Clear-all never clears fixed publisher. Initial Books error: `Не вдалося завантажити книги` / `Спробуй повторити запит трохи пізніше.` + Books-only retry. Load-more error keeps loaded books and uses canonical local error. Loading = canonical Grid skeleton, no fullscreen spinner.

---

## 35. Mutation/cache synchronization

Follow existing TanStack root invalidation. Add `publisherKeys.overview(id)` and shared `invalidatePublisherQueries(queryClient)` matching statistics invalidation style. Prefer broad `/api/publishers` invalidation over fragile old/new publisher patching.

Invalidate publisher root for mutations that can change Publisher stats/Overview/archive: create/update/delete/bulk-delete book; reading status/progress; ownership/wishlist and bulk ownership; queue changes affecting queueCount; StoreLink add/edit/delete; Series edit/status/delete. Do **not** invalidate Publisher aggregates for favorite-only/tags-only/list-only changes.

Keep existing Wishlist/store-link and Books/Series invalidations. Publisher edit: immediately set returned detail at `publisherKeys.detail(id)`, then invalidate publisher root, Books root and publisher picker/recent queries as appropriate.

Do not optimistic-patch aggregate counts/averages/series blocks. Publisher-scoped list/overview/facets remain under `/api/books`, so existing Books-root invalidation covers them; no second Publisher-books cache namespace.

---

## 37. Cross-feature compatibility guards

Publisher context is required here; new query params/presentation props are optional/default-preserving elsewhere. Without context, preserve current behavior:

- `/books` search includes publisher identity;
- `/books` and `/my-library` quick `Прочитано` = finished only;
- `/books-to-buy` pricing/sorts/filters unchanged;
- global BookCard/BookRow show publisher;
- canonical Advanced Filters include Publisher;
- Series progress/finished semantics unchanged;
- `/my-library` ownership scope unchanged.

Do not redesign Notes, Quotes, Characters, Lists or unrelated pages. Generated API client files are outputs only; never hand-edit them.
