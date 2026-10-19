# Reading Goals — узкое исполнимое ТЗ

**Execution mode:** `LOW_MEMORY_EXECUTION` explicitly approved. `LOW_MEMORY_POLICY.md` is authoritative for timing/count of checks; implement stages 01–04 without running tests/global gates, then run one sequential final gate before ready-to-commit (no actual commit/push). Repo rules receive a narrowly scoped opt-in addition before starting.

**Scope:** фронтенд целей чтения Book Nest. Baseline: `dev` SHA `6de68b54a1b84dc0200a1f91188987e1c4905967`. Если текущий worktree отличается, проверяй изменённые файлы целевого модуля, не сканируй всё monorepo. Все решения утверждены, дополнительных вопросов не требуется. В случае конфликта приоритет: **текущий код и `CLAUDE.md` → реальные DTO/API → этот документ → stage-файл → полный reference**. Не модифицировать backend без доказательства, что заявленного контракта нет; при обнаруженной несовместимости сообщить явно и выбрать локальный совместимый вариант.

## Бизнес-контракт, который нельзя менять

- Цель создаётся только для собственного пользовательского списка книг: `POST /api/lists/:listId/goal`. Нельзя создать вторую неархивированную цель для списка при `status=active` (сервер 409). При создании после `completed|expired` **сервер сам архивирует** прежнюю; frontend не делает предварительный `archive`.
- При создании membership книг фиксируется в snapshot; изменения исходного списка позднее не изменяют snapshot. Одна книга засчитывается один раз при завершённом цикле чтения, датированном от **календарного дня** создания по дедлайн включительно. Исправления завершения/soft-delete обрабатывает сервер. Не внедрять ручное начисление/редактирование snapshot.
- `targetCount`: int 1..1000 и не больше snapshot; при **create** ограничение исходным числом книг, при **edit** — `snapshotBookCount`. `name`: optional до 120, `name:null` в PATCH очищает. Дедлайн будущий относительно серверного UTC-day **лишь если задан/изменён**. PATCH передаёт строго изменённые поля; submit без изменений заблокирован.
- `status`: `active/completed/expired/archived`; отдельный nullable `result`: `completed/expired/null`. Archived read-only для edit/archive, delete с confirm разрешён. Нельзя отождествлять `archived` и `expired`.
- Server = source of truth для целого количества засчитанных книг, качества засчитывания, `progressPercent` в detail/catalog, risk/pace/projection/checkpoints. **Единственное исключение:** компактный `GET /lists/:id/goal` (`ReadingGoalView`) не возвращает процент, и существующей sidebar-карточке разрешена простая визуальная формула `completedCount/targetCount` для progress bar. Не пересчитывать на клиенте риск/темп/прогноз.
- Успех/ошибки сервера остаются авторитетными: 204 list-goal => empty; error => error/retry; 409 => конфликт и refresh; mismatch UTC/local date => поле с server error.

## Существующее REST API — использовать сгенерированный Orval client + Zod parsing

| Сценарий         | Контракт                                                                       |
| ---------------- | ------------------------------------------------------------------------------ |
| create/list goal | `POST /api/lists/:listId/goal`, `GET /api/lists/:listId/goal`                  |
| catalog          | `GET /api/goals?status&sort&listId&limit&cursor`; `GET /api/goals/overview`    |
| details          | `GET /api/goals/:id`                                                           |
| books            | `GET /api/goals/:id/books?scope&limit&cursor`                                  |
| activity         | `GET /api/goals/:id/activity?type&limit&cursor`                                |
| mutations        | `PATCH /api/goals/:id`, `POST /api/goals/:id/archive`, `DELETE /api/goals/:id` |

Cursor endpoints return `items` + opaque `nextCursor|null`. `limit=20` by default (max100); `useInfiniteQuery` with `getNextPageParam: lastPage.nextCursor ?? undefined`, no cursor in URL. `detail.countedBooks/remainingBooks` are previews capped at 100, `activityPreview` capped at 5. DO NOT mistake previews for complete lists. Catalog endpoint does **not** support `q` search/facets/multiple statuses. Catalog+overview backend scan first 500 goals maximum; do not promise complete global data above that cap and do not fake client fixes.

Server enum sorts: `created_desc` (default), `created_asc`, `deadline_asc`, `deadline_desc`, `progress_desc`, `progress_asc`, `risk_desc`. Status filter: exactly one `active/completed/expired/archived` or absent. Books scopes: `all` (default), `counted`, `remaining`. Activity types: `goal_created`, `book_counted`, `book_uncounted`, `target_changed`, `deadline_changed`, `goal_renamed`, `goal_completed`, `goal_expired`, `goal_archived` (one filter or absent).

## Deliverable 1 — устранить текущие ошибки (этап 01)

- Form edit: `snapshotBookCount` вместо текущего `listBookCount` для max; create — текущий list count. Валидация past deadline при edit только когда deadline изменён. PATCH dirty-only; empty name -> `null` только при очистке. Сохранить RHF, Zod, DatePicker, field errors, toast, существующие caller props где можно.
- List goal card: отдельный loading, real-empty (204), fetch-error+Retry. Текст периода подсчёта по календарным дням, не «строго после момента создания».
- Unified `goalKeys.root` плюс key builders для будущих catalog/overview/books/activity, инвалидации после goal mutations и релевантных book reading mutations/history; без рефетча всех целей на любое действие пользователя. Обновление статистики оставить. Не трогать алгоритмы сервера.

