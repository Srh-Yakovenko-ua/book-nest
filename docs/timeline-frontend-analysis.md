# Timeline (Хронологія подій) — frontend integration plan

> Coordination contract for the `feat/chronology` frontend. Source of truth for requirements:
> `/home/m-shavlak/WebstormProjects/book-nest/docs/booknest-timeline-docs/booknest-timeline-claude-code-docs/`
> (folders `decisions/`, `shared/`, `frontend/`). Read those for behaviour; read THIS for architecture.

## 0. Status of the backend (verified — fully implemented on `dev`)

The whole contract layer already exists and is committed on `origin/dev`:

- **Shared DTOs**: `packages/shared/src/timeline.ts` (all schemas + enums + `TIMELINE_ERROR_CODES`).
- **Generated client** (never hand-edit): `apps/web/src/shared/api/generated/endpoints/timelines/timelines.ts`
  and `.../endpoints/timeline-events/timeline-events.ts`, plus models under `.../generated/model/*`.
- **Backend module**: `apps/api/src/modules/timeline/**`.

**There are no blocking backend gaps.** Reading position is delivered by the overview endpoint
(`readingPosition: { currentPage, positionKnown, guardDefault }`), so the FE never invents its own
progress store. See `timeline-backend-gaps.md`.

### Endpoints (all require auth; all under `/api`)

Timelines (`useTimelines*` generated hooks + plain async fns):

- `GET  /books/:bookId/timelines` → `TimelineListView` `{ timelines: TimelineView[] }` (always includes the default line, even with 0 events)
- `GET  /books/:bookId/timeline/summary` → `TimelineSummaryView` `{ totalEvents, timelines: [{timelineId, eventsCount}] }` (tab badge + per-line counts, filter-independent)
- `POST /books/:bookId/timelines` (`CreateTimelineInput`) → `TimelineView`
- `POST /books/:bookId/timelines/reorder` (`ReorderTimelinesInput`) → `TimelineListView`
- `PATCH /timelines/:timelineId` (`UpdateTimelineInput`) → `TimelineView`
- `POST /timelines/:timelineId/set-default` (`SetDefaultTimelineInput`) → `TimelineListView`
- `DELETE /timelines/:timelineId?strategy=move|delete&targetTimelineId=…` → 204

Events (`useTimelineEvents*`):

- `GET  /books/:bookId/timeline-events` (`TimelineEventsQuery`) → `Paginator<TimelineEventView>`
- `GET  /books/:bookId/timeline/overview` → `TimelineOverviewView` (distributions + reading position)
- `POST /books/:bookId/timeline-events` (`CreateTimelineEventInput`) → `TimelineEventView`
- `GET  /timeline-events/:eventId` → `TimelineEventDetailView` (adds `relations`, `resolvedBy`, `resolves`)
- `PATCH /timeline-events/:eventId` (`UpdateTimelineEventInput`) → `TimelineEventView`
- `DELETE /timeline-events/:eventId` → 204
- `POST /timeline-events/:eventId/reorder` (`ReorderTimelineEventInput`, `scope: "book"|"timeline"`) → `TimelineEventView`
- `POST /timeline-events/:eventId/move` (`MoveTimelineEventInput`) → `TimelineEventView`
- `POST /timeline-events/:eventId/relations` (`CreateEventRelationInput`) → `CreatedEventRelationView`
- `DELETE /timeline-event-relations/:relationId` → 204

### `TimelineEventsQuery` fields (all optional unless noted)

`timelineId?` (omit = "All timelines" aggregate), `eventType?: string[]`, `importance?: string[]`,
`important?: boolean` (preset high+key), `keyOnly?: boolean` (preset key), `unresolved?: boolean`
(threadStatus=open), `recap?: boolean` ("Що вже сталося" — events up to reading position),
`search?: string`, `sort: book_order|timeline_order|importance|newest|oldest` (default `book_order`),
`pageNumber` (default 1), `pageSize` (default 50).

CSV multi-enums (`eventType`, `importance`) are sent comma-joined; the generated params type takes
`string[]` and orval serialises them. Prefer sending `important`/`keyOnly` booleans for the presets
rather than an explicit `importance` array (backend maps presets), BUT since the UI model is a single
importance multiselect (decisions/06), send `importance` as the array and DO NOT also send the preset
booleans — presets are just UI shortcuts that set the multiselect. Pick ONE representation per request.

## 1. Conventions to mirror (reference files)

- **Feature slice** shape (`api/ components/ model/ hooks/ index.ts`): `apps/web/src/features/notes/**` and
  `apps/web/src/features/quotes/**` are the closest analogues (per-book sub-resource, tab block, form dialog,
  delete dialog, actions menu, filters toolbar, states).
