# Series order check — backend audit

Read-only audit of the current backend, performed before implementing the
"Перевірити порядок серій" (series order check in the reading queue) feature.
Spec lives locally in `apps/api/md/series-order-check/` (gitignored). This file
records what already exists, what is missing, and the design decisions that
follow from it.

## Уже є (reuse, do not duplicate)

- **Canonical series order** = `Book.partNumber Int?`. Single comparator
  `compareByPartThenCreated` in `apps/api/src/modules/series/domain/series-preview.ts:42`
  (nulls sort last, tiebreak by `createdAt` asc). Used by series details,
  `selectNextBook`, and favorite-continuations. Reuse via a new barrel export.
- **`@@unique([seriesId, partNumber])`** (`schema.prisma:238`) → no duplicate
  non-null `partNumber` inside a series. Multiple `null` parts may coexist and
  order by `createdAt`.
- **Series helpers**: `computeHasUnreadEarlierParts`, `selectNextBook`,
  `toSeriesBookPreview`, `toSeriesView` (series domain). None returns "the
  earliest unclosed part strictly earlier than a given queued book" — compose it
  from the comparator + a filter.
- **Reading queue** = `Book.queuePosition Int?`, contiguous `1..N` per user,
  serialized by a per-user advisory lock
  `pg_advisory_xact_lock(hashtext(userId))`. Repository primitives
  (`reading-queue.repository.ts`): `acquireUserQueueLock`, `clearPosition`,
  `count`, `findQueuedBookIds`, `findQueuePosition`, `listQueue`, `setPosition`,
  `shiftDownFrom`, `shiftUpAfter`. `maxQueuePosition` lives on
  `BooksRepository`. Reorder = permutation validation + `setPosition` loop.
- **Mutations run in `TransactionRunner.run` + advisory lock** — mirror this for
  every queue-mutating apply.
- **Reading status enum** (`book-enums.ts`): `not_started, want_to_read,
reading, paused, finished, dnf, rereading`. "Actively reading" =
  `readingStatus ∈ {reading, rereading}` (no session entity; multiple books may
  be reading at once).
- **Ownership enum**: `none, want_to_buy, in_transit, owned,
borrowed_from_someone, lent_to_someone`. Existing ownership / purchase /
  delivery / loan endpoints already exist (book-ownership / book-delivery /
  book-loan controllers) — the feature only emits `allowedActions` codes; the FE
  points at those existing routes. No new ownership endpoints.
- **Error classes** (`core/exceptions/errors.ts`) all accept `{ code }`, surfaced
  into the JSON body by `http-error.filter.ts`: `ConflictError` (409),
  `NotFoundError` (404), `ForbiddenError` (403), `ValidationError` (422),
  `BadRequestError` (400).
- **Per-user 1:N table pattern** to mirror for the new tables: `UserSocialLink`
  - `social-link.repository.ts`.

## Немає (must add)

- **Optimistic-concurrency token** — no `version`/ETag on Book or the queue.
- **Queue size limit** — none anywhere (`REORDER_MAX = 1000` is only a payload
  array bound).
- **Ignore / disable / preference storage** — no ignore, dismiss, fingerprint,
  or generic per-user KV store. New tables required.
- **A single canonical "closed status" helper** — semantics diverge:
  `computeHasUnreadEarlierParts` treats only `{finished}` as closed, while
  `favorite-continuations` uses `{finished, dnf}`.

## Канонічний порядок

- Field: `Book.partNumber` (`Int?`, nullable).
- Type: integer; gaps are irrelevant (comparator is relative), duplicates
  impossible for non-null (DB unique), multiple nulls ordered by `createdAt`.
- Helper: `compareByPartThenCreated` (series-preview.ts) — reused, exported from
  the series barrel.
- Fallback: null `partNumber` sorts last, tiebreak `createdAt` asc. A book with
  `null` part is never used as a "previous" that would produce a false warning.

## Фактичний порядок черги

- Field: `Book.queuePosition` (`Int?`); "in queue" ⇔ not null.
- Reorder: permutation → `setPosition` loop under advisory lock in a transaction.
- Queue limit: introduced by this feature — `READING_QUEUE_LIMIT` constant +
  `QUEUE_LIMIT_REACHED` check on add strategies.

## Reading status

