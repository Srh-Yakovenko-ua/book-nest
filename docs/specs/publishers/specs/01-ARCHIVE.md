# SPEC 01 — Publishers archive

Authoritative final spec for `/publishers`. Implement only this state. Read only sections cited by `IMPLEMENTATION-PLAN.md`.

---

## 1. Page header

- Route: `/publishers`
- Title: `Видавництва` + existing `TitleLeaf`
- Subtitle: `Переглядай видавництва своєї бібліотеки, їхні книги, рейтинги та список бажань`
- Primary CTA: `+ Додати книгу` → `/books/new`
- No breadcrumb, `Додати видавництво`, or extra header actions.

---

## 2. Summary cards

Exactly 4 non-clickable whole-library cards. They do **not** react to archive q/filter/sort/view state.

| Card                     | Value                                        | Microfact / empty                                                                                                                                         | Semantics                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Видавництв`             | distinct represented publishers              | 0: `Ще немає книг із видавництвом`; 1: `Усі книги — одного видавництва`; 2–5: `Усі {count} охоплюють 100% книг`; >5: `Топ-5 охоплюють {percentage}% книг` | Top-5 coverage uses distinct active publisher-attributed books; rank by booksCount DESC, localized name ASC, id ASC. Exclude missing-publisher books from numerator/denominator. Positive <1% → `<1%`, else whole %. Icon building/primary. |
| `Найбільше в бібліотеці` | localized publisher name                     | `{count} книг у бібліотеці`; none → `—` / `Ще немає книг із видавництвом`                                                                                 | Rank booksCount DESC, localized name ASC, id ASC. Name max 2 visual lines but full accessible name retained. Icon crown/genre.                                                                                                              |
| `Видавництва у планах`   | distinct publishers with `want_to_buy` books | `{count} книг у списку бажань`; none → `0` / `Немає книг у списку бажань із видавництвом`                                                                 | Missing-publisher books excluded; each book/publisher counted once. Icon shopping-bag/success.                                                                                                                                              |
| `Найбільше прочитано`    | localized publisher name                     | localized read count; none → `—` / `Ще немає прочитаних книг`                                                                                             | Publisher `readCount = finished + rereading`; rank readCount DESC, localized name ASC, id ASC. Icon book-open-text/info.                                                                                                                    |

---

## 3. Publishers summary/insights API

Keep `GET /api/publishers/library/summary`; add validated locale using existing catalog-locale convention. One response feeds desktop/tablet summary + insights and mobile Overview; no extra insight endpoints.

Preserve existing consumed fields and add approved data:

- `publishersCount`
- `booksWithoutPublisherCount`
- existing compatibility fields
- `topFiveBooksCoveragePercent`
- `mostRepresentedPublisher: { id, name, booksCount } | null`
- `publishersInPlansCount`
- `booksToBuyWithPublisherCount`
- `mostReadPublisher: { id, name, readCount } | null`
- `unreadPublishers: { id, name, unreadCount }[]` max 3
- `bestRatedPublishers: { id, name, averageRating, ratedBooksCount }[]` max 3

Compute whole-library insight data server-side from active current-user books, not loaded archive pages. Use localized primary publisher names with current fallback behavior.

---

## 4. Search

Canonical frontend URL key `q`; map to existing backend `search` param.

Use shared `DebouncedSearchInput`: 300 ms; trim/collapse whitespace; commit ordinary text from 2+ chars; clear immediately; shortening a committed query below 2 chars removes stale `q` after debounce; Back/Forward syncs input. q change starts a fresh page-1 query and preserves quick/Advanced filters, sort and view. No relevance sort.

Scope: publisher identity/name/search_text only. Never search book titles/authors/notes/stats/geography/ratings/statuses.

Search-only empty:

- `Видавництв не знайдено`
- `Спробуй змінити пошуковий запит або очистити його.`
- `Очистити пошук`

---

## 5. Semantic sort

One frontend `sort` key; no canonical `order` URL key. Default `books_desc`.

| Value                        | Label                                                    | Backend                  |
| ---------------------------- | -------------------------------------------------------- | ------------------------ |
| `books_desc` / `books_asc`   | `Найбільше книг` / `Найменше книг`                       | booksCount desc/asc      |
| `read_desc` / `read_asc`     | `Найбільше прочитано` / `Найменше прочитано`             | readCount desc/asc       |
| `to_buy_desc` / `to_buy_asc` | `Найбільше у списку бажань` / `Найменше у списку бажань` | wantToBuyCount desc/asc  |
| `rating_desc` / `rating_asc` | `Найвищий рейтинг` / `Найнижчий рейтинг`                 | averageRating desc/asc   |
| `recent_desc` / `recent_asc` | `Нещодавно поповнені` / `Найдавніше поповнені`           | lastBookAddedAt desc/asc |
| `name_asc` / `name_desc`     | `Назва: А–Я` / `Назва: Я–А`                              | name asc/desc            |

Rules: null rating/date last both directions; non-name ties localized name ASC then id ASC; name ties id ASC. Invalid sort → `books_desc`. Mobile grouping may use the six semantic groups above.

---

## 6. Quick filter

URL `filter`; values `all | reading | read | to_buy | series`; visible order:
`Усі | Читаю зараз | Є прочитані книги | Є книги у списку бажань | Є серії`.

Shared single-select `ChipGroup`; `all` is visible default and may be omitted from URL. Server semantics:

- `reading`: at least one `reading` or `rereading`
- `read`: at least one `finished` or `rereading`
- `to_buy`: at least one `want_to_buy`
- `series`: at least one distinct non-null series

Publisher semantics: `readingCount = reading + rereading`, `readCount = finished + rereading`. Apply consistently archive/detail; **do not** change global Books quick `Прочитано` (`finished` only).

Quick filter ANDs with Advanced Filters, has no count badge, stays one horizontal mobile row, and is not duplicated as a removable chip. Legacy Publishers flags may remain accepted for compatibility, but new frontend must not emit/depend on them.

---

## 7. Advanced Filters

Right Sheet with local draft. Open copies applied state; editing does not refetch. `Очистити` resets draft only; `Застосувати` commits all draft values, closes Sheet, starts page 1.

- Geography single: `Усі / Українські / Іноземні / Без країни` → `all / ua / foreign / unknown`
- Source single: `Усі / З каталогу / Власні` → `all / global / custom`
- Independent booleans:
  - `Є оцінені книги` → ratedBooksCount > 0
  - `Хочу прочитати` → wantToReadCount > 0
  - `Є книги в черзі` → queueCount > 0

URL: omit default geography/source; booleans only as `...=true`. No false/negative semantics.

Advanced badge = non-default geography + non-default source + each boolean. Exclude q and quick filter.

---

## 8. Active chips and counter

Order: quick filters → active chips → counter.

Chips only for q (`Пошук: {query}`), non-default geography/source, and the 3 booleans. No chips for quick/sort/view. Removing a chip resets only that state.

`Очистити все`: clear q + quick→all + Advanced→defaults; preserve sort/view.

Counter: `Показано {shown} із {total} видавництв`; shown = deduped rendered items, total = server total for current q+quick+Advanced. Never use global summary total. Keep when shown==total; hide redundant `0 із 0` in empty states. `aria-live="polite"`.

---

## 9. Infinite list / Load More

Replace numbered pagination with explicit `Завантажити ще`; `useInfiniteQuery`, backend remains pageNumber/pageSize, page size 24, initial page 1, next only while page < pagesCount. No canonical `page` URL and no automatic infinite scroll.

Server-query identity: q + quick + Advanced + semantic sort mapping + locale if current hook requires it; **view excluded**. q/filter/sort change starts fresh page 1 and must not show old-query pages as matching results; safest default is no Publishers `keepPreviousData`. View changes preserve loaded pages. Flatten + dedupe by publisher id.

Next-page fetch keeps existing results visible; button loads/disables. Next-page error keeps results/counter and shows `Не вдалося завантажити ще видавництва` + `Спробувати ще раз`, retrying only that page. Remove rendered `PublisherPagination`.

---

## 10. Publisher Grid Card and List Row

Shared hierarchy: identity → country/custom marker → booksCount → readCount/wantToBuyCount/seriesCount → averageRating+ ratedBooksCount → `Останнє поповнення`/lastBookAddedAt. Do not add readingCount/wantToReadCount/queueCount.

**Grid card:** building icon; name; country (`Без країни` when missing); `Власне` only for custom; `{count} книг` + `у бібліотеці`; exactly `Прочитано`, `У списку бажань`, `Серії`; rating `★ {value} · {count} оцінок` or `Без оцінок`; activity `Останнє поповнення {date}` or `—`. Remove `Переглянути →`; keep whole-card stretched link and current hover/focus.

**List row:** wide metric blocks Identity / Книги / Прочитано / Список бажань / Серії / Рейтинг / Останнє поповнення. Custom marker only when custom. No rigid HTML table/horizontal-scroll table; mobile stacks naturally.

---

## 11. Sidebar insights

Whole-library, independent of archive q/filters/sort/view/pages. Order: `Потребують уваги` → `Ще не прочитано` → `Найкраще оцінено`.

| Block              | Rules                                                                                                 | UI                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Потребують уваги` | active books without publisher; hide at 0                                                             | `{count} книг без видавництва`; `Додай видавництво, щоб статистика та фільтри були точнішими.`; CTA `Переглянути книги` → `/books?publisherPresence=missing`. Replaces old `PublishersMissingBanner`. |
| `Ще не прочитано`  | unreadCount = booksCount-readCount >0; rank unreadCount DESC, localized name ASC, id ASC; top 3       | row: publisher + localized `{count} книг залишилось`; row → `/publishers/{id}`; no CTA.                                                                                                               |
| `Найкраще оцінено` | ratedBooksCount >=3; rank averageRating DESC, ratedBooksCount DESC, localized name ASC, id ASC; top 3 | row: publisher + `★ {averageRating} · {ratedBooksCount} оцінок`; row → detail; no CTA. No medals/rank numbers/progress bars/weighted score/booksCount.                                                |

