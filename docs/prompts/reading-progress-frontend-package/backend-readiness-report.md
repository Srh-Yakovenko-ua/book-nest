# Backend readiness report — Reading Progress

## Status

`READY_WITH_DIFFERENCES` — контракт семантично повний; єдина відмінність — `recordedAt` не nullable (backend завжди повертає рядок).

## Endpoint

- Route: `GET /api/books/:id/reading-history`
- Controller/handler: `apps/api/src/modules/books/api/book-reading.controller.ts` → `getReadingHistory` (JwtAccessGuard, book-scoped через `user.id`)
- Service/use case: `apps/api/src/modules/books/application/book-reading.service.ts` → `getReadingHistory`; групування/розрахунки у `apps/api/src/modules/books/domain/reading-history.mapper.ts`
- Generated hook: `useBookReadingControllerGetReadingHistory` (`apps/web/src/shared/api/generated/endpoints/books/books.ts`)
- Query-key helper: `getBookReadingControllerGetReadingHistoryQueryKey(id, params)` → `["/api/books/${id}/reading-history", params]`
- Generated response type: `ReadingHistoryViewDto` (модель у `shared/api/generated/model/readingHistoryViewDto.ts`)

## Query support

| Capability                | Status | Actual name/behavior                                   | Notes                                             |
| ------------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------- |
| activityRange 7d/14d/all  | ✅     | `activityRange: "7d" \| "14d" \| "all"`, default `7d`  | Zod enum у `ReadingHistoryQuerySchema`            |
| page                      | ✅     | `page`, `coerce.int().min(1)`, default `1`             |                                                   |
| limit                     | ✅     | `limit`, `min(1).max(100)`, default `20`               | **`limit: 3` підтримується** (compact block)      |
| sort asc/desc             | ✅     | `sort: "asc" \| "desc"`, default `desc`                | `history.days` уже відсортовані сервером          |

## Response support

| Section / field group        | Status | Actual mapping                                                                 | Critical? |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ | --------- |
| summary current progress     | ✅     | `summary.currentPage/pagesCount/progressPercent/pagesRemaining`               | yes       |
| status dates                 | ✅     | `summary.startedAt/finishedAt/pausedAt/abandonedAt/lastProgressUpdateAt`       | yes       |
| reading period               | ✅     | `summary.readingPeriod.{startDate,endDate,calendarDays}`                        | yes       |
| active stats                 | ✅     | `summary.activeDaysCount/updatesCount/trackedPagesRead/averagePagesPerActiveDay` | yes     |
| best/last activity           | ✅     | `summary.bestDay/lastActivity` (`ReadingDaySummaryView`, nullable)             | yes       |
| forecast                     | ✅     | `summary.estimatedActiveDaysRemaining` (nullable)                              | conditional |
| completeness                 | ✅     | `summary.historyCompleteness.{isComplete,untrackedPages}`                       | yes (legacy) |
| activity summary             | ✅     | `activity.summary.{activeDaysCount,pagesRead,updatesCount,averagePagesPerActiveDay,bestDay}` | yes |
| chart points with zero days  | ✅     | `activity.points[]` з `hasActivity` (нульові календарні дні присутні)          | yes       |
| grouped history days         | ✅     | `history.days[]` (`date`, `pagesRead`, `updatesCount`, `startPage`, `finalPage`) | yes     |
| events                       | ✅     | `history.days[].events[]` (`id`, `date`, `page`, `pagesRead`, `recordedAt`)    | yes       |
| server pagination            | ✅     | `history.pagination.{page,limit,totalDays,totalPages,hasNextPage,hasPreviousPage}` — за day groups | yes |

## Mutation invalidation readiness

- Progress mutation: `POST /api/books/:id/reading-progress` → `useUpdateReadingProgress`
- Status mutation: `POST /api/books/:id/reading-status` → `useChangeReadingStatus`
- Available query-key helper: `getBookReadingControllerGetReadingHistoryQueryKey`
- Recommended invalidation: `useBookMutationSync` наразі **не** покриває reading-history (ключ `["/api/books/${id}/reading-history", params]`, а `matchesBooksExceptDetail` матчить лише `key[0] === "/api/books"`). Треба додати предикат, що інвалідовує всі ключі з `queryKey[0] === "/api/books/${id}/reading-history"` для конкретного `bookId` (усі range/page/sort).

## Differences from expected contract

1. `event.recordedAt` — очікуваний контракт `string | null`, фактичний `z.string()` (не nullable; мапиться з `event.createdAt.toISOString()`, який ніколи не null). Отже стан «час прихований, бо `recordedAt` відсутній» на практиці недосяжний. FE реалізує його лише як defensive-гілку; тест #32 адаптується/пропускається з поясненням.
2. Іменування day-summary — `bestDay`/`lastActivity` мають тип `ReadingDaySummaryView` з `finalPage: number | null` (у прикладі контракту `finalPage: number | null` теж — збіг).
3. Все інше семантично й номінально збігається з `docs/03-api-contract.md`.

## Blockers

Немає. Жодного критичного блокера з §2.7: endpoint, generated hook, grouped days, activity points, server pagination, заборонені-на-FE summary-розрахунки, book-scoped доступ і query sort/range — усе присутнє.

## Decision

- [x] Proceed with full frontend implementation (з єдиним mapping-нюансом на `recordedAt`).
