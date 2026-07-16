# Backend prompt: читання series order-check preference

Задача для backend-агента/розробника в репозиторії `book-nest`. Самодостатня — контекст усередині.

---

## Контекст

Модуль `apps/api/src/modules/series-order-check/` реалізований, задеплоєний і працює: він знаходить порушення порядку читання серій у Черзі читання, групує їх по серії, рахує severity, будує preview і атомарно застосовує виправлення.

Фронтенд-блок «Перевірити порядок серій» реалізований повністю — **окрім однієї речі**, і саме її блокує backend.

## Що зламано

Користувач може вимкнути перевірку для конкретної серії («Не перевіряти цю серію»). Це працює:

- `PUT /api/series/:seriesId/order-check-preference` з `{ "enabled": false }` створює рядок у `SeriesOrderDisabledSeries`;
- `computeIssues` (`application/series-order-check.service.ts:301`) читає `listDisabledSeriesIds` і викидає вимкнені серії з детекції.

Зворотний виклик теж реалізований: `PUT { "enabled": true }` викликає `enableSeries` і видаляє рядок.

**Але прочитати поточне значення прапорця ззовні неможливо.** `listDisabledSeriesIds` (`infrastructure/series-order-check.repository.ts:91`) викликається тільки зсередини сервісу і ніде не виставлений через HTTP. У `SeriesViewSchema` (`packages/shared/src/series.ts:89`) немає жодного поля про order-check.

Ресурс вийшов **write-only**.

## Чому це треба полагодити

Не заради симетрії API, а тому що **disable зараз — двері в один бік**.

Тогл у налаштуваннях серії — це controlled component: щоб його намалювати, треба знати поточне значення. Фронт його не має, тому кнопку «увімкнути назад» неможливо відрендерити чесно. Користувач, який вимкнув перевірку серії, **не має жодного способу це скасувати через застосунок**. Можливість у API існує, але недосяжна.

### Чому фронт не може обійтися без backend

Розглянуті й відкинуті варіанти:

1. **Вивести з відсутності серії у видачі `GET /series-order-issues`.** Не працює: серії немає у видачі з двох різних причин — (а) перевірку вимкнено, (б) конфлікту просто немає. Ззовні вони нерозрізненні.
2. **Тримати прапорець у localStorage.** Джерело істини — рядок у Postgres, привʼязаний до `userId`. Клієнт почав би гадати: інший пристрій або очищений браузер показали б протилежне.
3. **Оптимістичний тогл із дефолтом «увімкнено».** Той, хто вимкнув серію, побачив би «увімкнено» — активно неправдива інформація.

### Для контрасту — чому сусідній `ignore` НЕ потребує такого ж читання

`POST /series-order-issues/:fingerprint/ignore` теж лише пише і не має «un-ignore» — і це нормально. Ignore привʼязаний до `fingerprint`, який змінюється разом із порядком черги: щойно користувач посуне книги, старий fingerprint перестане збігатися й попередження повернеться саме. Ignore спливає за побудовою. **Disable — ні, він вічний**, тому саме йому потрібне читання.

---

## Що реалізувати

```http
GET /api/series/:seriesId/order-check-preference
```

**Response 200:**

```json
{ "enabled": true }
```

`enabled: false` ⇔ у `SeriesOrderDisabledSeries` є рядок для пари `(userId, seriesId)`. `enabled: true` — рядка немає (дефолт: перевірка увімкнена).

**Коди:**

| Код | Коли                                         |
| --- | -------------------------------------------- |
| 200 | Серія належить користувачу                   |
| 401 | Немає/невалідний access token                |
| 404 | Серії немає або вона не належить користувачу |

Семантика має дзеркалити наявний `PUT`: той самий 404 на чужу/неіснуючу серію, той самий формат відповіді.

## Чому саме GET, а не поле в SeriesView

Розглядався альтернативний варіант — додати `orderCheckEnabled: boolean` у `SeriesViewSchema`, щоб зекономити запит на сторінці серії. **Він відкинутий свідомо**, і ось чому:

Модуль `series-order-check` **уже** має контролер, змонтований на `@Controller("api/series")` (`api/series-order-preference.controller.ts:31`) — тобто вже займає цей URL-простір, не живучи в модулі `series`. Додати `GET` у той самий контролер — послідовно з наявним кодом, і знання про таблицю `series_order_disabled_series` лишається всередині свого модуля.

Поле в `SeriesViewSchema` натомість змусило б репозиторій модуля `series` читати таблицю, якою володіє `series-order-check` — пряме порушення межі модулів (CLAUDE.md §5, §8.8: «Layered architecture is sacred», модульний моноліт тримає межі чистими саме щоб виділення сервісу лишалось механічним). Зекономлений round-trip того не вартий.

