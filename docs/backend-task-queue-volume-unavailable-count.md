# Backend-задача: віддати кількість книг із `pagesCountUnavailable` в «Обсязі черги»

> Продовження [`docs/backend-task-reading-queue-volume.md`](./backend-task-reading-queue-volume.md). Дрібна задача: одне поле у відповіді, нових таблиць і міграцій не потрібно.

## Навіщо

У модалці «Доповнити дані» користувач може позначити книгу галочкою «Кількість сторінок неможливо визначити» (аудіокнига, електронка з плаваючою версткою, скан без нумерації). Це виставляє `Book.pagesCountUnavailable = true`.

Після цього книга **зникає без сліду**:

- вона більше не потрапляє в модалку — `queueVolumeGapReason` повертає `null` (`apps/web/src/features/books/model/queue-volume.ts:25`);
- у блоці «Обсяг черги» її не видно ніде: рядок «Враховано X із Y» рахує `coverage.totalBooks`, а туди `unavailable` **не входить** (`queue-volume.ts:83`), тож книга зникає з обох боків дробу;
- окремого рядка-інсайту для неї немає, хоча для аудіокниг такий рядок є (`queue-volume-block.tsx:94`).

Разом виходить незворотний вибір без жодного зворотного звʼязку: людина клікнула галочку — і назавжди втратила видимість того, що книга виключена з підрахунку.

Дані для цього рядка **вже пораховані** — просто не виїжджають назовні.

## Що вже є

`accumulateScope` рахує пʼять взаємовиключних кошиків (`apps/api/src/modules/reading-queue/domain/queue-volume.ts:169-209`), серед них:

```ts
if (row.pagesCountUnavailable) {
  return { kind: "unavailable" }; // :227
}
```

```ts
case "unavailable":
  totals.unavailable += 1;          // :201
  break;
```

`totals.unavailable` бере участь у `queueBooksCount` (`:81`), але у ViewModel (`:109-135`) не потрапляє. Тобто вся робота зроблена — бракує одного рядка в обʼєкті відповіді й одного поля в схемі.

## Що зробити

### 1. `packages/shared/src/reading-queue.ts`

Додати поле у блок `pages` схеми `ReadingQueueVolumeSummaryViewSchema` (`:110-114`):

```ts
pages: z.object({
  invalidBooks: z.number().int().nonnegative(),
  knownRemaining: z.number().int().nonnegative(),
  missingBooks: z.number().int().nonnegative(),
  unavailableBooks: z.number().int().nonnegative(),
}),
```

**Саме `pages.unavailableBooks`, не `unavailableCount` на верхньому рівні.** Причина: `unavailableCount` уже зайняте в `ReadingQueueSummaryViewSchema` (`:72`) і означає там геть інше — книги, недоступні за ознакою володіння (`unavailableByOwnership`). Два поля з однаковою назвою і різним сенсом у сусідніх DTO однієї фічі — гарантована плутанина на фронті. У блоці `pages` воно стоїть поруч із `invalidBooks` / `missingBooks`, тобто в своїй смисловій родині.

### 2. `apps/api/src/modules/reading-queue/domain/queue-volume.ts`

У `computeQueueVolume` (`:129`) додати поле у блок `pages`:

```ts
pages: {
  invalidBooks: totals.invalid,
  knownRemaining: totals.knownRemaining,
  missingBooks: totals.missing,
  unavailableBooks: totals.unavailable,
},
```

Більше нічого міняти не треба: `totals.unavailable` уже рахується.

**Не чіпати** `coverage.totalBooks` і `coverageRatio` — виключення `unavailable` зі знаменника покриття зроблено свідомо (інакше десяток аудіокниг назавжди опустив би покриття нижче `MIN_COVERAGE_RATIO = 0.7` і вбив би прогноз, який полагодити неможливо в принципі).

**Не чіпати** `hasMissingData` (`:122`) — `unavailable` не є «бракує даних», це «даних не існує». Модалка «Доповнити дані» не повинна знову зʼявлятися через ці книги.

### 3. Тести

`apps/api/src/modules/reading-queue/domain/queue-volume.test.ts` уже має кейси з `pagesCountUnavailable`. Додати перевірку, що:

- книга з `pagesCountUnavailable: true` дає `pages.unavailableBooks === 1`;
- вона **не** потрапляє в `pages.missingBooks`;
- вона **не** змінює `coverage.totalBooks` і `coverage.ratio`;
- вона **входить** у `queueBooksCount`;
- закрита книга (`finished` / `dnf`) із цим прапорцем не рахується ніде — `accumulateScope` відсіює її раніше (`:181`).

