# Backend-задача: агрегована статистика черги читання

## Навіщо

На сторінці «Черга читання» (`/[locale]/reading-queue`) блок статистики перебудовується з двох карток на чотири:

| #   | Картка             | Значення  | Підпис                                       |
| --- | ------------------ | --------- | -------------------------------------------- |
| 1   | Усього в черзі     | `20 книг` | `13 із серій · 7 окремих`                    |
| 2   | Можна читати зараз | `14 книг` | `Є в наявності та немає перешкод для старту` |
| 3   | Немає в наявності  | `6 книг`  | `3 хочу купити · 2 в дорозі · 1 позичена`    |
| 4   | Серії в черзі      | `8 серій` | `5 без проблем · 3 потребують уваги`         |

Картки клікабельні (застосовують фільтр черги), тож числа мають бути консистентні між собою й з тим, що користувач побачить після кліку.

Вимога з ТЗ: **числа не рахуються з поточної сторінки списку — потрібна повна агрегована статистика з бекенду.**

## Що вже є (перевірено в коді)

Значна частина даних уже доступна, тому обсяг задачі невеликий.

- `GET /api/reading-queue` (`reading-queue.controller.ts:60`) повертає **всю** чергу без пагінації: `listQueue` (`reading-queue.repository.ts:65`) — це `findMany` без `take`/`skip`.
- `BookView` уже несе все для карток 1–3: `series` (`packages/shared/src/books.ts:1146`), `ownershipStatus` (`:1134`), `hasUnreadEarlierSeriesParts` (`:1123`).
- `OwnershipStatus` (`packages/shared/src/book-enums.ts:26-33`) покриває всі стани з ТЗ: `none`, `want_to_buy`, `in_transit`, `owned`, `borrowed_from_someone`, `lent_to_someone`.
- `SeriesOrderIssuesView.total` (`series-order-check.service.ts:194`) — це **вже кількість серій із проблемами**, бо `detectSeriesOrderIssues` (`series-order-detection.ts:135-147`) дає максимум один issue на серію, а `computeIssues` (`:327-329`) уже відфільтрував вимкнені серії та проігноровані fingerprint-и.

**Чого бракує — рівно двох речей:**

1. Немає ендпоінта, який віддає агрегати черги (картки 1–3 + знаменник картки 4).
2. `total` **не зведений до черги**. `loadRelevantSeries` (`series-order-check.repository.ts:167-175`) бере серії, де є книга `queuePosition != null` **АБО** `readingStatus in ("reading","rereading")`. Тобто серія, яку користувач читає повз чергу, потрапляє в `total`, але в черзі її немає. Різниця `серії_в_черзі − total` може стати **від'ємною**.

## Deliverable — дві незалежні частини

- **A.** Новий `GET /api/reading-queue/summary` у `ReadingQueueModule` → картки 1, 2, 3 + `seriesInQueueCount`.
- **B.** Одне нове поле `seriesInQueueWithIssuesCount` у наявній відповіді `GET /api/reading-queue/series-order-issues` → «потребують уваги» для картки 4.

Міграцій немає. Нових таблиць немає. Нових запитів до БД у частині B теж немає.

### Чому саме такий розподіл (не змішувати в один ендпоінт)

`SeriesOrderCheckModule` **уже імпортує** `ReadingQueueModule` (`series-order-check.module.ts:13`). Якщо `ReadingQueueModule` почне імпортувати `SeriesOrderCheckModule`, щоб порахувати проблемні серії всередині `/summary`, вийде **циклічна залежність модулів**, і Nest DI впаде на старті з `Nest cannot create the module instance` — доведеться латати `forwardRef()`, що ховає реальну проблему проєктування.

Тому кожен модуль рахує те, що бачить сам:

- `ReadingQueueModule` бачить чергу → віддає склад черги і `seriesInQueueCount`;
- `SeriesOrderCheckModule` бачить і чергу, і детектор → віддає `seriesInQueueWithIssuesCount`.

Фронт віднімає одне від одного. Обидва ендпоінти сторінка й так уже смикає, зайвих запитів не додається.

---

## Частина A — `GET /api/reading-queue/summary`