- **Query hook**: `features/notes/api/use-book-notes.ts` — call generated async fn, `Schema.parse(response)`,
  `retry: false`. `customInstance`/`request` returns the JSON body directly (NOT `{data,status}` — the generated
  response types are misleading; always re-parse with the `@app/shared` schema and return the parsed value).
- **Mutation hook**: `features/notes/api/use-create-note.ts` — `useMutation`, parse response, invalidate keys in
  `onSuccess`. Toasts live in the component (`toast.success/error` from `sonner`), not the hook.
- **Key factory**: `features/notes/api/notes-keys.ts`.
- **Form dialog** (RHF + `zodResolver` + shadcn `Dialog/Select/Input/Textarea/Switch` + `FieldError` +
  char counters + `blockNegativeNumberKeys/Paste` for numeric): `features/notes/components/note-form-dialog.tsx`.
- **Form schema builder** in `model/`: `features/notes/model/note-form-schema.ts`.
- **Toolbar / filters**: `features/notes/components/notes-archive-toolbar.tsx`,
  `features/books/components/reading-queue-toolbar.tsx`.
- **Actions menu (DropdownMenu, not hover-only)**: `features/notes/components/note-actions-menu.tsx`.
- **Delete confirm dialog**: `features/notes/components/delete-note-dialog.tsx`.
- **Tabs + `tab`/`timelineId` URL state via `nuqs`**: `features/books/components/book-details-view.tsx`
  (uses `parseAsStringLiteral` + `useQueryState`). `PageTabs`/`PageTabsPanel` from `@/components/page-tabs`;
  `PageTabsItem` has an optional `badge` — use it for `Хронологія {count}`.
- **Infinite scroll / pagination**: reuse existing pattern; check `features/**/hooks/use-infinite-scroll*`
  or the notes/quotes list. Prefer a "Load more" button OR the project's infinite-scroll hook — do NOT invent
  virtualization (measure-before-optimize rule).
- **Icons**: `@/components/icons` → `UiIcon name=… ` with `UiIconName` union
  (`apps/web/src/components/icons/ui-icon.tsx`). No new icon library.
- **Primitives are vendored** in `apps/web/src/components/ui/**` — do NOT edit them. `Button` and
  `DropdownMenuItem` already have `cursor-pointer`; add `cursor-pointer` to custom clickables.