### 4. Після мержу

`pnpm --filter @app/api generate:openapi`, щоб фронт міг зробити `pnpm gen:api`.

---

# Задача 2 (баг): `PATCH /api/books/:id` не скидає прапорець

## Симптом

Книга з `pagesCountUnavailable = true` більше ніколи не повертається в модалку «Доповнити дані» й не потрапляє в підрахунок сторінок — **навіть якщо через форму редагування вписати кількість сторінок, зберегти, а потім знову очистити**.

Відтворено на реальних даних (`f4e12e57-1a2c-428b-8678-48ade0633fa2`, «Коли впаде король», `formats: ["paper"]`):

```json
{ "pagesCount": null, "pagesCountUnavailable": true }
```

## Корінь

Прапорець пишуть **лише** bulk-методи:

- `markPagesCountUnavailable` (`bulk-books.repository.ts:216`) → `{ pagesCountUnavailable: true }`
- `setPagesCount` (`bulk-books.repository.ts:319`) → `{ pagesCount, pagesCountUnavailable: false }` — тут інваріант дотримано

А звичайне оновлення книги `updateOwned` (`books.repository.ts:1013`) пише лише `data.fields` із запиту й `pagesCountUnavailable` не чіпає **ніколи**.

Тому послідовність «форма → вписати 368 → зберегти» лишає в БД **суперечливий стан**: `pagesCount = 368` **і** `pagesCountUnavailable = true` одночасно. Візуально все гаразд, бо `classifyRow` (`queue-volume.ts:220`) перевіряє `pagesCount` першим. Але щойно сторінки очистили — керування переходить на прапорець, і книга падає в кошик `unavailable`.

## Фікс

В `BooksService.update` (або в мапінгу `UpdateBookInput` → `UpdateBookData`): якщо у вхідному payload `pagesCount` присутній і **не** `null` — примусово додати `pagesCountUnavailable: false` у `data.fields`.

```
pagesCount: number   → pagesCountUnavailable = false   (число і «числа не існує» — взаємовиключні)
pagesCount: null     → прапорець НЕ чіпати             (очищення саме по собі нічого не стверджує)
pagesCount відсутній → прапорець НЕ чіпати             (partial-update: undefined = «не чіпай»)
```

Це **не** зворотність через UI (її свідомо не робимо) — це відновлення інваріанта, який bulk-шлях уже дотримує, а звичайний PATCH — ні. Побічний ефект приємний: у користувача зʼявляється природний вихід із глухого кута без жодного нового контролу — вписав сторінки, зберіг, за потреби очистив.

## Тести

- `PATCH` з `pagesCount: 368` для книги з `pagesCountUnavailable: true` → у БД `false`.
- `PATCH` з `pagesCount: null` → прапорець лишається як був.
- `PATCH` без ключа `pagesCount` (міняємо, скажімо, `title`) → прапорець лишається як був.

## Разова санація даних

Рядки з `pagesCount IS NOT NULL AND pages_count_unavailable = true` уже могли накопичитись. Одноразовий `UPDATE` після деплою фіксу:

```sql
UPDATE books SET pages_count_unavailable = false
WHERE pages_count IS NOT NULL AND pages_count_unavailable = true;
```

Книги з `pagesCount IS NULL` **не чіпати** — там прапорець стоїть за призначенням.

---

## Чого НЕ робити в цих задачах

- Міграцій немає — колонка `pagesCountUnavailable` існує (`schema.prisma`).
- Не додавати окремий ендпоінт чи поле у формі для «зняти прапорець». Зворотність свідомо не робимо: прапорець описує властивість самої книги (аудіо, плаваюча верстка, скан), а не тимчасовий стан.
- Не змінювати логіку класифікації рядків — пріоритет перевірок у `classifyRow` (`pagesCount` → `pagesCountUnavailable` → аудіо-онлі → missing) узгоджений і покритий тестами.

## Що робить фронт після цього

Додає в блок «Обсяг черги» четвертий рядок-інсайт поруч із наявними:

```
Враховано 19 із 20 книг
· 1 книга без кількості сторінок
· 2 книги без підрахунку сторінок   ← нове
```

Локалізація (`uk` + `en`) і плюралізація — на фронті, бек віддає лише число.
