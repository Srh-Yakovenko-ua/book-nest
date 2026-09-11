# BookNest — рефактор блоку `Календар покупок`

Працюй на актуальній гілці `dev`.

Потрібно відрефакторити блок `Календар покупок` на сторінці статистики доставки відповідно до вимог нижче.

Не переписуй блок з нуля. Перевикористовуй поточні:

- statistics contracts;
- calendar helpers/model;
- `StatisticsSection`;
- metric tabs;
- Tooltip;
- Link/Menu/Popover;
- existing statistics drill-down;
- BookNest styles і tokens.

Основну backend-логіку статистики не змінювати, крім явно описаного нижче `calendarCoverage`.

---

## 1. Позиція блоку на сторінці

Підняти `Календар покупок` вище.

Фінальний порядок:

1. KPI / основні показники
2. `Динаміка покупок` + `Що змінилося / Ключове за період`
3. `Календар покупок`
4. нижче — більш спеціалізована аналітика (`Магазини`, фактична вартість, статуси доставки, active-age, records тощо)

`Календар покупок` залишити full-width.

---

## 2. Основна модель календаря

Не змінювати heatmap-концепцію.

Календар:

- будується за `orderDate`;
- використовує global historical period і dataset filters;
- toggle `Замовлення | Книги` змінює metric intensity;
- intensity лишається relative до visible calendar scope;
- не робити окремий chart/layout для коротких period.

---

## 3. Layout heatmap

Full-width Card залишити.

Сам heatmap:

- має natural width;
- не розтягувати cells на всю ширину Card;
- центрувати calendar canvas у доступній content-зоні;
- header лишається звичайно вирівняним по краях Card.

Центрувати також короткі scopes:

- один місяць;
- кілька тижнів;
- кілька днів.

Показувати тільки фактичні тижні/місяці selected period.
Не домальовувати зайві місяці для заповнення простору.

---

## 4. Розмір cells

Збільшити cells:

- desktop/tablet: `14x14px`;
- gap: `3px`;
- border-radius: приблизно `3–4px`.

На mobile:

- базово теж `14x14px`;
- за крайньої потреби допустимо `13x13px`;
- не повертати до `11x11px`.

Не використовувати `scale()` на hover.

Hover/focus:

- outline/ring;
- легке підсилення tone;
- без зміни геометрії grid.

---

## 5. Short period scopes

Для будь-якого period використовувати одну heatmap-модель.

Наприклад для одного місяця:

- показати тільки його фактичні тижні;
- canvas natural-width;
- canvas centered;
- cell size не збільшувати для заповнення Card.

Не переходити на bar chart/list для коротких period.

---

## 6. Tooltip

Tooltip для non-zero day має бути тільки інформаційним.

### `Замовлення`

Показувати:

- повну дату;
- `{N} замовлень`;
- `{M} книг`;
- `Сума замовлень`;
- totals окремо по валютах.

### `Книги`

Показувати:

- повну дату;
- `{M} книг`;
- `у {N} замовленнях`;
- `Сума замовлень`;
- totals окремо по валютах.

Не додавати buttons/links усередину tooltip.

Zero-day:

- без tooltip;
- без click;
- без keyboard focus.

---

## 7. Day drill-down

Зберегти existing exact drill-down rule:

### 0 destinations

Cell informational/static.

### 1 destination

Вся cell — direct `Link`.

### 2+ destinations

Click відкриває existing Menu/Popover з non-zero destinations.

Наприклад:

`Переглянути замовлення`

- `В дорозі — 2`
- `Отримані — 3`
- `Скасовані — 1`

Не вводити persistent `selectedDay`.

Interaction:

- hover/focus → tooltip + ring;
- click → exact action;
- при open menu cell може лишатися visually active;
- після закриття menu active state прибирається.

---

## 8. Замовлення без `orderDate`

Не вставляти `Без дати` як fake day/column у heatmap.

Додати explicit backend metadata для calendar coverage.

Переважний contract:

```ts
calendarCoverage: {
  ordersInScope: number;
  ordersWithOrderDate: number;
  ordersWithoutOrderDate: number;
}
```

Можна використати еквівалентну структуру, якщо вона краще відповідає current statistics contracts.

Frontend НЕ повинен самостійно виводити цей count через різницю totals.

Якщо:

```ts
ordersWithoutOrderDate > 0;
```

під календарем показати compact informational note:

`N замовлень без дати оформлення не показані в календарі.`

Не використовувати warning/destructive style.
Не створювати fuzzy navigation для цих замовлень.

---

## 9. Local state

Залишити local presentation state:

- `calendarYear`;
- `Замовлення | Книги`.

Не додавати їх у URL query params.

Default metric:

`Замовлення`

Якщо global period змінюється і selected year більше не доступний:

- переключити на найближчий/найновіший доступний year.

Якщо year лишається доступним, не скидати його лише через zero activity.

---

## 10. Year selector і header

Header:

```text
Календар покупок                     [Замовлення | Книги]

Покупки за датою оформлення замовлення.
Темніший день — більше замовлень.
```