Конвенція вже є в проєкті: `GET /api/loans/summary` (`loans.controller.ts:36`), `GET /api/delivery/in-transit/summary`. Робимо так само.

### A1. Контракт — `packages/shared/src/reading-queue.ts`

`OwnershipStatusSchema` імпортуй із `./book-enums.js`.

```ts
export const ReadingQueueUnavailableBreakdownSchema = z.object({
  inTransit: z.number().int().nonnegative(),
  lentToSomeone: z.number().int().nonnegative(),
  none: z.number().int().nonnegative(),
  wantToBuy: z.number().int().nonnegative(),
});

export type ReadingQueueUnavailableBreakdown = z.infer<
  typeof ReadingQueueUnavailableBreakdownSchema
>;

export const ReadingQueueSummaryViewSchema = z.object({
  availableNowCount: z.number().int().nonnegative(),
  blockedBySeriesOrderCount: z.number().int().nonnegative(),
  seriesBooksCount: z.number().int().nonnegative(),
  seriesInQueueCount: z.number().int().nonnegative(),
  standaloneBooksCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  unavailableByOwnership: ReadingQueueUnavailableBreakdownSchema,
  unavailableCount: z.number().int().nonnegative(),
});

export type ReadingQueueSummaryView = z.infer<typeof ReadingQueueSummaryViewSchema>;
```

Розподіл — **явний обʼєкт, не `z.record`**: Orval генерує з `record` слабко типізовану мапу, а тут ключі фіксовані. Нулі віддаємо завжди; ховати категорії з нулем — робота фронту (це вимога відображення, не контракту).

### A2. Домен — новий `apps/api/src/modules/reading-queue/domain/queue-summary.ts`

Уся бізнес-логіка «доступна / недоступна / заблокована» — тут, чистими функціями без Prisma й без Nest. Так її можна покрити юніт-тестами без БД.

```ts
const AVAILABLE_OWNERSHIP_STATUSES: ReadonlySet<OwnershipStatus> = new Set([
  "owned",
  "borrowed_from_someone",
]);

export function isAvailableOwnership(status: OwnershipStatus): boolean {
  return AVAILABLE_OWNERSHIP_STATUSES.has(status);
}
```

`computeReadingQueueSummary(rows)` проходить рядки один раз і рахує:

- `totalCount` — довжина;
- `seriesBooksCount` — `seriesId !== null`; `standaloneBooksCount = totalCount - seriesBooksCount`;
- `seriesInQueueCount` — `new Set(seriesId).size` по непорожніх `seriesId`;
- `unavailableByOwnership` — інкремент за `ownershipStatus`; `unavailableCount` — їхня сума;
- `blockedBySeriesOrderCount` — доступні за володінням, але заблоковані порядком;
- `availableNowCount` — доступні за володінням і **не** заблоковані.

Ознаку блокування бери з наявної доменної функції `computeHasUnreadEarlierParts` (`apps/api/src/modules/series/domain/series-preview.ts:56`) — тієї самої, якою `book.mapper.ts:48` наповнює `hasUnreadEarlierSeriesParts`. Дублювати правило не треба.

> **Інваріант, який має триматися:** `availableNowCount + blockedBySeriesOrderCount + unavailableCount === totalCount`. Саме тому `blockedBySeriesOrderCount` є в контракті окремим полем, хоч жодна картка його прямо не показує: без нього картки 2 і 3 не сходяться до картки 1, і будь-хто, хто перевірятиме числа, вирішить, що вони брешуть. Закріпи цей інваріант тестом.

### A3. Репозиторій — `reading-queue.repository.ts`

**Не перевикористовуй `listQueue`** для підрахунків: він тягне `withRelations` (автори, теги, списки, доставки, позики, обкладинки) на всі до 500 книг черги — це важко для ендпоінта, який віддає вісім чисел. Додай худий запит:

```ts
const summaryRowSelect = {
  id: true,
  ownershipStatus: true,
  partNumber: true,
  series: { select: { books: { select: { partNumber: true, readingStatus: true } } } },
  seriesId: true,
} satisfies Prisma.BookSelect;

export type ReadingQueueSummaryRow = Prisma.BookGetPayload<{ select: typeof summaryRowSelect }>;

loadSummaryRows(
  userId: string,
  client: Prisma.TransactionClient = this.prisma,
): Promise<ReadingQueueSummaryRow[]> {
  return client.book.findMany({
    select: summaryRowSelect,
    where: { queuePosition: { not: null }, userId },
  });
}
```

