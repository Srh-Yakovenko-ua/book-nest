# Characters catalog: follow-ups

These are the limits we found while reworking the characters catalog filters and the book Characters tab on branch `fix/fixes-2026-10-20` (2026-10-20). They were left out on purpose to keep that PR UI-only. The plan is to fix them in the next PR.

Items 1 and 7 need new backend endpoints, so they change the API contract. Run `/blast-radius` on them and send them through a PR with full CI. Items 2 to 6 are frontend only.

## 1. Species chip shows "Без назви" after a reload

Open `/uk/characters?speciesId=<id>` with filters that match no character, for example `?seriesId=<id>&speciesId=<id>&spoilers=without`. The active-filter chip reads "Вид: Без назви" instead of "Вид: Людина".

This happens because there is no endpoint that returns a species by id. `useCatalogSpeciesNames` (`apps/web/src/features/characters/model/use-catalog-species-names.ts`) borrows the name from the `species` field of loaded characters, or from a name picked in the sheet during the same session. With an empty result after a reload it has neither source. `GET /api/species/search` without a term returns a short default list, not every species. `GET /api/species/browse` pages through 30 at a time.

Fix: add `GET /api/species?ids=<uuid>,<uuid>` returning `SpeciesOptionView[]`, and call it from the chips hook only while a species filter is active. That is the same pattern `useSeriesDetails(id, { enabled })` follows for the series chip.

## 2. Opening the filter sheet fires two list requests

The series and book pickers in the sheet (`characters-series-filter.tsx`, `characters-book-filter.tsx`) fetch their first page as soon as the sheet opens. They should wait until their own popover opens. Every open of the sheet costs one `/api/series` and one `/api/books` request, even when the user only wants to change the gender.

It gets worse once the data is stale. Closing the popover resets the search to an empty string, so the empty-search query becomes active again. After 30 seconds (the default `staleTime`), TanStack refetches every page it holds for that infinite query, one after another. A user who scrolled the book list to page 3 pays three `/api/books` requests on the next open, plus the same for series.

Fix: add an `enabled` option to `useSeriesPickerOptions` (series feature) and `useCharacterBookOptions` (characters feature), and pass the popover's open state.

## 3. Catalog URL ids are not validated

`bookId`, `speciesId`, `tagId`, `seriesId` and `groupId` are parsed as plain strings in `characters-catalog-query.ts`. A malformed id in the URL reaches the backend, which answers 400, and the page shows the catalog error state.

Fix: validate them as UUIDs in the nuqs parsers and drop invalid values, so a bad link falls back to an unfiltered catalog.

## 4. The loading label is announced twice

During the first catalog load, "Завантаження персонажів" appears both in the new results counter line (`aria-live="polite"`) and in the skeleton's `sr-only` status in `characters-catalog-content.tsx`. A screen reader reads it twice. The library has the same shape, so check it there too and fix both the same way. Either the counter stays empty while pending, or the skeleton drops its own label.

## 5. The "shown" number can drop on very long scrolls

`useCharactersCatalog` keeps at most 10 pages (`maxPages: 10`, 240 characters). Past that, the oldest page leaves the cache, and the counter "Показано N із K" counts only the pages in memory, so N goes down while the user scrolls on. K stays correct. Either count from the page numbers instead of the items held, or raise the cap.

## 6. Tag chip flashes "Без назви" while loading

Series, book and group chips show "…" while their name loads and "Без назви" only if the lookup fails. The tag chip still shows "Без назви" for a moment after a reload, because `useSelectedTags` (`apps/web/src/features/books/api/use-tags-search.ts`) returns only a `ReadonlyMap` and no query state. Four other screens use that hook (`books-archive`, `favorites-view`, `library-tag-filter`, `reading-queue-view`), so changing what it returns belongs in its own change.

## 7. Counts next to filter options (deferred step 3)

The library sheet shows how many books each option would match, for example "Центральний 12". The characters sheet shows no counts, and the species options were made count-less on purpose (`FacetOption.count` became optional for that). Books get their numbers from a facets endpoint. Characters have none.

Fix: add a characters facets endpoint that returns counts per importance, role, gender, species, attitude, tag and group, respecting the other active filters, then pass the counts into the sheet. This is the largest item here and can ship on its own.

## Not verified in the first PR

The phone-width check (375px) was not done for any of the ten fixes. The Chrome extension cannot shrink the window, so it needs Playwright against Storybook or the app. The catalog toolbar, the sheet and the book Characters tab are the ones worth a look, since their sort selects grew to `sm:w-80`.

## Related, planned separately

The attitude value "Улюблений" (`favorite`) duplicates the heart and will be removed in its own PR, with a data migration that maps the global `favorite` to `like` and also sets the heart, and the per-book `favorite` to `like` only. It is not a limit of this work, but it touches the same filter sheet.
