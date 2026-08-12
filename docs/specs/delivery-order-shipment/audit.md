# Аудит специфікації `docs/transit.md`

Режим: PLAN (до коду). Гілка: `fix/books-on-transit`. Дата аудиту: 2026-08-12T18:30:32Z.

Кожен рядок нижче перевірений командою в цьому запуску (`grep -n`, `sed -n`, `Read`). Номери рядків
взяті з файлів, відкритих зараз, а не зі специфікації.

---

## 1. Підсумок вердиктів

| Вердикт        | Кількість | Коротко                                                            |
| -------------- | --------- | ------------------------------------------------------------------ |
| `CONFIRMED`    | 23        | Код каже те саме, що й специфікація.                               |
| `ALREADY DONE` | 4         | Специфікація просить те, що вже є. Роботи менше.                   |
| `MOVED`        | 3         | Правда, але в іншому місці / іншій формі, ніж припускає текст.     |
| `STALE`        | 2         | Було правдою колись, зараз ні.                                     |
| `FALSE`        | 1         | Специфікація прямо помиляється щодо коду (§17 про стан фронтенду). |
| Пропуски       | 15        | Код вимагає того, про що специфікація мовчить. Див. розділ 4.      |

Разом 33 явних твердження (A1-A33) + 15 пропусків. `tasks.json.verifiedAssertions` містить той
самий набір у стислій формі: пропуски там записані як хибне неявне припущення специфікації, тому
лічильник `FALSE` у JSON більший.

---

## 2. Перевірені твердження

### 2.1 Вступ і §Головна проблема

| #   | Твердження специфікації                                                    | Вердикт     | Доказ                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | «Репозиторій уже містить реалізований модуль `delivery`»                   | `CONFIRMED` | `apps/api/src/modules/delivery/delivery.module.ts:9-14`; 27 файлів, 3 470 рядків без тестів                                                                                                                |
| A2  | «…модуль `delivery-services`»                                              | `CONFIRMED` | `apps/api/src/modules/delivery-services/delivery-services.module.ts:1-14`; модель `apps/api/prisma/schema.prisma:506-520`                                                                                  |
| A3  | «…Prisma-модель `BookDelivery`»                                            | `CONFIRMED` | `apps/api/prisma/schema.prisma:355-382`                                                                                                                                                                    |
| A4  | «…shared schemas/types»                                                    | `CONFIRMED` | `packages/shared/src/delivery.ts:1-257`, `packages/shared/src/delivery-view.ts:1-34`, `packages/shared/src/book-enums.ts:75-95`                                                                            |
| A5  | «…статистику»                                                              | `CONFIRMED` | `apps/api/src/modules/delivery/domain/delivery-statistics.ts:38-54`                                                                                                                                        |
| A6  | «…фільтри»                                                                 | `CONFIRMED` | `packages/shared/src/delivery.ts:38-52`; SQL-мапінг `apps/api/src/modules/delivery/infrastructure/delivery.repository.ts:501-560`                                                                          |
| A7  | «…transition-логіку»                                                       | `CONFIRMED` | `apps/api/src/modules/delivery/domain/delivery-transition.ts:11-78`                                                                                                                                        |
| A8  | «…синхронізацію з `Book.ownershipStatus`»                                  | `CONFIRMED` | `delivery-transition.ts:28` (`in_transit`), `:17` (`want_to_buy`/`none`), `:53` (`owned`)                                                                                                                  |
| A9  | «Один `BookDelivery` дублює orderNumber, tracking, service, expected date» | `CONFIRMED` | `schema.prisma:358-365` — `bookId`, `orderNumber`, `trackingNumber`, `deliveryService`, `expectedDeliveryDate` в одному рядку                                                                              |
| A10 | «Статистика може рахувати 3 замовлення замість одного»                     | `CONFIRMED` | `delivery-statistics.ts:104` (byStore `ordersCount += 1` на запис), `:137` (monthly), `:185` (`pricedOrdersCount`); `delivery.repository.ts:247` (`count(*) AS "totalOrders"` по рядках `book_deliveries`) |

### 2.2 §2–§8 (статуси, ownership, транзакції, item-cancel)

