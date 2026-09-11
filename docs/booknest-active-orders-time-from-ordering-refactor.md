Працюй у поточній активній гілці BookNest.

Потрібно відрефакторити frontend-блок статистики доставки
`Активні замовлення за часом від оформлення`
відповідно до погоджених UX-рішень.

Перед змінами ще раз переглянь актуальну реалізацію:

- active-age query/hook;
- `StatisticsActiveAge`;
- active-age model/helpers;
- shared/generated contracts;
- current exact drill-down у `Доставки → В дорозі`;
- existing `StatisticsSection`, Tooltip, Link, Badge, Skeleton, info/warning patterns.

Не переписуй блок з нуля.
Максимально перевикористай існуючі BookNest-компоненти й стилі.

BACKEND / API НЕ ЗМІНЮВАТИ.
Не додавати frontend-розрахунків, яких немає в backend contract.

---

## 1. Назва, subtitle і current snapshot

Перейменувати title на:

`Активні замовлення: час від оформлення`

Subtitle:

`Скільки часу минуло від оформлення замовлень, у яких ще залишилися неотримані книги.`

Зберегти current-snapshot badge:

`Станом на {date}`

Цей блок не залежить від historical period і Compare.
Не передавати сюди `from/to` основної статистики.

Не використовувати wording `за віком`.

---

## 2. Дані одного age bucket

Для non-zero bucket показувати:

### Ліва частина

- icon;
- назва bucket;
- metadata:
  `{ordersCount} замовлень · {booksCount} книг`
- якщо `shipmentsCount > 0`, додати:
  `· {shipmentsCount} посилок`

Не показувати `0 посилок`.

### Права частина

Показувати `totalsByCurrency` окремо по валютах:

`5 978 UAH · 59 EUR · 15 USD`

Не робити FX conversion.

Ці суми трактувати як:

`вартість активних замовлень`

НЕ називати їх:

- `Гроші в дорозі`;
- `Вартість неотриманих книг`;
- `Залишок`.

Додати tooltip/info для money:

`Вартість активних замовлень у цій групі. Для частково отриманих замовлень враховується повна сума замовлення.`

Tooltip має бути інформаційним, без clickable actions.

---

## 3. Progress bar

Зараз bar нормалізується від найбільшого bucket.
Це потрібно змінити.

Bar width має відповідати реальній частці bucket від усіх active orders:

`ordersCount / totalOrders * 100`

Приклад:

9 із 41 = 22%
→ label `22% активних замовлень`
→ bar width `22%`

26 із 41 = 63,4%
→ bar width `63,4%`

Не використовувати peak normalization.

Progress bar:

- приблизно 6px / `h-1.5`;
- один muted track;
- percentage справа або під bar:
  `X% активних замовлень`

Не дублювати там `N зам.` — count уже є в metadata.

---

## 4. Age buckets

Не змінювати backend/shared bucket semantics.

Порядок завжди:

- `0–7 днів`
- `8–14 днів`
- `15–30 днів`
- `31 день і більше`

Не сортувати за count.

Усі 4 dated buckets показувати завжди, якщо `totalOrders > 0`, навіть якщо конкретний bucket має `0`.

### Zero bucket

Для `ordersCount = 0`:

- muted row;
- `0 замовлень`;
- `0% активних замовлень`;
- progress 0;
- без money;
- без shipments;
- без chevron;
- без hover/click;
- row не focusable.

---

## 5. `31 день і більше`

Не трактувати `31+` як:

- overdue;
- delay;
- attention;
- warning.

Не використовувати:

- red/orange severity;
- `AlertTriangle`;
- `Потребує уваги`;
- `Прострочено`.

`31+` означає лише, що від оформлення минуло 31 день або більше.

Age semantics і attention/delay semantics мають залишатися окремими.

---

## 6. `Без дати оформлення`

Перейменувати:

`Без дати замовлення`

на:

`Без дати оформлення`

Це не п’ятий age bucket, а data-quality exception.

Показувати його:

- окремо під divider;
- тільки якщо `unknown_date.ordersCount > 0`.

Структура така сама, як у non-zero bucket:

- icon;
- title;
- metadata;
- money;
- percentage;
- chevron, якщо exact drill-down доступний.

Helper/tooltip:

`Неможливо визначити час від оформлення, оскільки дата замовлення відсутня.`

Не використовувати destructive styling.

---

## 7. Drill-down

### Dated non-zero buckets

Whole-row exact link у:

`Доставки → В дорозі`

з відповідним:

`ageBucket`

Зберігати сумісні current filters:

- `store`;
- `orderState`;
- dataset `currency`;
- інші existing compatible filters.

НЕ передавати historical:

- `from`;
- `to`;
- `orderedFrom`;
- `orderedTo`

з основної statistics period state.

Цей блок current snapshot, тому historical period не повинен звужувати destination.

Для dated buckets зберегти:

`sort=oldest_orders`

### `Без дати оформлення`

При count > 0:

- whole-row exact link;
- `ageBucket=unknown_date`

Але не форсувати `sort=oldest_orders`, бо order date відсутня.
Використати existing/default deterministic sort destination page.

### Zero bucket

Static, без navigation.

---

## 8. Interaction

Для clickable non-zero row:

- весь row — один `Link`;
- `ChevronRight` справа;
- whole-row hover;
- light background/border accent;
- chevron на hover/focus трохи контрастніший;
- чіткий `focus-visible`;
- Enter відкриває destination.

Не робити окрему кнопку `Переглянути`.

Chevron — лише affordance, не окремий button.

Не робити `div onClick`.

---

## 9. Icons

Для всіх 4 dated buckets використовувати одну Lucide icon:

`Clock3`

Це одна часова шкала, а не різні типи статусів.

Тобто однакова icon для:

- `0–7`
- `8–14`
- `15–30`
- `31+`

це правильна поведінка.

Для:

`Без дати оформлення`

використати:

`CalendarX` або `CalendarOff`

Dated bucket:

- один спокійний terracotta/neutral tone;
- без severity gradient green → yellow → red.

Zero bucket:

- та сама `Clock3`, але muted appearance.

`31+` не має окремої warning icon.

---

## 10. Desktop/tablet layout

Не створювати окремі великі sub-cards для кожного bucket.

Зберегти одну вертикальну групу rows.

Для non-zero row:

ліва зона:
`[icon] title`
`metadata`

права зона:
`totalsByCurrency`
`ChevronRight`

внизу:
`progress bar`
`X% активних замовлень`

Приблизно:

[Clock] 15–30 днів 5 978 UAH · 59 EUR · 15 USD ›
9 замовлень · 18 книг · 10 посилок

        ███████████                   22% активних замовлень

Money — secondary metric, не головний KPI.

Currency totals можуть wrap, якщо не поміщаються.

Dated rows зробити трохи компактнішими по vertical spacing, щоб вони читалися як одна група.

Перед `Без дати оформлення` — тонкий divider.

---

## 11. Mobile / responsive

На вузькому екрані row перебудовується так:

`[icon] title                                      ›`

`metadata`

`currency totals`

`progress bar`

`X% активних замовлень`

Правила:

- title не truncate;
- максимум приблизно 2 рядки;
- currency totals можуть wrap;
- chevron стабільно справа вгорі;
- весь non-zero row — tap target;
- без horizontal scroll;
- progress займає доступну ширину card.

Zero row може бути компактнішим, бо не має money/chevron.

`Без дати оформлення` використовує ту саму mobile-композицію.

Header:

- title + snapshot badge;
- якщо не поміщаються — badge переноситься нижче/на наступний рядок;
- badge не повинен стискати title.

---

## 12. Truncation / неповні дані

Active-age має власний `source`.

Якщо:

`source.isTruncated === true`

показати compact card-level informational/warning message всередині цього блоку, перед bucket list.

Приклад:

`Дані можуть бути неповними`
`Розрахунок виконано для {loadedOrdersCount} замовлень через обмеження вибірки.`

Або wording відповідно до existing BookNest pattern.

Використати existing informational/warning styles BookNest.

Не покладатися лише на global historical statistics truncation warning.

Не робити frontend approximations.
Показувати backend values + warning.

---

## 13. Loading state

Під час loading:

- header, title, subtitle, snapshot badge лишаються;
- замість data показати 3–4 skeleton rows у геометрії bucket;
- не використовувати окремий spinner у кожному row;
- по можливості зберігати приблизну висоту card, щоб layout не стрибав.

---

