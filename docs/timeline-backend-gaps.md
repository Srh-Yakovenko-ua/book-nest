# Timeline — backend gaps (frontend audit)

Verified against `origin/dev`: `packages/shared/src/timeline.ts`, `apps/api/src/modules/timeline/**`,
and the generated client under `apps/web/src/shared/api/generated/**`.

## Result: no blocking gaps.

Every frontend data need from `frontend/15-frontend-data-needs.md` and `decisions/08` is served:

- Book total event count (filter-independent, for the tab badge) → `GET /books/:bookId/timeline/summary`
  (`totalEvents` + per-line `eventsCount`).
- Per-line `eventsCount`, `isDefault`, `position`, `colorKey`, `name`, `description` → `GET /books/:bookId/timelines`.
- Paginated/filtered/sorted events with `total` for the current query → `GET /books/:bookId/timeline-events`.
- Reading position (page + `positionKnown` + `guardDefault`) → embedded in
  `GET /books/:bookId/timeline/overview` (`readingPosition`). The FE consumes the existing reading-progress
  model via this endpoint and introduces no progress storage of its own.
- Recap ("Що вже сталося") → `recap=true` query param (server filters to events up to the position).
- Overview distributions (type / importance / line / chapter density / unresolved / before-after position) →
  `GET /books/:bookId/timeline/overview`.
- Event detail with relations (both directions), `resolvedBy`, `resolves` → `GET /timeline-events/:eventId`.
- Book `pagesCount` for page validation → present on `BookView` (`packages/shared/src/books.ts`).

## Minor notes (not gaps, just integration facts)

- The events LIST response does not carry reading position; the FE reads `currentPage`/`positionKnown` from the
  overview query and renders the stream marker client-side. Both queries live in the tab.
- Importance presets (`important`, `keyOnly`) and the `importance[]` multiselect are alternative
  representations of the same filter — send only one per request (the UI uses the multiselect; see decisions/06).