| #   | Твердження                                                              | Вердикт        | Доказ                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A11 | П'ять статусів `ordered/in_transit/ready_for_pickup/received/cancelled` | `CONFIRMED`    | `packages/shared/src/book-enums.ts:75-81`; активні — `:85`                                                                                                                                                                                                                             |
| A12 | «Після створення активного замовлення книга → `IN_TRANSIT`»             | `CONFIRMED`    | `delivery-transition.ts:26-43` (рядок 28)                                                                                                                                                                                                                                              |
| A13 | «`ordered`, `in_transit`, `ready_for_pickup` — активні»                 | `CONFIRMED`    | `book-enums.ts:85-95`                                                                                                                                                                                                                                                                  |
| A14 | «Після скасування → `WANT_TO_BUY` / `NONE`»                             | `CONFIRMED`    | `delivery-transition.ts:11-24`; прапорець `keepAsWantToBuy` за замовчуванням `true` — `packages/shared/src/books.ts:416`                                                                                                                                                               |
| A15 | «Усі зміни повинні виконуватися атомарно через transaction»             | `ALREADY DONE` | `apps/api/src/modules/books/infrastructure/book-deliveries.repository.ts:30,61` (`runInClient` → `$transaction`); `book-delivery.service.ts:184-196,214-223` (`TransactionRunner.run`)                                                                                                 |
| A16 | «`received`/`cancelled` не повинні виставлятися звичайним PATCH»        | `ALREADY DONE` | `packages/shared/src/books.ts:389` — `status: ActiveDeliveryStatusSchema.optional()`. Інваріант існує; його треба зберегти, а не створювати                                                                                                                                            |
| A17 | «Transition validation винеси/**залиши** в domain-рівні»                | `MOVED`        | Обчислення патчів — у domain (`delivery-transition.ts:11-78`), але **guards живуть в application**: `book-delivery.service.ts:232-240` (`assertActiveRecord`), `:242-247` (`assertCanStartDelivery`), `:249-256` (`assertNoActiveDelivery`). «Залишити» неможливо — їх треба перенести |
| A18 | «Поточна система дозволяє скасувати доставку конкретної книги»          | `CONFIRMED`    | `apps/api/src/modules/books/api/book-delivery.controller.ts:123` — `POST :id/deliveries/:deliveryId/cancel`                                                                                                                                                                            |
| A19 | «Не можна більше рахувати `BookOrderItem`/Shipment як `order`»          | `CONFIRMED`    | див. A10                                                                                                                                                                                                                                                                               |

### 2.3 §9–§13 (статистика, summary, фільтри, сортування, tracking)

| #   | Твердження                                                                     | Вердикт                   | Доказ                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A20 | Summary треба розширити до 14 показників                                       | `CONFIRMED`               | Зараз 5 полів: `packages/shared/src/delivery.ts:110-116`. `attentionCount`, `nextExpectedDelivery`, `activeOrdersCount`, `activeShipmentsCount`, `withoutTrackingCount`, `withoutPriceCount`, `withoutExpectedDateCount` — у репозиторії відсутні (grep по `apps/api/src`, `packages/shared/src` без збігів у delivery-контексті) |
| A21 | «Особливо додай окремий filter для `ready_for_pickup`, якщо його зараз немає»  | `CONFIRMED`               | `packages/shared/src/delivery.ts:38-52` — 13 значень без `ready_for_pickup`, хоча сам статус існує (`book-enums.ts:78`) і входить в активні                                                                                                                                                                                       |
| A22 | «Повинні підтримуватися… delivery service; store; currency»                    | `MOVED`                   | `service` і `store` — окремі query-параметри, не значення filter-enum: `delivery.ts:74,76`. `currency` є **лише** в history-запиті (`delivery.ts:137`), в in-transit його немає                                                                                                                                                   |
| A23 | «`closest_delivery` та `delayed_first` фактично використовують один SQL order» | `CONFIRMED`               | `delivery.repository.ts:413-417` (`CLOSEST_DELIVERY_ORDER`), `:437` (`closest_delivery`), `:438` (`delayed_first`) — та сама константа                                                                                                                                                                                            |
| A24 | Треба додати `providerKey` і `trackingUrlTemplate`                             | `CONFIRMED`               | Обох немає: `schema.prisma:506-520`; view — `packages/shared/src/delivery-services.ts:19-24` (`countryCode/id/isCustom/name`)                                                                                                                                                                                                     |
| A25 | «Не hardcode URL служб доставки в domain logic»                                | `ALREADY DONE`            | У `modules/delivery` і `modules/delivery-services` немає жодного URL-літерала (grep `http` дає лише імпорт `http-status.js`)                                                                                                                                                                                                      |
| A26 | «Створи Prisma migration + data migration»                                     | `CONFIRMED` (прецедент є) | `apps/api/prisma/migrations/20260702113600_redesign_book_deliveries/migration.sql:37-47` — `INSERT … SELECT` всередині Prisma-міграції вже робився                                                                                                                                                                                |

### 2.4 §1, §5, §14, §17, §19 (модель, create flow, міграція, фронтенд, тести)

| #   | Твердження                                                                 | Вердикт                     | Доказ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A27 | §1 «`deliveryServiceId` **або відповідний існуючій архітектурі relation**» | `STALE`                     | Існуюча архітектура relation не має: `schema.prisma:365` — `deliveryService String?` (вільний текст), а рядок каталогу створюється з набраної назви: `book-delivery.service.ts:258-269` → `delivery-services.service.ts:29-42`. FK — це нова семантика, не «існуюча»                                                                                                                                                                                                                                                                                                                                                          |
| A28 | §1 `BookOrder.currency/totalPrice/deliveryPrice/discount`                  | `CONFIRMED` (відсутні)      | Ціна і валюта живуть на рівні однієї доставки: `schema.prisma:366-367`. Полів замовлення немає ніде                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| A29 | §5 «Новий create flow…» (єдиний шлях створення)                            | `STALE`                     | Шляхів створення **два**, і специфікація згадує лише перший: `book-delivery.controller.ts:50` (`POST /api/books/:id/deliveries`) **і** блок `deliveryInfo` у створенні/редагуванні книги — `packages/shared/src/books.ts:520,629` → `books.repository.ts:608,1389-1417`                                                                                                                                                                                                                                                                                                                                                       |
| A30 | §9 «Статистика магазину… середня ціна книги»                               | `MOVED`                     | Сьогодні byStore рахує **лише записи з ціною** і мовчки пропускає решту: `delivery-statistics.ts:87-93`. Нова семантика «кількість книг» ≠ поточному `ordersCount`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| A31 | §17 «Frontend delivery зараз реалізований лише частково»                   | **`FALSE`**                 | `apps/web/src/features/delivery/**` — 51 файл, 5 009 рядків; плюс `apps/web/src/features/books/components/delivery-block.tsx:1-337`, `delivery-dialog.tsx:1-590`, `cancel-delivery-dialog.tsx:1-142`, `delivery-dashboard-widget.tsx:1-79`, `apps/web/src/features/books-to-buy/components/order-delivery-form.tsx:1-233`; три маршрути `apps/web/src/app/[locale]/(app)/delivery/{in-transit,history,statistics}/page.tsx`; 346 i18n-ключів у кожній локалі (`apps/web/src/messages/uk.json`, `en.json`, гілка `delivery`). Це не «частково» — це весь модуль. Висновок §17 («чистий злам дешевий») стоїть на хибній посилці |
| A32 | §18 «одна книга/item не повинна одночасно належати двом shipments»         | `ALREADY DONE` (структурно) | Досягається одним nullable `shipmentId` на item — окремої перевірки не потребує                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| A33 | §19 «Онови старі delivery tests»                                           | `CONFIRMED`                 | 7 тестових файлів у `modules/delivery` + `modules/delivery-services` (2 325 рядків, з них `delivery.controller.test.ts` — 1 070); ще ~30 тестів у інших модулях згадують delivery                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 3. Твердження, які специфікація подає як рішення, але воно не прийняте

Це не помилки, а розвилки. Повний список з рекомендаціями — у `tasks.json` → `openDecisions`
(D1…D11). Коротко, де саме текст розгалужується:

| §   | Формулювання                                                                 | Рішення |
| --- | ---------------------------------------------------------------------------- | ------- |
| §1  | «`deliveryServiceId` **або** відповідний існуючій архітектурі relation»      | D5      |
| §1  | «за потреби поля для коректної підтримки скасування конкретної книги»        | D2      |
| §4  | «Не створюй зайвий persisted status, **якщо** його можна безпечно обчислити» | D1      |
| §5  | «Визнач чистий API contract для цього сценарію»                              | D6, D3  |
| §10 | «`attentionCount` повинен рахувати унікальні проблемні сутності» (які саме?) | D8      |
| §11 | «order/shipment status, **якщо це відповідає API**»                          | D3      |
| §12 | Що саме означає «найближчі актуальні» для `closest_delivery`                 | D9      |
| §14 | «**допускається обережне** групування» за tracking                           | D7      |
| §16 | «Дотримуйся існуючого стилю» — один модуль чи два, який route prefix         | D10     |
| §17 | «онови shared contract так, щоб TypeScript явно показав місця»               | D11     |
| §18 | Інваріант «одна активна доставка на книгу» не згаданий взагалі               | D4      |

---

## 4. Чого специфікація не бачить, а код вимагає

Це найдорожча частина аудиту: пункти нижче не згадані в `docs/transit.md` жодного разу, але без них
рефакторинг або впаде в CI, або мовчки зламає продакшн-поведінку.

| #   | Пропуск                                                                                                 | Доказ                                                                                                                                                                                                       | Наслідок, якщо пропустити                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| O1  | Partial-unique індекс «одна активна доставка на книгу» живе в рукописному SQL і **не описаний у схемі** | `migrations/20260702113600_redesign_book_deliveries/migration.sql:50`                                                                                                                                       | Разом з `book_deliveries` зникає інваріант, який тримає `Book.ownershipStatus` однозначним                   |
| O2  | Тест, що стереже всі десять рукописних індексів                                                         | `apps/api/src/core/database/raw-sql-indexes.test.ts:34-45`, рядок 37                                                                                                                                        | Червоний CI одразу після `DROP TABLE book_deliveries`                                                        |
| O3  | Українська ICU-колація на текстових колонках, яку Prisma не бачить                                      | `migrations/20260812115219_ukrainian_collation_for_sorted_text/migration.sql:33-34`; тест `apps/api/src/core/database/collated-columns.test.ts:18-39` (рядки 33-34)                                         | Новий `book_orders.store_name` без `COLLATE "uk-UA-x-icu"` дає неправильне сортування Ґ/Є/І/Ї; тест червоний |
| O4  | Сирий SQL «нещодавно використані служби доставки» читає `book_deliveries`                               | `apps/api/src/modules/delivery-services/infrastructure/delivery-services.repository.ts:83-102` (рядок 92 — `FROM book_deliveries bd`)                                                                       | **Typecheck залишиться зеленим**, ендпоінт впаде в рантаймі на `relation "book_deliveries" does not exist`   |
| O5  | Нагадування про доставки в модулі notifications                                                         | `apps/api/src/modules/notifications/infrastructure/reminder-candidates.repository.ts:21-41,119-133,194-198`; `recipient-reminder.sweeper.ts:69-95`; типи `packages/shared/src/notifications.ts:17-19,69-87` | Зникне ціла фонова фіча, яку специфікація не згадує                                                          |
| O6  | Dedupe-ключ нагадування містить **id доставки**                                                         | `apps/api/src/modules/notifications/domain/notification-dedupe.ts:10-17` (`delivery:${deliveryId}:${stage}`)                                                                                                | Після міграції id зміняться → кожен користувач отримає повторну порцію нагадувань по тих самих книгах        |
| O7  | Масова зміна ownership скасовує активні доставки                                                        | `apps/api/src/modules/books/infrastructure/bulk-books.repository.ts:222-268` (рядки 261-268)                                                                                                                | Bulk-операції залишать «висячі» активні items                                                                |
| O8  | Блок `delivery` у `BookView` і `activeDelivery` у картці книги серії — публічний контракт               | `packages/shared/src/books.ts:1096`; `packages/shared/src/series.ts:223`; збірка — `books.repository.ts:173`, `books/domain/book.mapper.ts:51`, `series/domain/series.mapper.ts:196`                        | Два додаткові споживачі контракту поза модулем delivery                                                      |
| O9  | Блок `deliveryInfo` при створенні/редагуванні книги (другий шлях створення доставки)                    | `packages/shared/src/books.ts:520,629`; `books/domain/book-blocks.ts:46-74,151-178`; `books.repository.ts:608,1389-1417`                                                                                    | Форма книги перестане створювати доставку, і це не помітить жоден тест модуля delivery                       |
| O10 | Каскади `ON DELETE CASCADE` від `users` і `books`                                                       | `migrations/20260702113600_redesign_book_deliveries/migration.sql:32-35`                                                                                                                                    | Видалення користувача впаде на FK; є тест каскаду — `raw-sql-indexes.test.ts:148-181`                        |
| O11 | Скоуп soft-delete: усі запити доставок відсікають книги в кошику                                        | `delivery.repository.ts:308,449,602`                                                                                                                                                                        | Книги з кошика почнуть з'являтися у списках і статистиці                                                     |
| O12 | Стеля вибірки статистики 5 000 записів + попередження в лог                                             | `delivery.repository.ts:34,340-345`                                                                                                                                                                         | Стеля має перерахуватися в одиницях замовлень, інакше зріже дані інакше, ніж очікує тест                     |
| O13 | Видалення власної служби доставки не перевіряє посилань                                                 | `delivery-services.repository.ts:53-57`                                                                                                                                                                     | Під FK (D5) видалення почне падати або тихо каскадувати історію                                              |
| O14 | Згенерований клієнт Orval — це не «фронтенд», його треба перегенерувати в цьому ж завданні              | `apps/web/src/shared/api/generated/endpoints/delivery/**`, `…/model/*delivery*` (40+ файлів)                                                                                                                | `pnpm gen:api` не запустять — і FE залишиться зі старими типами, які вже не існують на бекенді               |
| O15 | Документація модуля описує стару модель                                                                 | `docs/delivery-docs/00-module-map.md`, `docs/delivery-docs/01-domain/**`, `docs/delivery-docs/02-implementation-audit.md`                                                                                   | Наступна сесія отримає в контекст опис моделі, якої вже немає                                                |

---

## 5. Обмеження проєкту, які план зобов'язаний поважати

- **Міграції у два кроки.** `pnpm --filter @app/api db:migrate --name <snake_case>` (create-only) →
  ручний перегляд `migration.sql` → `pnpm --filter @app/api db:migrate:deploy`. `db push` заборонено
  (CLAUDE.md §6).
- **Кожен `DROP INDEX` у згенерованій міграції читається рядок за рядком.** Prisma регулярно
  пропонує зняти два trigram-індекси (`authors_search_text_trgm_idx`, `publishers_search_text_trgm_idx`),
  бо бачить їх, але не вміє описати. Вісім часткових індексів вона не бачить взагалі. Легітимний
  `DROP INDEX` у цьому завданні рівно один — на `book_deliveries_active_book_idx` разом із таблицею.
- **Шарування (CLAUDE.md §5).** Prisma лише в репозиторіях; сервіси не інжектять `PrismaService`;
  контролери без бізнес-логіки; репозиторій не повертає ViewModel; багатозаписні потоки — через
  `TransactionRunner.run` (`apps/api/src/core/database/transaction-runner.ts:26-40`).
- **Дати — тільки через `date-fns`** (CLAUDE.md §8.11). Наявний приклад: `delivery-ui-status.ts:1-46`.
- **Гроші — `Decimal(10,2)`**, у view конвертуються `.toNumber()` (`delivery.mapper.ts:33`).
- **Прецедент серіалізації конкурентних вставок** — advisory lock:
  `apps/api/src/core/database/advisory-lock.ts:3-32`, класи 1…14 зайняті, вільний наступний — 15.
- **Локальна БД зараз недоступна** (немає слухача на 5432, `docker` не встановлений у цьому
  середовищі). Тому твердження про вміст dev-бази (46 книг, 49 рядків `BookDelivery`, три книги з
  двома доставками) в цьому запуску **не верифіковані** — вони прийняті зі слів замовника і
  позначені в `tasks.json` як припущення, яке треба підтвердити запитом перед написанням
  data-міграції (задача T17a).

---

## 6. Верхні ризики

1. **Мовчазні рантайм-зломи поза межами модуля.** O4 (сирий SQL у delivery-services) і O6
   (dedupe-ключі нагадувань) не ловляться ані `pnpm typecheck`, ані тестами модуля delivery.
2. **Червоний `dev` на невизначений час.** Видалення shared-типів валить typecheck усього
   `apps/web` (~50 файлів, 6,4 тис. рядків FE-коду). CI гейтить деплой на typecheck+build, тому
   мерж у `dev` до FE-follow-up зробить гілку недеплойною. Це рішення D11, а не деталь реалізації.
3. **Втрата інваріанта «одна активна доставка на книгу»** (O1). Без нього `Book.ownershipStatus`
   перестає бути функцією від даних: книга може одночасно їхати у двох замовленнях.
4. **Data-міграція без верифікованої форми даних.** Правила групування §14 треба перевіряти на
   реальному розподілі `orderNumber IS NULL`, повторюваних tracking і пар «cancelled → re-ordered»;
   зараз ця форма непідтверджена (див. §5 вище).
5. **Обсяг.** 61 задача, з них 24 — контракт і persistence. Це не «одна сесія». Порізка на зрізи
   (shared → prisma → repo → domain → app → api → tests) обов'язкова, інакше проміжний стан не
   компілюється тижнями.
6. **Паралельна робота у `apps/web`.** Інший агент зараз рефакторить навігацію доставок
   (`apps/web/src/components/app-shell.tsx`, `apps/web/src/features/delivery/components/delivery-subnav.tsx`
   і сторінки `app/[locale]/(app)/delivery/*`). Ці файли виключені зі скоупу цього плану повністю.