## Deliverable 2 — `/goals` catalog (этап 02)

- Новый маршрут в App Router с локализованными metadata; пункт навигации «Цілі читання» после «Списки», ссылки из статистики должны работать.
- Header/CTA create; **4 глобальные KPI с `/goals/overview`**: active.total, completed.total, active.needsAttention, successRatePercent; когда `finishedGoals=0` показывать «—» и подсказку вместо ложного 0%. Overview не зависит от active filters. По возможности лаконичный attention (до5) и bestResult без новых API.
- Catalog из `/goals`: quick single status `all/active/completed/expired/archived` без вымышленных count, все 7 server sorts, grid/list переключатель. `nuqs` URL params `status`, `sort`, `view` с canonical defaults. Не добавлять `q` search, advanced filters, facets и client filtering неполных страниц.
- Rows/cards: title/fallback, source list (nullable), status и отдельный archived-result, backend progress/risk/pace, deadline. Длинный текст не ломает карточки; клик и action buttons разделены.
- Cursor endless scroll 20, `useInfiniteScrollSentinel`, `InfiniteScrollFooter`, hand-load/retry, loading/filtered-empty/unfiltered-empty/error/next-page-error. Кэш по server params; фильтр/сорт сбрасывают cursor.
- Create из каталога: выбрать список через **имеющийся** list search/query (`CustomListCard.bookCount` уже есть, использовать `fill=with_books`), без N+1 `GET goal` для всех карточек. После выбора **один** `GET /lists/:id/goal`; активная цель => открыть детали; completed/expired => повторное create с информированием об auto-archive. Одна существующая `GoalFormDialog`, optional create-success callback; новый goal => redirect `/goals/[id]`. Если списков с книгами нет — CTA `/lists`.

## Deliverable 3 — `/goals/[id]` tabs (этап 03)

- Шапка и единый progress bar сверху; actions edit/archive/delete c confirm; redirect после delete `/goals`, back to list когда list существует, иначе `/goals`; archived readonly, отдельно показывать `result` в том числе `null`.
- Три вкладки `Огляд/Книги/Історія`; nuqs URL `tab=overview|books|activity` default absent, `scope=all|counted|remaining` только для books, `activityType` (поддерживаемый enum) только для activity. При смене tab убирать неактуальные параметры; browser Back восстанавливает состояние.
- Overview: progress/count/remaining, дни, pace, required pace, riskReasons, milestones/checkpoints с due/achieved (даже missed+achievedAt), projectionConfidence; для low/none не утверждать точную дату. Все метрики с API, не собственные пороги.
- Books tab: `GET /goals/:id/books` cursor20, scopes, qualified date (`countedFinishedAt`), covers/authors/current progress, ссылка `/books/:id`; soft-deleted/нет книги => gracefully. Никаких полных списков из 100-book preview. `completedCount` может превышать `targetCount` при capped progress 100%.
- Activity: `GET /goals/:id/activity` cursor20, optional `type`, перевод всех 9 событий, date grouping только если вписывается в существующий UI; `metadata` nullable/unknown, безопасный fallback без runtime crash, book link only if `book` exists.
- В каждой вкладке skeleton, independent error/empty, next-page retry, preserving previous pages.

## Deliverable 4 — focused polish (этап 04)

- Create presets target 3/5/10/all допустимые <= current bookCount/1000, date shortcuts end current month if future, +3 months, end current year if future; обновлять RHF state. Auto-archive hint для нового goal после completed/expired (не второй confirm); краткое snapshot explanation.
- Mobile-first, existing semantic Tailwind tokens, 24px секции, focus return modal, ARIA progress, no button overflow, scroll/safe-area on narrow screens, both `uk/en` ICU locale strings, friendly empty/error copy. Не рефакторить shadcn vendor.
- Regression cases обязательно: 0 books; max target; active conflict; completed autoarchive; edit old deadline/name; snapshot changed list; >100 books; >20 activity; status/sort/view URL; loading/errors; archive result null; back/forward; data invalidation after reading change; UTC midnight validation. Покрывать нужное узкими tests/визуально, не писать гигантскую E2E suite.

## Shared technical rules / bounded scope

- FE is feature sliced (`features/reading-goals/api|components|model`), generated typed Orval client, `@app/shared` schemas, RQ, nuqs, next-intl, RHF/Zod, existing `UiIcon`, `Progress`, `EmptyState`, `InfiniteScrollFooter`. Do not hand-edit generated code, do not hand-roll network calls/components fetching data directly. Use date-fns and existing ISO-day helpers, no raw timestamp math. Prefer small local components only with clear responsibility.
- Existing server reading-goals/business logic, Prisma, migrations, API contract, reading cycle and unrelated statistics backend are **out of scope**. No new dependencies, search API, custom goal without list, recurrence/achievements, virtualisation, generic abstractions, global restyle.
- Acceptance: mandatory `tasks.json` checked against real diff; **only final** targeted tests and repository typecheck/lint/format, strictly sequential following `LOW_MEMORY_POLICY.md`; UI checked only if existing environment available. Never claim a check passed unless actually run. No commit/push without permission.