- **Styling**: Tailwind v4 semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`,
  `bg-card`, `text-brand`, `bg-destructive`…). Mobile-first. Respect `prefers-reduced-motion`
  (use `motion-safe:` like the existing views).

## 2. i18n

Two locales only: `apps/web/src/messages/uk.json` (default) + `en.json`. Add ONE new top-level namespace
`timeline` with the full key tree below, and the tab label under `books.details.timeline`. Keep both files in
perfect key-parity (same keys, translated values). User-entered timeline names are never translated.
Microcopy source: `frontend/14-localization-microcopy.md`, `frontend/02`, `frontend/10`. Event-type and
importance labels: `decisions/06`. Colour-key labels optional.

Key groups to create (uk + en): `timeline.tab` (with `{count}`), `timeline.subtitle`, `timeline.allLines`
`{count}`, `timeline.mainLine`, `timeline.newLine`, `timeline.manageLines`, `timeline.addEvent`,
`timeline.newEvent`, `timeline.editEvent`, `timeline.view.{stream,list,overview}`,
`timeline.sort.{bookOrder,timelineOrder,importance,newest,oldest}`,
`timeline.preset.{importantEvents,keyOnly}`, `timeline.recap` ("Що вже сталося"),
`timeline.guard` ("Ховати те, що попереду") + `timeline.guardReveal` ("Показати"),
`timeline.positionMarker` ("Ти зараз тут"), `timeline.eventType.*` (14 keys), `timeline.importance.*` (4),
`timeline.relationType.{follows_from,foreshadows,related}` + inverse labels
(`…Inverse` e.g. "передвіщено подією"), `timeline.thread.{open,resolved,resolvedBy}`,
`timeline.form.*` (all field labels + placeholders + helper + `moreFields` + `saveAndAddAnother` +
`saveEvent` + `cancel` + counters + dirty-close confirm), `timeline.filters.*`, `timeline.states.*`
(loading/error/empty/emptyLine/filteredEmpty/saving/deleting texts from `frontend/10`),
`timeline.manage.*` (rename/description/marker/setDefault/reorder/delete + delete-with-events strategy:
`moveEvents`, `deleteWithEvents`, event-count line), `timeline.overview.*` (section titles: byType,
byImportance, byLine, chapterDensity, unresolved, beforeAfterPosition), `timeline.toast.*`
(created/updated/deleted/moved/reordered + *Error, relationAdded/removed, lineCreated/updated/deleted/
defaultChanged + errors).

## 3. Module structure — `apps/web/src/features/timeline/`

Each file = one concern, one default-ish export. All string literals via `useTranslations("timeline…")`.

### `model/` (pure, no React except the URL-state hook)

- `event-type-meta.ts` — `EVENT_TYPE_META: Record<TimelineEventType, { icon: UiIconName; labelKey: string }>`.
  Icon map (all exist in the union): `main:"star"`, `mystery:"eye"`, `character_appearance:"user"`,
  `death:"x-circle"`, `betrayal:"alert-triangle"`, `battle:"flame"`, `romance:"heart"`, `conflict:"target"`,
  `travel:"globe"`, `magic:"sparkles"`, `politics:"building"`, `conversation:"quote"`, `twist:"swap"`,
  `other:"circle-slash"`. Ordered list `TIMELINE_EVENT_TYPES` from `@app/shared`.
- `importance-meta.ts` — `IMPORTANCE_META: Record<TimelineImportance, { labelKey; badgeClass }>` using
  semantic tokens (e.g. `key`→`bg-brand/15 text-brand`, `high`→`bg-warning/15 text-warning`,
  `medium`→`bg-muted text-muted-foreground`, `low`→`text-muted-foreground border border-border`). Order
  `TIMELINE_IMPORTANCE_LEVELS`.
- `color-key.ts` — the ONLY raw-colour usage, justified by the fixed `TIMELINE_COLOR_KEYS` contract, scoped
  to a tiny marker dot; the line name always renders too (a11y). `TIMELINE_MARKER_CLASS: Record<TimelineColorKey,string>`
  → `slate:"bg-slate-400"`, `stone:"bg-stone-400"`, `amber:"bg-amber-500"`, `orange:"bg-orange-500"`,
  `rose:"bg-rose-500"`, `red:"bg-red-500"`, `emerald:"bg-emerald-500"`, `teal:"bg-teal-500"`,
  `sky:"bg-sky-500"`, `blue:"bg-blue-500"`, `violet:"bg-violet-500"`, `fuchsia:"bg-fuchsia-500"`; helper
  `markerClass(key: TimelineColorKey | null)` → falls back to `bg-muted-foreground/40` for null.
- `importance-preset.ts` — bidirectional map: multiselect set `["high","key"]` ⇔ preset `importantEvents`,
  `["key"]` ⇔ `keyOnly`; helper to detect which preset (if any) a multiselect equals.
- `timeline-events-query.ts` — UI filter/sort state type `{ timelineId: string | null; search; eventType:
TimelineEventType[]; importance: TimelineImportance[]; unresolved: boolean; sort: TimelineEventSort;
recap: boolean }` + `toApiParams(state): TimelineEventsControllerListEventsParams` (send `importance`
  array, never also preset booleans; omit empty arrays; omit `timelineId` for All-lines). Default sort:
  `timeline_order` in a specific line, `book_order` in All-lines.
- `timeline-view-mode.ts` — `"stream" | "list" | "overview"`; persistence in `localStorage`
  (key e.g. `booknest.timeline.view`) with a Zod guard, mirroring any existing preference pattern.
- `use-timeline-url-state.ts` — `nuqs`: `view` (stream|list|overview), `timelineId` (string|null; invalid id
  is cleared → All-lines, no 404 per `frontend/13`). Keep `tab` in the parent `book-details-view`.
- `event-form-schema.ts` — RHF schema mirroring `CreateTimelineEventInputSchema` limits
  (title 1–150, summary ≤300, description ≤5000, chapter ≤100, location ≤200, storyTime ≤100,
  personalNote ≤3000, page int ≥1 and ≤ book `pagesCount` when known → localized error). `buildEventFormSchema(msgs)`,
  `eventFormDefaults({ timelineId, readingPosition, event? })`, `eventFormValuesToInput(values)`. Empty optional
  strings normalise to `null`. Quick vs full is a UI toggle over the SAME schema/values (decisions/11).
- `reading-position.ts` — pure helpers: given ordered events + `currentPage`, compute the marker split index
  (last event with `pageNumber <= currentPage` vs first after; events without page don't participate). Guard:
  an event is "ahead" iff it has a `pageNumber > currentPage`. Recap is server-side (`recap:true`), so client
  guard only blurs/hides ahead-events with a reveal action.

### `api/` (one file per hook; keys in `timeline-keys.ts`)

Queries: `use-book-timelines`, `use-timeline-summary`, `use-timeline-overview`, `use-timeline-events`
(paginated; consider `useInfiniteQuery` if the project has that pattern, else page state), `use-timeline-event`
(detail, `enabled` when an id is open). Mutations (each invalidates the right keys on success — see §4):
`use-create-timeline-event`, `use-update-timeline-event`, `use-delete-timeline-event`,
`use-reorder-timeline-event`, `use-move-timeline-event`, `use-create-event-relation`,
`use-delete-event-relation`, `use-create-timeline`, `use-update-timeline`, `use-delete-timeline`,
`use-set-default-timeline`, `use-reorder-timelines`.

### `components/`

- `book-timeline-block.tsx` — **the tab body / orchestrator** (`"use client"`). Owns URL state + filter state,
  fetches timelines + summary + overview + events, decides single-line vs multi-line switcher, renders toolbar,
  the active view, the add-event entry (desktop button vs mobile FAB — never both), and mounts the dialogs.
  Exported from the barrel and rendered by `book-details-view.tsx` in a new `timeline` tab panel.
- `timeline-switcher.tsx` (+ single-line variant), `manage-timelines-dialog.tsx`, `timeline-form-dialog.tsx`
  (create/edit line: name/description/marker), `delete-timeline-dialog.tsx` (shows event count; when >0 forces
  `move` [+ target select] or `delete` strategy; dangerous option visually separated + extra confirm).
- `timeline-toolbar.tsx`, `timeline-filters.tsx` (line, type, importance multiselect + presets, unresolved),
  `timeline-search.tsx` (debounced), `timeline-sort.tsx`, `timeline-view-switch.tsx`.
- `event-stream-view.tsx` (vertical rail; chapter grouping ONLY when sort=book_order; position marker;
  storyTime gap divider in single-line mode; guard blur/reveal), `event-list-view.tsx` (desktop rows →
  mobile cards), `timeline-overview-view.tsx` (distributions as bars/counters using existing components,
  no chart lib; click a type/line → set filter + switch to stream).
- `event-card.tsx`, `event-list-row.tsx`, `event-actions-menu.tsx` (view/edit/move up-down-top-bottom/
  move-to-line/delete — always visible, not hover-only), `event-detail-dialog.tsx` (all filled fields, empty
  sections omitted; Related events section with navigation to each; thread status + resolvedBy link; footer
  edit/delete/close), `event-form-dialog.tsx` (quick default → "Більше полів" expands full without losing
  input; "Зберегти й додати ще" keeps line, resets content+type+importance to defaults, stays open;
  dirty-close confirm; save error keeps form open with data), `event-relation-editor.tsx` (add relation by
  searching events by title, choose relationType), `reading-position-controls.tsx` ("Що вже сталося" toggle +
  "Ховати те, що попереду" guard switch, only when `positionKnown`; guard default from
  `overview.readingPosition.guardDefault`), `position-marker.tsx`.
- States: `timeline-skeleton.tsx`, `timeline-empty.tsx` (general), `timeline-line-empty.tsx`,
  `timeline-filtered-empty.tsx` (reset button), `timeline-error.tsx` (retry). Texts from `frontend/10`.

## 4. Cache invalidation (decisions + frontend/15)

After any event mutation invalidate: events list (all filters for the book), `summary` (tab count),
`overview` (stats), timelines list (per-line `eventsCount`), and the affected event detail. After any timeline
mutation invalidate: timelines list, summary, overview, and events (timelineName/color denormalised on events).
Also invalidate the **book detail** query (`features/books` book query key) if the tab badge / book-level
event count is derived there. Centralise these fan-outs in the mutation hooks via `timelineKeys`.

## 5. Hard constraints (from the spec — do NOT violate)

- NO characters, NO manual spoilers/`isSpoiler`, NO series chronology, NO drag-and-drop, NO AI, NO export,
  NO note/quote linking, NO new palette, NO new icon library, NO editing vendored `ui/**`.
- The automatic position guard IS in scope (blur/hide ahead-events + reveal). Reorder/move send a NEIGHBOUR
  (`afterEventId`/`beforeEventId`), never an absolute index; backend computes positions.
- Colour never the sole differentiator — always text/icon (a11y). Actions reachable by keyboard, focus returns
  to the trigger after a dialog closes, dialogs use the project's accessible `Dialog`.
- Every claim of "done" is gated by `pnpm typecheck` + `pnpm lint` + `pnpm format:check` (NOT tests, NOT UI).

## 6. Phasing (sequential; each phase must leave `typecheck`+`lint` green)

- **A – Foundation**: `model/` + `api/` + `timeline-keys.ts` + full i18n tree + barrel + wire a `timeline` tab
  into `book-details-view.tsx` with a minimal `book-timeline-block.tsx` that renders subtitle, count badge,
  loading/error/empty, the view switch shell, and the switcher (read-only). Compiles & lints clean.
- **B – Views & reading position**: stream + list + overview views, event card/row, actions menu, detail
  dialog, chapter grouping, storyTime divider, position marker + recap + guard, all states.
- **C – Event create/edit modal**: quick+full form, save-and-add-another, relations editor, thread status,
  dirty guard, page>pagesCount, save-error persistence.
- **D – Timeline management**: switcher management, create/edit line, set-default, reorder, delete-with-strategy.
- **E – Tests** (written, NOT run): render/forms/filters/mutations/states/a11y/new-features per `frontend/16`.