Для books:

`Темніший день — більше книг.`

Metric toggle лишити у header справа.

Year selector:

- показувати тільки якщо current global period охоплює 2+ роки;
- не змішувати з metric toggle;
- розташувати окремо над heatmap;
- вирівняти по правому краю calendar content.

При одному році year selector не рендерити.

Не дублювати global period всередині Card.

---

## 11. Weekday і month labels

Weekday labels:

- `Пн`
- `Ср`
- `Пт`
- `Нд`

Не показувати всі 7 labels.

Month labels:

- тільки для місяців, які реально входять у selected scope;
- не допускати overlap;
- для короткого scope label центрувати над відповідною групою weeks.

Не додавати:

- номери тижнів;
- номер дня на кожній cell;
- зайві grid lines.

---

## 12. Legend

Legend залежить від metric.

### Orders

```text
Менше замовлень   [levels]   Більше
```

### Books

```text
Менше книг        [levels]   Більше
```

Legend cells:

- `14x14px`;
- відповідають реальним heatmap levels.

Під legend залишити helper:

`Насиченість показує активність відносно найактивнішого дня показаного періоду.`

Coverage note про orders без дати показувати нижче окремим informational row.

---

## 13. Intensity colors

Використовувати одну BookNest terracotta intensity family:

- `0` → дуже світлий neutral/beige;
- level 1 → light terracotta;
- level 2 → medium-light;
- level 3 → medium;
- level 4 → dark terracotta.

Не використовувати green/yellow/red severity scale.

Dark cell означає тільки більшу activity.

Зберегти:

- zero + 4 positive levels;
- relative scale для visible scope.

Якщо current peak-based quantization через outlier робить майже всі positive cells однаково світлими, дозволено перейти на quantile-based presentation levels для positive days.

Це лише presentation logic:

- backend statistics не змінювати;
- tooltip завжди показує exact counts.

---

## 14. Empty states

### У всьому selected period немає покупок із датою

Не рендерити пустий heatmap.

Показати:

**Немає покупок за вибраний період**

`Замовлення з датою оформлення за цей період відсутні.`

### Selected year входить у multi-year period, але покупок у ньому немає

Показати:

**У {year} році покупок немає**

Не переключати автоматично на інший year лише через zero activity.

### Усі orders у scope без `orderDate`

Показати:

**Немає покупок із датою оформлення**

і нижче:

`N замовлень без дати оформлення не показані в календарі.`

Це не звичайний empty state.

---

## 15. Truncated source

Якщо statistics source truncated:

показати compact informational warning у Card:

**Дані календаря можуть бути неповними**

`Частина замовлень не увійшла в розрахунок через обмеження вибірки.`

У truncated state exact day drill-down лишити disabled, як у current implementation.

`calendarCoverage` також трактувати в межах фактично завантаженого source.

---

## 16. Mobile

Для довгого/full-year calendar:

- дозволити horizontal scroll тільки всередині calendar viewport;
- не створювати horizontal scroll для всієї Card/page;
- heatmap зберігає natural width;
- weekday labels скроляться разом із heatmap;
- legend/helper/coverage note залишаються поза scroll viewport.

Для короткого scope scroll не потрібен.

Опційно можна додати subtle edge fade справа як indication, що canvas можна прокрутити.

Header controls на mobile можуть wrap:

```text
Календар покупок

subtitle
helper

[Замовлення | Книги]
[2026 ▾]
```

Не стискати title заради controls.

---

## 17. Accessibility

Для interactive cells:

- 1 destination → semantic `Link`;
- 2+ destinations → semantic Button/Menu trigger;
- keyboard focus тільки на interactive non-zero cells;
- `Enter` / `Space` активують відповідну дію;
- `focus-visible` використовує той самий ring, що hover;
- tooltip доступний на focus;
- accessible name містить дату + counts.

Наприклад:

`27 вересня 2026, 2 замовлення, 3 книги`

Для menu:

- `Escape` закриває menu;
- focus повертається на cell.

Zero cells:

- не focusable;
- без tooltip/action.

---

## 18. Не додавати

Не додавати до календаря окремі KPI/summary cards:

- `Днів із покупками`;
- `Найактивніший день`;
- `Середньо за день`;
- `Максимум за день`.

Не дублювати records/insights інших блоків статистики.

Не додавати:

- Compare усередину календаря;
- окремий local period picker;
- URL-state для year/metric;
- persistent selected day;
- interactive controls у tooltip.

---

## Фінальний результат

Блок має:

- стояти одразу після `Динаміка покупок + Що змінилося / Ключове за період`;
- залишатися full-width;
- мати centered natural-width heatmap;
- використовувати cells `14x14px`;
- однаково коректно виглядати для року, кількох місяців і короткого period;
- мати clean informational tooltip;
- використовувати existing exact drill-down;
- явно повідомляти про orders без `orderDate`;
- коректно працювати на mobile без зменшення heatmap до нечитабельного розміру.
