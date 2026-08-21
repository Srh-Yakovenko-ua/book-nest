Потрібно виконати **повний backend-рефакторинг функціоналу “Книги в дорозі / Delivery” у BookNest**.

Репозиторій уже містить реалізований модуль `delivery`, `delivery-services`, Prisma-модель `BookDelivery`, shared schemas/types, статистику, фільтри та transition-логіку.

Перед змінами **проаналізуй поточну реалізацію повністю**: Prisma schema, delivery module, repositories, services/use-cases, controllers/routes, shared schemas/enums/types, statistics, filters, tests та синхронізацію з `Book.ownershipStatus`.

## Головна проблема

Зараз один `BookDelivery` фактично означає **доставку однієї конкретної книги**, але в ньому одночасно зберігаються дані трьох різних рівнів:

- замовлення в магазині;
- конкретної книги;
- фізичної посилки.

Через це одне реальне замовлення з 3 книг створює 3 `BookDelivery`, дублює `orderNumber`, tracking, delivery service, expected date тощо, а статистика може помилково рахувати 3 замовлення замість одного.

Потрібно повністю перейти на модель:

**BookOrder → BookOrderItem → Shipment**

де:

- `BookOrder` — одне реальне замовлення в магазині;
- `BookOrderItem` — конкретна книга всередині замовлення;
- `Shipment` — конкретна фізична посилка.

---

# 1. Нова domain-модель

## BookOrder

Створити окрему модель замовлення.

Вона повинна містити щонайменше:

- `id`
- `userId`
- `storeName`
- `orderNumber`
- `orderDate`
- `currency`
- `totalPrice` / `totalAmount` — фактична загальна сума замовлення, nullable
- `deliveryPrice` — nullable
- `discount` — nullable
- `note`
- `createdAt`
- `updatedAt`

Продумай назви полів відповідно до існуючих conventions проєкту.

`BookOrder` має належати користувачу і містити:

- багато `BookOrderItem`;
- одну або багато `Shipment`.

Не зберігай штучний `ordersCount` чи інші derived-поля в БД.

## BookOrderItem

Створити модель елемента замовлення:

- `id`
- `orderId`
- `bookId`
- `shipmentId` — nullable, тому що книга може бути замовлена, але ще не прив'язана до конкретної сформованої посилки;
- `price` — ціна саме цієї книги, nullable;
- timestamps;
- за потреби поля для коректної підтримки скасування конкретної книги з замовлення.

Важливо:

`BookOrderItem.price` означає **вартість конкретної книги**, а не всього замовлення.

Одна книга одного order item повинна належати максимум одній shipment.

## Shipment

Створити модель фізичної посилки:

- `id`
- `orderId`
- `deliveryServiceId` або відповідний існуючій архітектурі relation;
- `trackingNumber`
- `trackingUrl`
- `expectedDeliveryDate`
- `pickupUntil` — nullable, дедлайн отримання;
- `status`
- `receivedAt`
- `cancelledAt`
- `cancelReason`
- `note`
- timestamps.

Одна `BookOrder` може мати **декілька Shipment**.

Наприклад:

```text
Order #123 — Yakaboo — 5 книг

Shipment A
- Book 1
- Book 2
- Book 3

Shipment B
- Book 4
- Book 5
```

Цей кейс має підтримуватися повністю.

---

# 2. Shipment statuses

Збережи поточну семантику delivery statuses:

- `ordered`
- `in_transit`
- `ready_for_pickup`
- `received`
- `cancelled`

Але тепер це мають бути **статуси Shipment**, а не окремої книги.

Не дублюй shipment status у `BookOrderItem`.

Якщо потрібна підтримка скасування окремої книги всередині активного замовлення/посилки, реалізуй це окремою item-level ознакою/transition, а не копією shipment status.

---

# 3. Book.ownershipStatus

`Book.ownershipStatus` потрібно залишити.

Він має бути поточним агрегованим станом книги для решти BookNest.

Збережи існуючу поведінку:

- після створення активного замовлення книга → `IN_TRANSIT`;
- `ordered`, `in_transit`, `ready_for_pickup` вважаються активними delivery states;
- після отримання shipment усі її активні items → відповідні книги `OWNED`;
- після скасування shipment активні книги мають перейти в коректний стан відповідно до існуючої cancel-логіки (`WANT_TO_BUY` / `NONE`);
- скасування однієї книги не повинно скасовувати інші книги того самого order/shipment;
- отримання однієї shipment не повинно автоматично отримувати книги з іншої shipment того самого order.

Усі зміни order/item/shipment + `Book.ownershipStatus` повинні виконуватися **атомарно через transaction**.

Не допускай ситуації, коли shipment уже `received`, а книги залишилися `IN_TRANSIT`.

---

# 4. Derived status BookOrder

Не створюй зайвий persisted `BookOrder.status`, якщо його можна безпечно обчислити з items/shipments.

Order-level стан має бути derived.

Наприклад, система повинна вміти визначити:

- замовлення активне;
- частково відправлене;
- частково отримане;
- повністю отримане;
- повністю скасоване.

Не дублюй стани без необхідності, щоб уникнути розсинхронізації.

---

# 5. Створення замовлення

Новий create flow повинен дозволяти створити:

```text
BookOrder
- магазин
- номер
- дата
- валюта
- сума / доставка / знижка
- note

items[]
- bookId
- price

shipments[]
- delivery service
- tracking
- expected date
- status
- itemIds/bookIds
```

При цьому підтримай простий кейс:

**одне замовлення → одна shipment → одна книга**

і складніший:

**одне замовлення → декілька shipment → багато книг**.

Якщо shipment ще фактично не сформована, допускається наявність order items без `shipmentId`.

Визнач чистий API contract для цього сценарію.

---

# 6. Робота з Shipment

Потрібні окремі backend operations/use-cases для:

- створення shipment у вже існуючому order;
- редагування shipment;
- додавання/moving order items між shipments;
- зміни tracking;
- зміни expected delivery date;
- `markInTransit`;
- `markReadyForPickup`;
- `markReceived`;
- `cancelShipment`.

`received` та `cancelled` мають залишатися terminal transitions і не повинні виставлятися звичайним PATCH як довільний status.

Transition validation винеси/залиши в domain-рівні, а не тільки в controller.

---

# 7. Partial shipment / partial receive

Обов'язково підтримай кейс:

```text
Order: 5 книг

Shipment A: 3 книги → received
Shipment B: 2 книги → in_transit
```

Результат:

- 3 книги → `OWNED`;
- 2 книги → `IN_TRANSIT`;
- order загалом ще не завершений.

Також підтримай:

```text
Shipment A → cancelled
Shipment B → received
```

без пошкодження статусів інших books.

---

# 8. Cancel item

Поточна система дозволяє працювати з доставкою конкретної книги, тому після refactor не можна втратити можливість скасувати лише одну книгу.

Реалізуй item-level cancellation.

Приклад:

```text
Order #123
Shipment #A
- Book 1
- Book 2
- Book 3
```

магазин скасував тільки `Book 2`.

Результат:

- Book 1 і Book 3 продовжують їхати у Shipment A;
- Book 2 позначена cancelled на item-level;
- її ownership відновлюється відповідно до cancel policy;
- Shipment A не стає cancelled.

Не дублюй для цього весь Shipment status enum у item.

---

# 9. Статистика

Повністю перепиши delivery statistics відповідно до нової семантики.

Не можна більше рахувати `BookOrderItem` або Shipment як `order`.

Повинні чітко відрізнятися:

- `ordersCount` = count(`BookOrder`);
- `shipmentsCount` = count(`Shipment`);
- `booksCount` = count активних/відповідних `BookOrderItem`);
- `receivedBooksCount`;
- `activeBooksCount`;
- `activeShipmentsCount`;
- `cancelledOrdersCount` / інші показники — тільки якщо семантично коректні.