`series.books` **не треба** додатково фільтрувати за `userId`: `Series` user-scoped (`schema.prisma:100-123`, `Series.userId` + `@@unique([userId, normalizedName])`), тож книги серії вже належать тому самому користувачу. Точно так само зроблено в `withRelations` (`books.repository.ts:40-55`).

### A4. Сервіс — `reading-queue.service.ts`

```ts
async summary(userId: string): Promise<ReadingQueueSummaryView> {
  const rows = await this.readingQueueRepository.loadSummaryRows(userId);
  return computeReadingQueueSummary(rows);
}
```

Сервіс лишається тонким: маппінг рядок → доменна модель і виклик чистої функції. Ніякої Prisma, ніякого `req`/`res`.

### A5. Контролер — `reading-queue.controller.ts`

Додай `@Get("summary")` **вище** за `@Delete(":bookId")` і `@Post(":bookId/start-reading")`. Зараз конфлікту немає (GET-роуту з параметром у цьому контролері не існує), але Nest матчить роути в порядку оголошення — статичний сегмент перед параметричним це звичка, яка згодом рятує.

Потрібен `ReadingQueueSummaryViewDto` у `api/view-dto/` через `createZodDto(ReadingQueueSummaryViewSchema)` — за зразком наявного `reading-queue.view-dto.ts`. Swagger: `@ApiBearerAuth`, `@ApiOkResponse`, `@ApiOperation`, `@ApiUnauthorizedResponse`, `@UseGuards(JwtAccessGuard)`. Throttle не потрібен — це читання.

---

## Частина B — `seriesInQueueWithIssuesCount`

### B1. Контракт — `packages/shared/src/series-order-check.ts`

```ts
export const SeriesOrderIssuesViewSchema = z.object({
  items: z.array(SeriesOrderIssueViewSchema),
  queueVersion: z.string(),
  seriesInQueueWithIssuesCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
```

`total` **не чіпай** — він уже означає «серії з проблемами серед релевантних» і використовується для лічильника в сайдбарі.

### B2. Сервіс — `series-order-check.service.ts`, метод `listIssues` (рядки 171-196)

`relevantBooks` уже містить `seriesId` і `queuePosition` (`relevantSeriesBookSelect`, `series-order-check.repository.ts:11-23`), а `fingerprintedIssues` уже відфільтровані від вимкнених серій та проігнорованих issue. Тому **додаткових запитів до БД не потрібно**:

```ts
const queuedSeriesIds = new Set(
  relevantBooks.flatMap((book) =>
    book.queuePosition !== null && book.seriesId !== null ? [book.seriesId] : [],
  ),
);

return {
  items,
  queueVersion: computeQueueVersion(queueSignature),
  seriesInQueueWithIssuesCount: fingerprintedIssues.filter(({ issue }) =>
    queuedSeriesIds.has(issue.series.id),
  ).length,
  total: fingerprintedIssues.length,
};
```

Це і є суть частини B: `total` рахує серії, релевантні перевірці (в черзі **або** в активному читанні), а картці потрібні лише ті, що **в черзі**. Без цього звуження `seriesInQueueCount − total` може піти в мінус.

`ignoreIssue` (`:168`) повертає результат `listIssues`, тож нове поле приїде туди само собою.

---

## Рішення, які треба підтвердити з продактом (не вигадуй сам)

1. **Чи вважати `borrowed_from_someone` доступною?** У чернетці вище — так (книга фізично на руках). Якщо ні — прибери зі `AVAILABLE_OWNERSHIP_STATUSES`, і вона має зʼявитися окремою категорією в `unavailableByOwnership`.
2. **Що робити з `finished`/`dnf` у черзі.** ТЗ згадує лише статуси володіння, але дочитана книга технічно може лежати в черзі. Пропозиція: **не фільтрувати** за `readingStatus` взагалі — інакше числа розійдуться з фільтрами списку, які працюють по володінню.
3. **Ознака блокування для картки 2.** `computeHasUnreadEarlierParts` — простіший сигнал, ніж повноцінний series-order-check: він **не знає** ні про вимкнену перевірку для серії, ні про проігноровані issue. Наслідок: книга, для якої користувач натиснув «Залишити як є», усе одно рахуватиметься заблокованою. Це прийнятно для першої ітерації (дешево, без циклу залежностей), але має бути свідомим рішенням. Точний варіант — переносити підрахунок у `SeriesOrderCheckModule`; тоді картка 2 теж їде другим ендпоінтом.

