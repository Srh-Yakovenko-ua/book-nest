# SPEC 02 — Publisher Details shell and Overview

Authoritative final spec for `/publishers/:id` shell, URL/tabs, Hero, detail stats/read-model, Overview, page states, custom edit/delete and detail a11y/responsive. Books-tab integration is in `03-DETAIL-BOOKS-INTEGRATION.md`.

---

## 19. Publisher Details — route, ownership and execution boundary

Route `/publishers/:id`. Final tabs exactly `Огляд` and `Книги`. Remove Publisher-specific `toBuy`/`wishlist` tab and `PublisherToBuyTab`; global `/books-to-buy` remains the purchase workspace.

Publisher Details is a contextual view over the same current-user `scope=all` books as `/books`, including `want_to_buy`; it is not a separate collection. Reuse shared archive/Books primitives after archive foundation; do not fork them for Detail.

---

## 20. Detail URL-state contract

Canonical:

- Overview: `/publishers/:id` (no `tab=overview`)
- Books: `/publishers/:id?tab=books` + canonical unprefixed Books params (`q`, `sort`, `view`, filters...)

Fixed publisher scope comes **only** from route `:id`: inject into Books API/query keys; never serialize as user `publisher=<id>`, show as chip, or clear via user resets.

Transitions:

- Overview→Books opens default Books state; no hidden/session restoration.
- Books→Overview strips Books params and returns clean detail URL.
- tab navigation uses normal history; Back/Forward restores real prior Books URLs.
- q/sort/filter/view keep current `nuqs` behavior; parser defaults need not be serialized.

Normalize with `replace`:

- legacy `tab=toBuy` → Books + canonical `want_to_buy` ownership state using existing Books serializer/setter (do not guess array syntax);
- invalid tab → clean Overview;
- Overview URLs carrying stale Books-only params → clean Overview.

---

## 21. Detail Hero

Compact identity only:

- building icon;
- publisher name as the **only page h1**;
- country only when present;
- founded year only when present: `Засновано у {year} році.`;
- website only when present, external link;
- `+ Додати книгу` → standard Add Book with publisher preselected.

No description, missing-value placeholders, breadcrumb/back link inside Hero, or `Власне` badge.

Global publisher: Add Book only. Custom publisher: Add Book + square `⋯` menu with `Редагувати`, `Видалити`; no separate edit/delete Hero buttons.

Responsive: desktop identity left/actions right; mobile metadata wraps, Add Book stays prominent/flex, overflow stays compact. Website accessible label must mention opening in a new tab.

---

## 22. Detail summary cards

Exactly 4 non-clickable cards using current stat primitives/warm styling:

| Card                | Value                | Microfact / rules                                                                                                                                     |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Книг у бібліотеці` | booksCount           | all active current-user books for publisher, all ownership/status incl. `want_to_buy`; `Останню додано …` from lastBookAddedAt, hidden when zero/null |
| `Прочитано`         | readCount            | `finished + rereading`; whole rounded `readCount/booksCount` %, omit when booksCount=0; 0% valid                                                      |
| `У списку бажань`   | wantToBuyCount       | no money aggregate; if `wishlistWithoutPriceCount>0`, `{N} без ціни`; canonical Wishlist StoreLink-price semantics                                    |
| `Середній рейтинг`  | avg non-null ratings | rated: `Серед книг цього видавництва з оцінкою`; none: value `—`, `Немає оцінених книг`                                                               |

Derive percentage in presentation; no backend `readPercentage`. Mobile 2 cols → desktop 4. If needed, add a narrow optional StatCard label-presentation prop with unchanged global default.

Terminology: final Publisher UI uses `Список бажань` / `У списку бажань`; never `Бажані` or `До покупки`.

---

## 23. `library-detail` API contract

Keep `GET /api/publishers/:publisherId/library-detail`, but make it **publisher-root** (Hero + stats gate), not book-root.

Visibility: global and caller-owned custom → allowed; foreign custom/missing → 404. Visible publisher with zero caller books → `200` with zero/null stats.

Preserve common archive stats for compatibility; Detail extends them with `wishlistWithoutPriceCount`.

Publisher stat semantics:

- booksCount: active caller books, all ownership/status;
- readCount: finished+rereading;
- readingCount: reading+rereading;
- wantToReadCount: want_to_read;
- wantToBuyCount: ownership want_to_buy;
- queueCount: queuePosition != null;
- seriesCount: distinct **active** Series only;
- averageRating / ratedBooksCount: non-null ratings only;
- lastBookAddedAt: MAX book.createdAt;
- lastBookReadAt: keep current compatibility semantics; no reading-history refactor.

`wishlistWithoutPriceCount`: active caller publisher books with `want_to_buy` and **no BookStoreLink with non-null price**. Do not use purchaseInfo.expectedPrice.

Publisher-root LEFT JOIN aggregates must use `COUNT(b.id)`, not `COUNT(*)`.

Consistency:

- represented archive booksCount/readCount/averageRating == detail values;
- unfiltered scoped Books total == detail.booksCount == scoped Books overview total.

---

## 24. Publisher Overview API and DTO

Add `GET /api/publishers/:publisherId/library-overview`. It contains preview data only; do not merge with library-detail or Books counts/facets.

```ts
LibraryPublisherOverview = {
  latestBook: PublisherOverviewLatestBook | null;
  activeReading: PublisherOverviewReadingBook[]; // max 3
  wishlist: PublisherOverviewWishlistBook[];     // max 3
  series: PublisherOverviewSeries[];             // max 3
}
```

Use compact DTOs, not full BookView/Wishlist rows. Reuse existing author refs, MediaView, BestOffer and enum schemas.

Base compact book: id, title, ordered authors, cover.

- latestBook: + createdAt, readingStatus, ownershipStatus, formats, active series `{id,name,partNumber,totalBooks}|null`
- activeReading: + readingStatus, `progress:{currentPage,pagesCount}|null`
- wishlist: + canonical `bestOffer|null`
- series: id, name, status, publisher-scoped booksCount/readCount (read = finished+rereading)

Visible zero-book response: `{ latestBook:null, activeReading:[], wishlist:[], series:[] }`. Do not expose ordering-only timestamps.

---

## 25. Overview query semantics

| Block    | Eligibility                                                                  | Order                                                                  | Limit / notes                                                                                                                      |
| -------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| latest   | active caller books, fixed publisher, any status/ownership incl. want_to_buy | createdAt DESC, id ASC                                                 | 1; soft-deleted linked Series maps to null                                                                                         |
| reading  | active; readingStatus in reading/rereading                                   | ReadingProgress.updatedAt DESC NULLS LAST, book.createdAt DESC, id ASC | 3; never generic Book.updatedAt; no ReadingCycle join solely for ranking; progress only if currentPage + positive pagesCount valid |
| wishlist | active; ownership want_to_buy                                                | COALESCE(wishlistAddedAt,createdAt) DESC, createdAt DESC, id ASC       | 3; reuse canonical Wishlist best-offer + currency priority                                                                         |
| series   | active publisher books with non-null Series; Series active/current-user      | booksCount DESC, series.name ASC, series.id ASC                        | 3; booksCount/readCount are publisher-scoped; read = finished+rereading, not global Series finished-only helper                    |

Implementation shape: four bounded lightweight repository queries, parallel in service; small Overview mapper may use MediaService. Do not use giant JSON_AGG, heavyweight Books `withRelations()`, circular Publishers↔Books module dependency, or speculative indexes/migrations.

---

## 26. Overview UI blocks

If booksCount=0, render one page-level empty state:
`Ще немає книг цього видавництва` / `Додайте першу книгу цього видавництва до своєї бібліотеки.` / `+ Додати книгу` (publisher preselected). Otherwise hide each empty individual block.

| Block                  | UI                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Остання додана книга` | exactly 1 compact horizontal row: cover, title, author, active series+part, reading status, max one meaningful ownership/format badge, date added. No publisher/ISBN/pages/year/genres/rating. Row→Book Details.                       |
| `Зараз читаю`          | max 3: cover/title/author, real progress, rereading indicator when relevant. Row→Book Details.                                                                                                                                         |
| `У списку бажань`      | max 3: cover/title/author, canonical individual best-offer price or `Без ціни`. No aggregate money/publisher/status/format/genre/rating/store clutter. Row→Book Details.                                                               |
| `Серії`                | max 3: series name, status badge `Завершена` / `Ще виходить` / `Невідомо`, scoped copy: partial `4 книги · 3 прочитано`; all `4 книги · усі прочитані`; none `4 книги · ще не прочитано`. Never `Серію прочитано`. Row→Series Details. |