Hide each block when ineligible.

---

## 12. Mobile Overview

Reuse `PublisherOverviewPanel` / `MobilePageOverviewPanel`: 4 compact summary tiles + `Огляд видавництв` trigger.

If any insight exists, exactly 2 tabs: `Огляд` (same 4 cards, detailed) and `Інсайти` (three insight blocks in §11 order, each with own visibility rule). If no insights, omit `Інсайти` entirely; no empty-insights message. Reuse the same summary response; no mobile-only endpoint. Use existing `MobilePageOverviewLink` behavior for panel links.

---

## 13. Archive states

Priority: initial list error → initial list loading → true empty → search-only zero → filtered/combined zero → results. Load-more states remain local.

| State                     | Condition                                         | Copy/actions                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| True empty                | summary confirms zero represented publishers      | `Видавництв поки немає`; `Додай першу книгу з указаним видавництвом, і воно автоматично з’явиться тут.`; `Додати книгу` → `/books/new`                                                                                            |
| Search-only zero          | q active, quick=all, Advanced defaults, total=0   | §4 search empty; clear only q                                                                                                                                                                                                     |
| Filtered/combined zero    | total=0 and quick/Advanced active; also q+filters | `Немає видавництв за цими умовами`; `Спробуй змінити або скинути активні фільтри.`; primary `Скинути фільтри` clears quick+Advanced preserving q/sort/view; secondary `Очистити все` clears q+quick+Advanced preserving sort/view |
| Initial list error        | first list request failed                         | `Не вдалося завантажити видавництва`; `Спробуй оновити сторінку або повторити запит трохи пізніше.`; retry list only                                                                                                              |
| Initial/new-query loading | request pending                                   | view-appropriate skeleton; summary/insights own loading; no fake `0 із 0`; no old-query masquerading                                                                                                                              |