## 14. Empty state

Якщо:

`totalOrders === 0`

не показувати чотири zero-buckets.

Показати compact empty state:

`Немає активних замовлень`

helper:

`Усі замовлення завершені або не містять неотриманих книг.`

Якщо `totalOrders > 0`, усі 4 dated buckets показуються, навіть якщо частина з них zero.

Якщо всі active orders мають unknown date:

- це НЕ empty state;
- показати 4 dated zero-buckets;
- divider;
- `Без дати оформлення` з реальними даними.

---

## 15. Error state

Якщо active-age query завершився помилкою:

`Не вдалося завантажити активні замовлення.`

Використати existing BookNest retry pattern, якщо він уже є.

Не підміняти error нулями.

Truncated state ≠ error.

---

## 16. Accessibility

Перевір:

- non-zero clickable row — semantic `Link`;
- Tab переводить focus на row;
- Enter відкриває destination;
- focus-visible не обрізається;
- chevron не окремий focus target;
- zero rows не focusable;
- tooltip money/helper доступний через hover і keyboard focus;
- tooltip не містить interactive controls;
- accessible label для `unknown_date` має бути user-facing:
  `Без дати оформлення`;
- percentages/money бажано використовують tabular numbers, якщо це вже є в BookNest styles;
- не покладатися лише на hover для mobile.

---

## 17. Existing architecture

Не створювати нову паралельну component system.

По можливості адаптувати поточні:

- `StatisticsActiveAge`;
- active-age model/helpers;
- `StatisticsSection`;
- existing Link;
- Tooltip;
- Badge;
- Skeleton;
- info/warning components;
- current statistics drill-down helpers.

Якщо frontend зараз має `peakOrders` / peak-normalized width, прибрати це з presentation logic і використовувати actual share від `totalOrders`.

Не дублювати mapping bucket labels/icons/navigation у кількох місцях — централізувати там, де це логічно для current architecture.

---

## 18. Не робити

- не змінювати backend/API;
- не додавати FX conversion;
- не прив’язувати блок до historical period;
- не додавати Compare;
- не трактувати `31+` як overdue;
- не приховувати zero dated buckets, якщо totalOrders > 0;
- не показувати `0 посилок`;
- не називати money `Гроші в дорозі`;
- не додавати окремі CTA всередині bucket;
- не створювати нові статистичні розрахунки на frontend;
- не робити horizontal scroll.

---

## 19. Очікувана структура

Приклад:

Активні замовлення: час від оформлення [Станом на 9 вер. 2026 р.]

Скільки часу минуло від оформлення замовлень,
у яких ще залишилися неотримані книги.

[Clock] 0–7 днів
0 замовлень
─────────────────── 0% активних замовлень

[Clock] 8–14 днів
0 замовлень
─────────────────── 0% активних замовлень

[Clock] 15–30 днів 5 978 UAH · 59 EUR · 15 USD ›
9 замовлень · 18 книг · 10 посилок
███████ 22% активних замовлень

[Clock] 31 день і більше 17 220 UAH · 71,4 EUR · 133,47 USD ›
26 замовлень · 34 книги · 17 посилок
███████████████████ 63,4% активних замовлень

────────────────────────────────────────────────────────────

[CalendarX] Без дати оформлення 2 100 UAH ›
6 замовлень · 12 книг · 4 посилки
█████ 14,6% активних замовлень

---

## 20. Після реалізації

Перевір:

- typecheck;
- lint;
- релевантні unit/component tests.

Додай/онови tests щонайменше для:

1. bar width = actual share від totalOrders, а не peak;
2. усі 4 dated buckets рендеряться при `totalOrders > 0`;
3. zero bucket static і non-clickable;
4. `31+` не отримує warning semantics;
5. `Без дати оформлення` рендериться окремо лише при count > 0;
6. shipments показуються лише коли > 0;
7. exact dated drill-down;
8. unknown_date drill-down без `oldest_orders`;
9. historical period params не потрапляють у active-age destination;
10. truncation warning використовує active-age `source`;
11. `totalOrders=0` → empty state;
12. query error → error state, а не нулі;
13. responsive layout не має horizontal overflow.

Після завершення коротко опиши:

- які файли змінені;
- які UX/logic проблеми виправлені;
- які tests додані/оновлені.