Статистика магазину повинна мати можливість показувати:

- кількість реальних замовлень;
- кількість книг;
- загальну суму;
- середню суму замовлення;
- середню ціну книги.

Місячна статистика також повинна рахувати **реальні BookOrder**, а не записи книг.

Перевір усі існуючі `ordersCount`, `totalOrders`, averages та aggregation — прибери стару неправильну семантику.

---

# 10. Summary для сторінки “У дорозі”

Онови backend summary так, щоб він міг повертати щонайменше:

- `activeBooksCount`
- `activeOrdersCount`
- `activeShipmentsCount`
- `orderedCount`
- `inTransitCount`
- `readyForPickupCount`
- `delayedCount`
- `expectedThisWeekCount`
- `withoutExpectedDateCount`
- `withoutTrackingCount`
- `withoutPriceCount`
- `attentionCount`
- `nextExpectedDelivery`
- суми активних книг/замовлень по валютах.

`attentionCount` повинен рахувати **унікальні проблемні сутності**, а не просто складати категорії та дублювати одну shipment кілька разів.

---

# 11. Фільтри

Збережи існуючі корисні delivery filters і адаптуй їх до Shipment/Order моделі.

Повинні підтримуватися щонайменше:

- ordered;
- in transit;
- ready for pickup;
- arriving soon;
- expected this week;
- delayed;
- no expected delivery date;
- with/without tracking number;
- with/without tracking URL;
- with/without price;
- delivery service;
- store;
- currency;
- order/shipment status, якщо це відповідає API.

Особливо додай окремий filter для:

`ready_for_pickup`

якщо його зараз немає у shared filter schema.

---

# 12. Sorting

Перевір поточні сортування.

`closest_delivery` та `delayed_first` повинні мати різну поведінку.

Очікувана логіка:

### closest_delivery

- найближчі актуальні expected dates;
- потім пізніші;
- без дати — в кінці.

### delayed_first

- прострочені;
- сьогодні;
- найближчі майбутні;
- без дати — в кінці.

Не залишай два різні enum values, які фактично використовують один SQL order.

---

# 13. Tracking URL

Поточний `delivery-services` модуль збережи, але розшир архітектуру так, щоб у майбутньому/зараз можна було підтримати:

- `providerKey`;
- `trackingUrlTemplate`.

Якщо для сервісу є template і введено tracking number, backend повинен мати можливість сформувати tracking URL без ручного введення користувачем.

Не hardcode URL служб доставки в domain logic.

---

# 14. Migration існуючих BookDelivery

Це важливо: не просто видали `BookDelivery`.

Створи Prisma migration + data migration зі старої структури в:

`BookOrder`
`BookOrderItem`
`Shipment`.

Міграція повинна бути максимально безпечною.

Для legacy grouping використовуй консервативний підхід:

1. якщо є `orderNumber`, можна групувати записи одного user/store/orderNumber в один BookOrder;
2. якщо `orderNumber` немає, але є однаковий tracking number та очевидно одна доставка — допускається обережне групування;
3. якщо неможливо гарантовано встановити, що записи належать одному order, **не об'єднуй їх агресивно** — краще створити окремі orders, ніж помилково злити різні покупки.

Shipments також групуй тільки коли є достатньо даних для впевненого match.

Не допускай втрати:

- book relation;
- store;
- order number/date;
- price;
- currency;
- tracking;
- delivery service;
- expected date;
- status;
- notes;
- receivedAt;
- cancelledAt;
- cancelReason.

Якщо legacy data має неоднозначності, додай зрозумілий migration comment/report або helper script, а не мовчки втрачай/зливай дані.

Після успішної data migration стару модель `BookDelivery` та застарілий код потрібно видалити.

---

# 15. Shared package / API contracts

Онови всі shared:

- enums;
- zod schemas;
- request schemas;
- response schemas;
- DTO/types;
- filters;
- sorting;
- statistics types.

Не залишай старі типи `BookDelivery`, якщо вони більше не відповідають domain model.