**Якщо ти вважаєш інакше — аргументуй, але за замовчуванням роби GET.**

## Що вже готове (не переписуй)

Майже все. Це має бути маленька зміна:

| Що                                                         | Де                                                                                     | Стан                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- |
| `SeriesOrderPreferenceViewSchema` = `{ enabled: boolean }` | `packages/shared/src/series-order-check.ts:157`                                        | ✅ є                                   |
| `SeriesOrderPreferenceViewDto`                             | `api/view-dto/series-order-preference.view-dto.ts`                                     | ✅ є                                   |
| Перевірка власності + 404                                  | `findOwnedSeriesId` — `infrastructure/series-order-check.repository.ts:80`             | ✅ є, використовується `PUT`           |
| Читання прапорця                                           | `listDisabledSeriesIds(userId)` — `infrastructure/series-order-check.repository.ts:91` | ⚠️ є, але тільки «всі для користувача» |
| `SERIES_NOT_FOUND_MESSAGE` / `SERIES_NOT_FOUND_CODE`       | `application/series-order-check.service.ts:48-49`                                      | ✅ є                                   |
| Контролер на `api/series`                                  | `api/series-order-preference.controller.ts`                                            | ✅ є, додати метод сюди                |

Орієнтовно потрібно:

1. **Repository** — однокнижковий варіант читання, напр. `isSeriesDisabled({ seriesId, userId }): Promise<boolean>` через `seriesOrderDisabledSeries.findUnique` по наявному `@@unique([userId, seriesId])`. Не тягни весь список заради однієї серії. Не забудь трейлінг-параметр `client: Prisma.TransactionClient = this.prisma` — як у решти методів репозиторію.
2. **Service** — `getSeriesCheckPreference({ seriesId, userId })`: спершу `findOwnedSeriesId` → `NotFoundError` з тим самим кодом, що й у `setSeriesCheckPreference` (`series-order-check.service.ts:216`), потім повернути `{ enabled: !disabled }`.
3. **Controller** — `@Get(":seriesId/order-check-preference")` у наявному `SeriesOrderPreferenceController`, поруч із `@Put`. `@UseGuards(JwtAccessGuard)`, `@Param("seriesId", ParseUUIDPipe)`, повний набір `@Api*` як у сусіднього `PUT`, `@Throttle` за тим самим зразком (у `PUT` — `PREFERENCE_ACTION_LIMIT`/`PREFERENCE_ACTION_TTL_SECONDS`; для GET підбери адекватний ліміт читання).

Міграція **не потрібна** — таблиця вже існує.

## Обмеження

- CLAUDE.md §5: контролер не знає про Prisma, сервіс не знає про `req`/`res`, Prisma тільки в репозиторії, репозиторій не повертає ViewModel.
- Без коментарів у коді, без `any`/`!`, мінімум `as` (CLAUDE.md §8).
- Не чіпай логіку детекції, preview, apply, ignore — вони працюють, покриті тестами й перевірені на живих даних.
- Не змінюй наявний `PUT` і його контракт: фронт уже його викликає.
- Не додавай `orderCheckEnabled` у `SeriesViewSchema` (див. розділ вище).

## Тести

Додай до наявних (`api/series-order-check.controller.test.ts` — там уже є патерн `createTestApp`):

- 200 + `{ enabled: true }` для серії без рядка в `SeriesOrderDisabledSeries`;
- 200 + `{ enabled: false }` після `PUT { enabled: false }`;
- знову 200 + `{ enabled: true }` після `PUT { enabled: true }` — **головний regression-тест: саме цей round-trip зараз неможливо перевірити ззовні**;
- 404 на чужу серію (створи серію іншого користувача);
- 404 на неіснуючий UUID;
- 401 без токена.

## Гейти (всі мають бути зелені)

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

Тести `@app/api` вимагають піднятого локального Postgres (`pnpm db:up`) — інакше падають з `ECONNREFUSED 127.0.0.1:5432`.

Далі:

```bash
pnpm --filter @app/api generate:openapi
pnpm gen:api
```

щоб у `apps/web/src/shared/api/generated/**` зʼявився хук на новий GET — фронт добудує тогл поверх нього.

## Definition of done

- `GET /api/series/:seriesId/order-check-preference` віддає `{ enabled }` і коректні 401/404 — з реальним `curl`, а не «має працювати».
- Round-trip `PUT false` → `GET` → `PUT true` → `GET` доведений тестом.
- OpenAPI перегенеровано, `pnpm gen:api` дає типізований хук.
- Гейти зелені.

Після цього фронт зможе показати тогл повторного ввімкнення в налаштуваннях серії й закрити двері в один бік.

---

Довідково: повний опис gap — `docs/series-order-check/backend-gaps-for-frontend.md`. Вихідна специфікація фічі — `docs/series-order-check-development-repository/`.