- Source of truth: `Book.readingStatus` (string, parsed to enum in mappers).
- DNF semantics (decision): **closed = `{finished, dnf}`** (a `dnf` earlier part
  does not block a later one), matching the spec and
  `favorite-continuations.CLOSED_STATUSES`. `computeHasUnreadEarlierParts`
  (only `{finished}`) is left unchanged — it feeds `BookView.hasUnreadEarlierSeriesParts`
  and changing it would alter existing behavior. A shared
  `isClosedReadingStatus` helper (`{finished, dnf}`) is added for this feature;
  reconciling the older helper is out of scope.

## Optimistic concurrency (decision)

- No token exists. **Derive `queueVersion` = sha256 hex (truncated) of the
  newline-joined `${bookId}:${queuePosition}` for the user's queued books,
  ordered by `queuePosition`.** Changes iff queue membership/order changes;
  immune to unrelated book edits (unlike `max(updatedAt)`). Stateless, no
  migration. Type `string`. Recomputed under the advisory lock inside apply;
  mismatch with `expectedQueueVersion` → `409 QUEUE_STALE`.

## Ignore / disable (decision)

- Two new per-user 1:N tables (mirror `UserSocialLink`), FK `userId` +
  `seriesId` both `onDelete: Cascade` (series/user deletion auto-clears):
  - **ignored issue** — `(userId, seriesId, fingerprint, problemType,
affectedBookId, previousBookId, createdAt)`, `@@unique([userId, fingerprint])`.
    Detection drops issues whose fingerprint is in the user's ignore set. When
    the conflict essence changes the fingerprint changes → issue reappears.
    Book-delete leftovers are harmless (fingerprint never matches again).
  - **disabled series** — `(userId, seriesId, createdAt)`,
    `@@unique([userId, seriesId])`. Presence = disabled (row inserted on
    `enabled:false`, deleted on `enabled:true`). Detection skips disabled series.
- **Fingerprint** = sha256 hex of a canonical string of `userId, seriesId,
problemType, affectedBookId, previousBookId, the affected/previous queue
positions, the relevant reading statuses, and the relevant part numbers`.
  Deterministic; changes only when the conflict essence changes.

## Обрані маршрути (adapted to existing API style)

- `GET  /api/reading-queue/series-order-issues?limit=3`
- `POST /api/reading-queue/series-order-issues/:fingerprint/preview` `{ strategy, expectedQueueVersion }`
- `POST /api/reading-queue/series-order-issues/:fingerprint/apply` `{ strategy, expectedQueueVersion }`
- `POST /api/reading-queue/series-order-issues/:fingerprint/ignore`
- `PUT  /api/series/:seriesId/order-check-preference` `{ enabled }`

New module `apps/api/src/modules/series-order-check/` (api / application /
domain / infrastructure + barrel), registered in `app.module.ts`. Depends on
series, reading-queue, books via their public barrels (adding the missing
exports: `compareByPartThenCreated`, `isClosedReadingStatus`,
`ReadingQueueService` + primitives). Route prefixes stay under
`api/reading-queue/...` and `api/series/...` regardless of module folder.

## План змін

- **Slice 1 (foundations)**: shared DTOs (`series-order-check.ts` view + input
  schemas), 2 Prisma models + additive migration, barrel exports,
  `isClosedReadingStatus` in shared.
- **Slice 2 (detection + list)**: pure detection engine (domain) + batch
  repository loaders (no N+1) + fingerprint + `queueVersion` + service + `GET`
  endpoint.
- **Slice 3 (preview + apply)**: server-side preview + atomic apply of the three
  strategies (`ADD_NEXT_PREVIOUS_BEFORE`, `ADD_ALL_PREVIOUS_BEFORE`,
  `REORDER_SERIES_SLOTS`) with concurrency + stale re-check + domain error codes.
- **Slice 4 (ignore + disable)**: ignore-by-fingerprint + disable/re-enable
  endpoints, wired into detection filtering.
- **Slice 5 (tests)**: detection unit matrix + preview/apply/ignore/disable
  integration; regression check of existing queue/series flows.
- **Review round**: migration-reviewer, code-reviewer, security-reviewer,
  backend-bug-hunter; fix; commit; push.

## Migrations, if truly needed

- One additive migration: two new tables (no changes to existing tables). No
  `queueVersion` column (derived). Nullable-only, no backfill.

## Тести

- Detection unit tests for every problem type + severity/ranking + edge cases
  (gaps, null/duplicate parts, deleted/disabled series, ignored fingerprint,
  finished/dnf, borrowed availability). Integration for preview/apply of all
  three strategies (contiguity, no duplicate, queue limit, idempotent re-apply,
  rollback, stale queue/issue, user isolation, auth, invalid strategy).