Назви API повинні чітко відрізняти:

- order;
- order item;
- shipment.

Не називай BookOrderItem словом `order`.

---

# 16. Архітектура backend

Дотримуйся існуючого стилю проєкту.

Не створюй окрему паралельну архітектуру.

Розділи відповідальність:

- controllers/routes — HTTP;
- application/use-cases/services — orchestration;
- domain — invariants/transitions;
- repositories — persistence;
- shared — contracts.

Business rules не повинні бути заховані тільки у controller або Prisma repository.

---

# 17. API compatibility

Frontend delivery зараз реалізований лише частково, тому **не потрібно зберігати неправильну стару модель тільки заради backward compatibility**.

Краще зробити чистий новий API.

Але:

- знайди всі місця frontend/shared, які залежать від старого delivery contract;
- онови shared contract так, щоб TypeScript явно показав місця, які потребуватимуть frontend refactor;
- не створюй тимчасових aliases/deprecated DTO без реальної потреби.

У рамках цього завдання основний фокус — backend та shared contracts. Не потрібно повністю переробляти UI.

---

# 18. Валідація та invariants

Обов'язково забезпеч:

- user не може додати чужу книгу у свій order;
- shipment належить тому самому order/user;
- item не можна прив'язати до shipment іншого order;
- received shipment не можна вдруге receive;
- cancelled shipment не можна receive;
- received shipment не можна звичайним PATCH повернути в `in_transit`;
- cancelled item не повинен змінювати ownership при receive shipment;
- одна книга/item не повинна одночасно фізично належати двом shipments;
- transitions повинні бути transaction-safe.

---

# 19. Tests

Онови старі delivery tests та додай нові.

Обов'язкові кейси:

1. order з 1 книгою та 1 shipment;
2. order з 3 книгами та 1 shipment;
3. order з 5 книгами та 2 shipments;
4. receive однієї shipment з двох;
5. cancel однієї shipment з двох;
6. cancel однієї книги всередині shipment;
7. books ownership transitions;
8. ready_for_pickup;
9. delayed filter;
10. no tracking / no date / no price filters;
11. реальні `ordersCount`, `shipmentsCount`, `booksCount`;
12. statistics by store;
13. monthly statistics;
14. migration legacy BookDelivery;
15. заборонені terminal transitions;
16. transaction rollback при помилці.

---

# 20. Очікуваний результат

Після рефакторингу структура повинна концептуально бути:

```text
USER
└── BOOK ORDER
    ├── store / order number / order date
    ├── totals
    │
    ├── BOOK ORDER ITEM
    │   ├── book
    │   ├── item price
    │   └── shipment?
    │
    ├── BOOK ORDER ITEM
    │   └── ...
    │
    ├── SHIPMENT A
    │   ├── tracking
    │   ├── expected date
    │   ├── status
    │   └── items 1,2,3
    │
    └── SHIPMENT B
        ├── tracking
        ├── expected date
        ├── status
        └── items 4,5
```

Головний принцип:

**Order ≠ Shipment ≠ Book.**

- `BookOrder` відповідає на питання: **що я купила в магазині?**
- `Shipment` відповідає: **як і коли це фізично їде?**
- `BookOrderItem` відповідає: **яка конкретно книга входить у замовлення?**
- `Book.ownershipStatus` відповідає: **який поточний статус володіння книгою в BookNest?**

Не роби мінімальний patch поверх `BookDelivery`. Потрібен саме **повний domain refactor** з видаленням старої семантики після міграції.

Після реалізації:

1. покажи список створених/змінених моделей;
2. коротко опиши нові API endpoints/use-cases;
3. покажи правила transitions;
4. вкажи, як мігруються legacy `BookDelivery`;
5. переліч старий код, який було видалено;
6. запусти lint/typecheck/tests для заторкнутих workspace/package;
7. виправ усі помилки, спричинені refactor;
8. окремо переліч frontend-місця, які тепер потрібно буде адаптувати до нового API, але сам UI у цьому завданні не переробляй.