No view-all CTAs, `Ще N`, internal scroll, or full BookCards.

Desktop: independent ~56/44 columns; left latest→series, right reading→wishlist; no synchronized 2x2 heights. Mobile/tablet semantic order: latest→reading→wishlist→series. Separate responsive layout shells may reuse the same section components/data; do not duplicate queries/business logic.

---

## 33. Loading, error and not-found hierarchy

`library-detail` gates the page.

- Initial detail pending: one skeleton matching final Hero + 4 stats + tabs + neutral content; do not start Overview/Books.
- Detail 404: whole-page not-found + back to `/publishers`.
- Initial non-404 error: whole-page error; primary `Спробувати ще раз` = refetch, secondary back; no window reload.
- Cached usable detail + background refetch error: keep page visible.

After detail success, Hero/stats/tabs stay stable; Overview/Books own local states. Overview fetch only when Overview active **and booksCount>0**. Books fetch only when Books active. Direct Books links must not eagerly fetch Overview; revisits should show cached tab data immediately.

---

## 34. Custom publisher edit/delete

Only custom publishers are editable/deletable; global publishers read-only.

**Edit:** keep current Dialog + RHF/Zod + dirty/discard flow. Field order: `Назва *`, `Країна`, `Сайт`, `Рік заснування`.

- Country: ISO 3166-1 alpha-2 persisted; no external API/table; one shared searchable `CountrySelect`; clear→null; no flags required; display with `Intl.DisplayNames`; shared validation rejects arbitrary non-ISO 2-letter codes.
- Year: existing shared `YearPicker`, current min/max schema.
- Website: existing HTTP/HTTPS schema.
- 409 duplicate → name field; other server errors → form-level.
- Success: close + toast + cache update/refetch, no reload.

**Delete:**

- booksCount=0 → destructive confirm `Видалити видавництво?`, permanent-removal explanation, cancel/delete. Success toast + `router.replace('/publishers')`.
- booksCount>0 → Delete remains discoverable but opens blocked/info state explaining linked books must be reassigned/deleted; action `Перейти до книг` → Books tab. Server 409 `PUBLISHER_HAS_BOOKS` maps to the same state for races.
- No automatic bulk detach/change-publisher.

---

## 36. Detail responsive/accessibility

- Exactly one page h1 = publisher name; Overview sections are h2; embedded Books must not add another h1 (sr-only h2 if needed).
- Reuse Radix `PageTabs`, exactly 2 tabs, translated tab-list aria label, keyboard/focus + horizontal overflow; no mobile dropdown.
- Overview rows expose one clear primary link target; decorative icons/covers aria-hidden when text already names entity.
- Dialogs preserve keyboard navigation, focus return on cancel/close, mobile viewport fit and scrollable content; Delete remains `AlertDialog`.
- Region-level `aria-busy`; do not announce every skeleton. Respect current reduced-motion patterns.
- No Publisher-specific mobile toolbar; reuse canonical Books mobile controls + Advanced Filter Sheet.