Healthy overview data may remain when list fails. Insights may remain visible when current filtered result is zero, but not for a genuinely empty library.

---

## 14. Responsive composition

Common order: Header → Summary → toolbar → quick filters → chips → counter. Load More stays in main result stream.

- **Mobile `<sm`:** compact summary + Overview trigger; search first; sort/Advanced/view controls; horizontal quick filters; chips/counter; Grid 1 col; List stacked; Results→Load More; insights only inside Overview panel.
- **Tablet `sm–<xl`:** summary 2x2; Grid 2 cols; List metrics may wrap; Results→Load More→normal-flow insights; no tablet-only drawer.
- **Desktop `xl+`:** main `min-w-0 flex-1`, gap 6; optional sticky sidebar `top-6 w-[19rem] shrink-0`, blocks gap 4. Render sidebar column only if any insight. Grid with sidebar: 1→sm:2→2xl:3; without sidebar: 1→sm:2→xl:3. No new container-query refactor.

---

## 15. Books deep-link integration

Reuse existing backend/shared `publisherPresence = all | assigned | missing`; do not add another backend filter.

Expose it in Books frontend URL/query handling. Publishers CTA is `/books?publisherPresence=missing`. Books must parse/forward it, treat non-default value as active, include it in reset/clear-all, and show removable chip `Без видавництва` (`assigned` → `З видавництвом`). Removing chip clears only publisherPresence.

Do **not** add a Books Advanced Filter control just for this CTA. Because the Sheet has no publisher-presence control, exclude both `q` and `publisherPresence` from the Advanced Filters button badge count.

---

## 16. i18n

Update `uk.json` and `en.json`; use next-intl pluralization for count phrases. No missing English keys. Do not perform unrelated translation-key cleanup.

---

## 17. Cleanup limits

Remove from rendered archive: numbered pagination, old `PublishersMissingBanner`, old separate order toggle, and replaced toolbar controls. Before deleting obsolete Publisher-only component files, do one direct reference search; delete only if unused. No broad dead-code cleanup. Preserve old API fields/query compatibility when removal increases blast radius; new frontend may simply stop using them.

---

## 18. Archive non-goals and compatibility guards

Do not add direct publisher creation, relevance sort, quick-filter counts, auto infinite scroll, extra insight/mobile APIs, new numeric/metadata archive filters, speculative memoization/virtualization, or global style/token redesign. Do not redesign unrelated book pages. Shared components may gain narrow optional props required later by Publisher Details, with current defaults unchanged.