---

## Тести

**Юніт (`domain/queue-summary.test.ts`)** — чисті функції, без БД:

- порожня черга → усі нулі;
- лише окремі книги → `seriesBooksCount: 0`, `seriesInQueueCount: 0`;
- дві книги однієї серії → `seriesInQueueCount: 1` (не 2 — перевірка дедуплікації);
- по одній книзі на кожен `OwnershipStatus` → розподіл і `unavailableCount`;
- книга `owned` з непрочитаною ранішою частиною → `blockedBySeriesOrderCount: 1`, `availableNowCount: 0`;
- **інваріант** `availableNow + blockedBySeriesOrder + unavailable === totalCount` на змішаному наборі.

**Інтеграційні (`api/reading-queue.controller.test.ts`)** через `createTestApp`:

- `GET /api/reading-queue/summary` без токена → 401;
- із сідованою чергою → 200 і точні числа;
- **ізоляція користувачів**: черга користувача B не впливає на summary користувача A.

**`series-order-check` (частина B)** — сценарій, де серія має проблему, але **жодної книги в черзі** (є лише книга зі статусом `reading`): `total: 1`, `seriesInQueueWithIssuesCount: 0`. Це рівно та регресія, заради якої робиться частина B.

## Гейти

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm --filter @app/api test
pnpm --filter @app/api generate:openapi   # оновити openapi.json
```

Перевірка живого ендпоінта:

```bash
TOK=$(curl -s -X POST http://localhost:4000/api/auth/refresh --cookie "<refresh-cookie>" | jq -r .accessToken)

curl -s http://localhost:4000/api/reading-queue/summary -H "Authorization: Bearer $TOK" | jq

curl -s "http://localhost:4000/api/reading-queue/series-order-issues?limit=3" \
  -H "Authorization: Bearer $TOK" | jq '{total, seriesInQueueWithIssuesCount}'
```

Звірка з реальністю (числа мають зійтися):

```bash
curl -s http://localhost:4000/api/reading-queue -H "Authorization: Bearer $TOK" \
  | jq '{count, seriesBooks: [.items[].book | select(.series != null)] | length,
         uniqueSeries: [.items[].book.series.id] | map(select(. != null)) | unique | length}'
```

## Критерії приймання

1. `GET /api/reading-queue/summary` → 200 з усіма полями `ReadingQueueSummaryView`; без токена → 401.
2. `summary.totalCount` дорівнює `count` із `GET /api/reading-queue`.
3. `availableNowCount + blockedBySeriesOrderCount + unavailableCount === totalCount`.
4. `seriesBooksCount + standaloneBooksCount === totalCount`.
5. `seriesInQueueCount` дорівнює кількості унікальних `series.id` у відповіді `GET /api/reading-queue`.
6. `seriesInQueueWithIssuesCount <= seriesInQueueCount` **завжди**, зокрема коли є проблемна серія без жодної книги в черзі.
7. BE-гейти зелені, `openapi.json` регенеровано.

## Порядок викатки

Спершу **деплой на dev-бекенд**. Локальний web проксіює `/api` на віддалений dev, тож фронт побачить нові поля лише після цього. Далі FE робить `pnpm gen:api` і споживає їх.

Обидві зміни **адитивні** (новий ендпоінт + нове обовʼязкове поле у відповіді). Старий фронт не зламається: `SeriesOrderIssuesViewSchema.parse` на FE відкидає невідомі ключі, а не падає на них.

## Поза скоупом (робить фронт)

Верстка карток на `StatCard`, selected-стан активного фільтра, skeleton, українські форми множини (`1 книга / 2 книги / 5 книг`), приховування нульових категорій у підписі картки 3, адаптивна сітка 4 → 2×2 → 1 колонка.
