# Prompt для frontend-агента: блок «Прогрес читання» та підтаба «Повна історія читання»

## Контекст задачі

У застосунку BookNest на сторінці деталей книги вже є блок поточного прогресу читання, який показує лише актуальну сторінку, відсоток і дату останнього оновлення.

Бекенд накопичує журнал усіх просувань уперед і після виконання backend-задачі повертатиме повністю підготовлену відповідь для UI:

- поточний стан читання;
- готові розрахункові значення;
- активність за 7 днів, 14 днів або весь період;
- готові точки графіка, включно з днями без активності;
- останню активність;
- повну історію, вже згруповану за календарними днями;
- серверну пагінацію;
- усі окремі оновлення в межах дня.

Потрібно реалізувати:

1. Оновлений компактний блок **«Прогрес читання»** на основній інформаційній частині сторінки деталей книги.
2. Окрему підтабу сторінки деталей книги **«Повна історія читання»**.
3. Усі loading, error, empty та partial-data стани.
4. Адаптивність, локалізацію й тести.

---

# 1. Головні технічні правила

## 1.1. Спочатку проаналізувати проєкт

Перед внесенням змін:

- знайти поточну структуру сторінки деталей книги;
- знайти механізм головних табів і підтабів;
- знайти поточний компонент:
  - `apps/web/src/features/books/components/reading-progress-block.tsx`;
- знайти згенерований API hook для історії читання;
- перевірити фактичну назву hook після регенерації API client;
- перевірити, яка chart-бібліотека вже використовується;
- перевірити наявні компоненти:
  - Card;
  - Tabs;
  - Select;
  - Accordion / Collapse;
  - Pagination;
  - Skeleton;
  - Alert;
  - Tooltip;
  - Empty state;
  - date/number formatters;
- перевірити conventions для React Query, i18n, responsive layout і тестів.

Не створювати паралельну дизайн-систему й не дублювати наявні UI-компоненти.

## 1.2. Не додавати бізнес-розрахунки на фронтенд

Фронтенд не повинен самостійно:

- групувати raw events за датами;
- сумувати `pagesRead`;
- рахувати кількість оновлень;
- визначати `startPage` або `finalPage`;
- рахувати `progressPercent`;
- рахувати `pagesRemaining`;
- рахувати `averagePagesPerActiveDay`;
- визначати `bestDay`;
- визначати `lastActivity`;
- прогнозувати дні до завершення;
- рахувати тривалість читання;
- заповнювати відсутні календарні дні для графіка;
- перевіряти повноту журналу.

Усі ці значення приходять із API.

На фронтенді дозволено лише:

- форматувати числа;
- форматувати дати;
- локалізувати тексти;
- вибирати, які готові поля показати для конкретного статусу;
- керувати UI-станом;
- передавати query-параметри;
- відображати отримані масиви.

## 1.3. Не дублювати API-типи

Використовувати типи зі shared package або згенерованого API client.

Не створювати вручну окремі frontend-інтерфейси, які дублюють backend DTO, якщо тип уже доступний у клієнті.

## 1.4. Не робити окремі мережеві запити для кожної секції

Один response `GET /api/books/:id/reading-history` містить:

- `summary`;
- `activity`;
- `history`.

Використовувати одну query для поточного набору параметрів.

Не робити окремі запити для:

- summary;
- chart;
- recent activity;
- full history.

---

# 2. Очікуваний API-контракт

Endpoint:

```http
GET /api/books/:id/reading-history
```

Query:

```ts
{
  activityRange?: "7d" | "14d" | "all";
  page?: number;
  limit?: number;
  sort?: "asc" | "desc";
}
```

Default:

```ts
activityRange = "7d";
page = 1;
limit = 20;
sort = "desc";
```

Очікувана структура відповіді:

```ts
{
  summary: {
    status: ReadingStatus;

    currentPage: number;
    pagesCount: number | null;
    progressPercent: number | null;
    pagesRemaining: number | null;

    startedAt: string | null;
    finishedAt: string | null;
    pausedAt: string | null;
    abandonedAt: string | null;
    lastProgressUpdateAt: string | null;

    readingPeriod: {
      startDate: string | null;
      endDate: string | null;
      calendarDays: number | null;
    };

    activeDaysCount: number;
    updatesCount: number;
    trackedPagesRead: number;
    averagePagesPerActiveDay: number | null;

    bestDay: {
      date: string;
      pagesRead: number;
      updatesCount: number;
      finalPage: number | null;
    } | null;

    lastActivity: {
      date: string;
      pagesRead: number;
      updatesCount: number;
      finalPage: number | null;
    } | null;

    estimatedActiveDaysRemaining: number | null;

    historyCompleteness: {
      isComplete: boolean;
      untrackedPages: number;
    };
  };

  activity: {
    range: "7d" | "14d" | "all";
    from: string | null;
    to: string | null;

    summary: {
      activeDaysCount: number;
      pagesRead: number;
      updatesCount: number;
      averagePagesPerActiveDay: number | null;

      bestDay: {
        date: string;
        pagesRead: number;
        updatesCount: number;
        finalPage: number | null;
      } | null;
    };

    points: Array<{
      date: string;
      pagesRead: number;
      updatesCount: number;
      startPage: number | null;
      finalPage: number | null;
      hasActivity: boolean;
    }>;
  };

  history: {
    days: Array<{
      date: string;
      pagesRead: number;
      updatesCount: number;
      startPage: number;
      finalPage: number;

      events: Array<{
        id: string;
        date: string;
        page: number;
        pagesRead: number;
        recordedAt: string;
      }>;
    }>;

    pagination: {
      page: number;
      limit: number;
      totalDays: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}
```

Якщо фактичні назви після реалізації backend-контракту трохи відрізняються, адаптувати UI до реального generated client, але не переносити розрахунки на фронтенд.

---

# 3. Де показувати функціонал

## 3.1. Компактний блок на сторінці деталей книги

Оновити наявний `reading-progress-block.tsx`.

Блок має бути частиною основного контенту сторінки деталей книги та показувати короткий, але корисний огляд:

- поточний прогрес;
- ключові дати;
- коротку статистику;
- прогноз, якщо він доступний;
- графік активності;
- останню активність;
- перехід до повної історії.

## 3.2. Окрема підтаба

Додати підтабу:

```text
Повна історія читання
```

English:

```text
Full reading history
```

Підтаба має знаходитися в межах сторінки деталей конкретної книги й використовувати той самий `bookId`.

Не створювати окрему глобальну сторінку поза деталями книги, якщо поточна архітектура не вимагає цього.

Використати наявну систему маршрутів і табів. Стан активної підтаби має бути:

- URL-driven, якщо так уже працюють інші таби;
- або інтегрований у наявний tabs state за conventions проєкту.

Після перезавантаження сторінки підтаба має залишатися відкритою, якщо таби в проєкті синхронізуються з URL.

---

# 4. Коли показувати блок

## 4.1. Показувати повний блок

Повний блок показувати для статусів:

- `reading`;
- `paused`;
- `finished`;
- `abandoned` / `dnf`;

якщо існує хоча б одна з умов:

- `currentPage > 0`;
- є `startedAt`;
- є `activeDaysCount > 0`;
- є progress events;
- є `finishedAt`, `pausedAt` або `abandonedAt`.

## 4.2. Для `not_started` і `want_to_read`

Якщо прогресу та історії немає:

- не показувати великий порожній графік;
- залишити наявний CTA для початку читання або оновлення прогресу;
- можна показати компактний нейтральний empty state.

Текст:

UA:

```text
Історія прогресу з’явиться після першого оновлення сторінки.
```

EN:

```text
Progress history will appear after the first page update.
```

## 4.3. Якщо `currentPage > 0`, але історія порожня

Блок поточного прогресу показувати.

Графік та список активності замінити повідомленням:

UA:

```text
Для цього прогресу ще немає детальної історії оновлень.
```

EN:

```text
Detailed update history is not available for this progress yet.
```

Це може трапитися для legacy-даних або книги, прогрес якої створено до журналу.

---

# 5. Візуальний стиль

Компоненти мають відповідати стилю BookNest:

- теплий кремово-бежевий фон;
- основний теракотово-коричневий акцент `#9A5D36` або theme token, який йому відповідає;
- світлі поверхні карток;
- м’які заокруглення;
- тонкі теплі border;
- дуже делікатні тіні;
- достатня кількість повітря;
- невеликі ботанічні акценти лише там, де вони не заважають даним;
- без яскравих холодних кольорів;
- без важких темних таблиць;
- без надмірної кількості бейджів;
- не використовувати чистий чорний для основного тексту, якщо theme має м’якший text color.

Використовувати лише theme tokens і наявні дизайн-змінні, а не розкидати hardcoded значення по компонентах.

Графік має виглядати як частина дизайну BookNest, а не як стандартний аналітичний dashboard.

---

# 6. Компактний блок «Прогрес читання»

## 6.1. Заголовок

Назва залежить від статусу.

### `reading` і `paused`

UA:

```text
Прогрес читання
```

EN:

```text
Reading progress
```

### `finished`

UA:

```text
Підсумок читання
```

EN:

```text
Reading summary
```

### `abandoned` / `dnf`

UA:

```text
Прогрес читання
```

EN:

```text
Reading progress
```

Не використовувати формулювання, яке засуджує незавершене читання.

---

## 6.2. Верхній рядок

Показати:

- поточну сторінку;
- загальну кількість сторінок, якщо вона відома;
- відсоток;
- progress bar.

### Якщо `pagesCount` відома

```text
250 із 320 сторінок
78%
```

EN:

```text
250 of 320 pages
78%
```

### Якщо `pagesCount` невідома

```text
Сторінка 250
```

EN:

```text
Page 250
```

У цьому випадку:

- не показувати фальшивий відсоток;
- не показувати determinate progress bar;
- можна показати neutral/indeterminate visual, якщо це відповідає наявному дизайну;
- не показувати `pagesRemaining`.

### Завершена книга

Якщо `status === "finished"` і `progressPercent !== null`, progress bar має бути заповнений повністю.

---

## 6.3. Блок основних дат

Показати до трьох колонок або невеликих stat items.

### Для `reading`

1. **Почато**
   - `summary.startedAt` або `summary.readingPeriod.startDate`.

2. **Оновлено**
   - `summary.lastProgressUpdateAt`.

3. **Залишилося**
   - `summary.pagesRemaining`.

Приклад:

```text
Почато           Оновлено          Залишилося
5 бер. 2026      12 бер. 2026      70 сторінок
```

### Для `finished`

1. **Почато**
2. **Завершено**
3. **Тривалість**

Приклад:

```text
Почато           Завершено         Тривалість
5 бер. 2026      18 бер. 2026      14 днів
```

Тривалість брати лише з:

```ts
summary.readingPeriod.calendarDays;
```

Не рахувати її на фронтенді.

### Для `paused`

1. **Почато**
2. **На паузі з**
3. **Зупинка**

```text
Почато           На паузі з        Зупинка
5 бер. 2026      12 бер. 2026      сторінка 250
```

### Для `abandoned` / `dnf`

1. **Почато**
2. **Припинено**
3. **Зупинка**

Не використовувати негативний червоний alert, якщо це не помилка.

---

## 6.4. Ключова статистика

Показати до трьох коротких показників:

1. активні дні;
2. середній темп;
3. найкращий день.

### Активні дні

```text
6 активних днів
```

EN:

```text
6 active days
```

Використовувати pluralization i18n.

### Середній темп

```text
42 стор./активний день
```

EN:

```text
42 pages/active day
```

Якщо `averagePagesPerActiveDay === null`, stat item не показувати.

### Найкращий день

```text
84 стор. — найкращий день
```

У tooltip або secondary text показати дату:

```text
8 бер. 2026
```

Якщо `bestDay === null`, stat item не показувати.

Не замінювати відсутні дані нулями там, де `null` означає «даних недостатньо».

---

## 6.5. Прогноз завершення

Показувати лише якщо:

```ts
summary.estimatedActiveDaysRemaining !== null;
```

Текст:

UA:

```text
За поточного темпу залишилося приблизно {{count}} активних днів читання.
```

EN:

```text
At the current pace, about {{count}} active reading days remain.
```

Використовувати pluralization.

Не показувати прогноз для:

- `paused`;
- `finished`;
- `abandoned`;
- `dnf`;
- однієї активної дати;
- невідомої кількості сторінок.

Оформити як невеликий теплий info strip, а не як primary alert.

---

## 6.6. Повідомлення про неповну історію

Якщо:

```ts
summary.historyCompleteness.isComplete === false;
```

і:

```ts
summary.historyCompleteness.untrackedPages > 0;
```

показати делікатне повідомлення:

UA:

```text
Частина раніше збереженого прогресу не має детальної історії оновлень.
```

EN:

```text
Some previously saved progress does not have detailed update history.
```

Не показувати технічне число `untrackedPages` як помилку користувача.

Можна додати tooltip або details:

UA:

```text
Графік і статистика активності побудовані лише за зафіксованими оновленнями.
```

EN:

```text
The activity chart and statistics use recorded updates only.
```

---

# 7. Секція «Активність читання» у компактному блоці

## 7.1. Заголовок

UA:

```text
Активність читання
```

EN:

```text
Reading activity
```

Праворуч додати segmented control або compact tabs:

- `7 днів`;
- `14 днів`;
- `Увесь період`.

English:

- `7 days`;
- `14 days`;
- `All time`.

Значення:

```ts
"7d" | "14d" | "all";
```

Default:

```ts
"7d";
```

## 7.2. Поведінка перемикача

При зміні періоду:

- оновити `activityRange`;
- виконати query із новим параметром;
- не скидати `history.page`, якщо компактний блок не показує пагіновану історію;
- використовувати `keepPreviousData` / placeholder behavior згідно з поточною версією React Query;
- не прибирати весь блок під час refetch;
- показати локальний loading state лише в області графіка;
- уникати layout shift.

Можна синхронізувати range з URL лише якщо такий підхід уже використовується в проєкті. Інакше достатньо локального state.

## 7.3. Графік

Використати chart library, яка вже є в проєкті.

Не додавати нову залежність без потреби.

Рекомендований тип:

- vertical bar chart;
- один bar на календарний день;
- висота bar = `pagesRead`;
- нульові дні залишають місце на осі, але без видимого bar або з мінімальним нейтральним marker;
- x-axis — коротка дата;
- y-axis — сторінки;
- grid lines дуже делікатні;
- без legend, якщо є лише одна серія.

Дані брати без змін із:

```ts
activity.points;
```

## 7.4. Tooltip графіка

Для активного дня:

```text
12 бер. 2026
35 сторінок
3 оновлення
Від сторінки 215 до 250
```

English:

```text
Mar 12, 2026
35 pages
3 updates
From page 215 to 250
```

Показувати рядок сторінок лише якщо `startPage` і `finalPage` не `null`.

Для дня без активності:

```text
11 бер. 2026
Без оновлень
```

English:

```text
Mar 11, 2026
No updates
```

## 7.5. Summary під графіком

Компактно показати статистику саме вибраного періоду:

- `activity.summary.activeDaysCount`;
- `activity.summary.pagesRead`;
- `activity.summary.averagePagesPerActiveDay`.

Приклад:

```text
3 активні дні · 167 сторінок · 55,7 стор./активний день
```

Не розраховувати цей текст із `points` вручну. Використати готові поля `activity.summary`.

## 7.6. Стан без активності

Якщо всі точки мають `hasActivity === false`:

- осі графіка можна залишити або замінити на compact empty state;
- не показувати fake bars;
- показати текст:

UA:

```text
У вибраному періоді оновлень прогресу немає.
```

EN:

```text
There are no progress updates in the selected period.
```

Для `all` із порожнім `points`:

UA:

```text
Історія активності поки порожня.
```

EN:

```text
Reading activity history is empty.
```

---

# 8. Секція «Остання активність»

## 8.1. Розташування

Під графіком у компактному блоці показати секцію:

UA:

```text
Остання активність
```

EN:

```text
Recent activity
```

Показати до трьох останніх day groups.

Джерело:

- перші три елементи `history.days`, якщо запит виконано з `sort = "desc"`;
- не групувати raw events;
- не перераховувати day summary.

## 8.2. Формат рядка

```text
12 бер. 2026     +35 сторінок     До сторінки 250
3 оновлення
```

Якщо `updatesCount === 1`, не потрібно обов’язково показувати окремий count, але використати i18n pluralization.

Якщо `finalPage` доступна завжди в day group, показати її.

Не розгортати окремі events у компактному блоці.

## 8.3. Перехід до повної історії

Додати text button:

UA:

```text
Переглянути повну історію
```

EN:

```text
View full history
```

Після натискання:

- відкрити підтабу **«Повна історія читання»**;
- не відкривати modal, якщо окрема підтаба вже реалізується;
- зберегти контекст поточної книги;
- за можливості зберегти вибраний `activityRange`.

---

# 9. Підтаба «Повна історія читання»

## 9.1. Загальна структура

Підтаба складається з таких секцій:

1. Header підтаби.
2. Велика summary-card.
3. Графік активності з перемикачем 7 / 14 / весь період.
4. Секція **«Усі оновлення прогресу»**.
5. Server-side pagination.

Рекомендована структура:

```text
Повна історія читання
Детальна активність і всі зафіксовані оновлення прогресу

[Summary / progress overview]

Активність читання          [7 днів] [14 днів] [Увесь період]
[chart]

Усі оновлення прогресу                         [Спочатку нові ▼]

[Day accordion]
[Day accordion]
[Day accordion]

[Pagination]
```

---

## 9.2. Header підтаби

UA title:

```text
Повна історія читання
```

UA subtitle:

```text
Детальна активність і всі зафіксовані оновлення прогресу.
```

EN title:

```text
Full reading history
```

EN subtitle:

```text
Detailed activity and every recorded progress update.
```

Не дублювати назву книги великим заголовком, якщо вона вже є в header сторінки деталей.

---

# 10. Summary-card на повній історії

Використати ті самі `summary` дані, але у ширшому форматі.

## 10.1. Верхня частина

Показати:

- current page;
- pages count;
- progress percent;
- progress bar;
- status badge;
- reading period.

## 10.2. Статистичні картки

Показати до чотирьох metric items:

1. `activeDaysCount`;
2. `updatesCount`;
3. `averagePagesPerActiveDay`;
4. `bestDay.pagesRead`.

Приклад:

```text
6 активних днів
9 оновлень
42 стор./активний день
84 стор. — найкращий день
```

Додатково можна показати:

```text
14 календарних днів від початку до завершення
```

лише якщо `readingPeriod.calendarDays !== null`.

Не переповнювати блок усіма можливими полями. Пріоритет — корисність і читабельність.

---

# 11. Графік на повній історії

Функціонально та візуально використовувати той самий reusable component, що й у компактному блоці.

Не дублювати chart implementation.

Створити reusable компоненти, наприклад:

```text
ReadingActivityChart
ReadingActivityRangeTabs
ReadingActivitySummary
```

Назви адаптувати під conventions проєкту.

У повній історії графік може бути вищим і мати більше місця для x-axis labels.

---

# 12. Секція «Усі оновлення прогресу»

## 12.1. Заголовок

UA:

```text
Усі оновлення прогресу
```

EN:

```text
All progress updates
```

Ця назва точна, оскільки журнал містить саме просування сторінок, а не всі статусні дії.

Не називати секцію «Всі сесії читання», бо backend events не є реальними сесіями.

## 12.2. Controls

Праворуч додати sort control:

UA options:

```text
Спочатку нові
Спочатку старі
```

EN:

```text
Newest first
Oldest first
```

Values:

```ts
"desc" | "asc";
```

Default:

```ts
"desc";
```

При зміні sort:

- встановити `page = 1`;
- виконати server query;
- зберегти `activityRange`;
- закрити accordion items, які більше не присутні в поточному result set.

Не додавати frontend-фільтри, яких не підтримує API.

---

# 13. Day accordion

Кожен елемент `history.days` відображати як окрему accordion / collapsible card.

## 13.1. Collapsed header

Показати:

- дату;
- `+{{pagesRead}} сторінок`;
- `{{updatesCount}} оновлень`;
- `До сторінки {{finalPage}}`;
- chevron.

Desktop layout:

```text
12 бер. 2026     +35 сторінок · 3 оновлення      До сторінки 250    ▼
```

Mobile layout:

```text
12 бер. 2026
+35 сторінок · 3 оновлення
До сторінки 250                                  ▼
```

Не дублювати `startPage` у collapsed header, щоб не перевантажувати рядок.

## 13.2. Початково відкритий день

Default behavior:

- якщо перший день має більше однієї event — можна відкрити його за замовчуванням;
- якщо це суперечить наявному accordion pattern, усі дні можуть бути закриті;
- не відкривати одночасно всі дні.

Дозволити:

- або один відкритий день;
- або кілька, якщо так працює загальний Accordion у проєкті.

Пріоритет — consistency із застосунком.

---

# 14. Події всередині дня

## 14.1. Формат

Кожна подія:

```text
10:20     +10 сторінок     До сторінки 225
```

English:

```text
10:20     +10 pages        To page 225
```

Використовувати:

- `event.pagesRead`;
- `event.page`;
- `event.recordedAt`.

## 14.2. Значення часу

`recordedAt` — це час фіксації запису в системі, а не гарантований фактичний час читання.

Додати tooltip біля заголовка або time column:

UA:

```text
Час збереження оновлення. Він може відрізнятися від фактичного часу читання.
```

EN:

```text
The time the update was saved. It may differ from the actual reading time.
```

Не підписувати поле як:

- «Час читання»;
- «Сесія»;
- «Тривалість».

## 14.3. Подія без часу

Якщо `recordedAt` тимчасово не приходить через backward compatibility:

- не вигадувати час;
- не показувати `00:00`;
- відобразити лише:

```text
+10 сторінок     До сторінки 225
```

## 14.4. Візуальне оформлення

Події можна показати як вертикальну timeline:

- невелика крапка;
- тонка вертикальна лінія;
- time;
- progress delta;
- final page.

Лінія не повинна бути надто контрастною.

---

# 15. Pagination

Використовувати лише:

```ts
history.pagination;
```

Показати pagination, якщо:

```ts
totalPages > 1;
```

При зміні сторінки:

- передати новий `page`;
- виконати server query;
- не скролити всю сторінку на самий верх;
- скролити до заголовка секції **«Усі оновлення прогресу»**;
- зберігати `activityRange` і `sort`;
- закрити accordion state попередньої сторінки;
- не об’єднувати локально старі та нові сторінки, якщо UI використовує звичайну pagination.

Показувати:

- page numbers або існуючий Pagination component;
- disabled previous/next відповідно до backend flags;
- total day groups за потреби.

Не пагінувати events усередині одного дня.

---

# 16. Loading states

## 16.1. Перший load компактного блоку

Показати skeleton:

- title line;
- progress line;
- progress bar;
- 3 stat placeholders;
- chart placeholder;
- 2–3 recent activity rows.

Не показувати global fullscreen loader.

## 16.2. Refetch activity range

Під час зміни 7 / 14 / all:

- зберегти попередню висоту chart container;
- показати subtle loading overlay або skeleton bars;
- не приховувати header і summary;
- вимкнути range control лише якщо це потрібно для запобігання race conditions.

## 16.3. Зміна pagination / sort

Loading показувати лише в секції історії.

Summary й chart не повинні блимати, якщо query cache дозволяє залишити попередні дані.

---

# 17. Error states

## 17.1. Помилка всього запиту

Показати local error card:

UA:

```text
Не вдалося завантажити історію читання.
```

EN:

```text
Reading history could not be loaded.
```

Button:

UA:

```text
Спробувати ще раз
```

EN:

```text
Try again
```

Викликати `refetch`.

## 17.2. Помилка після зміни range або page

Не очищати вже показані дані, якщо React Query зберіг previous data.

Показати toast або inline retry state за conventions проєкту.

## 17.3. 404 / access error

Використати загальну логіку сторінки деталей книги, а не створювати окремий нестандартний error screen.

---

# 18. Empty states

## 18.1. Немає жодної історії

UA title:

```text
Історія читання поки порожня
```

UA subtitle:

```text
Онови поточну сторінку — тут з’являться активність і всі зміни прогресу.
```

EN title:

```text
Reading history is empty
```

EN subtitle:

```text
Update the current page to start building activity and progress history.
```

Використати невелику ілюстрацію в стилі застосунку лише якщо вже є відповідний empty-state asset.

Не генерувати новий asset у межах цієї frontend-задачі.

## 18.2. Немає activity в обраному range

Не замінювати всю сторінку empty state.

Показати локальний стан у chart section.

## 18.3. Page поза межами після зміни даних

Якщо backend повернув порожню сторінку, а `totalPages > 0` і поточна page стала невалідною:

- перейти на останню доступну сторінку або page 1 згідно з conventions проєкту;
- не входити в нескінченний refetch loop.

---

# 19. Responsive behavior

## Desktop

- summary stats в один ряд або grid;
- chart займає всю ширину card;
- day header в один ряд;
- events мають окремі колонки для часу, приросту й фінальної сторінки.

## Tablet

- summary stats у 2 колонки;
- controls можуть переноситися на наступний рядок;
- chart залишається читабельним.

## Mobile

- title й controls розміщуються вертикально;
- range tabs мають horizontal scroll або компактний full-width segmented control;
- dates скорочуються відповідно до локалі;
- stat items у 1–2 колонки;
- day accordion header має 2–3 рядки;
- event time та progress stack vertically, якщо не вистачає ширини;
- touch targets мінімум 44×44 px;
- не використовувати horizontal page scroll;
- tooltip графіка має бути доступний через tap.

---

# 20. Accessibility

Обов’язково:

- всі controls доступні з клавіатури;
- accordion button має:
  - `aria-expanded`;
  - `aria-controls`;
- tab / segmented controls мають коректні ролі;
- chart не повинен бути єдиним способом отримати інформацію;
- під chart надати доступний текстовий summary;
- tooltip data має бути доступна не лише hover;
- progress bar має:
  - `role="progressbar"`;
  - `aria-valuemin`;
  - `aria-valuemax`;
  - `aria-valuenow`, якщо percent відомий;
  - зрозумілий `aria-label`;
- кольори мають достатній contrast;
- не передавати статус тільки кольором;
- skeleton позначити як loading;
- error і empty повідомлення читабельні screen reader;
- анімації accordion і chart мають враховувати `prefers-reduced-motion`.

---

# 21. Localization

Усі тексти винести в i18n.

Не писати українські або англійські рядки напряму в JSX.

Використати pluralization для:

- сторінок;
- активних днів;
- календарних днів;
- оновлень;
- прогнозованих днів.

Рекомендовані ключі:

```text
bookDetails.readingProgress.title
bookDetails.readingProgress.summaryTitle
bookDetails.readingProgress.started
bookDetails.readingProgress.updated
bookDetails.readingProgress.finished
bookDetails.readingProgress.paused
bookDetails.readingProgress.abandoned
bookDetails.readingProgress.remaining
bookDetails.readingProgress.duration
bookDetails.readingProgress.activeDays
bookDetails.readingProgress.averagePerActiveDay
bookDetails.readingProgress.bestDay
bookDetails.readingProgress.estimatedDaysRemaining
bookDetails.readingProgress.incompleteHistory
bookDetails.readingProgress.incompleteHistoryHint
bookDetails.readingProgress.activityTitle
bookDetails.readingProgress.range7d
bookDetails.readingProgress.range14d
bookDetails.readingProgress.rangeAll
bookDetails.readingProgress.noActivityInRange
bookDetails.readingProgress.recentActivity
bookDetails.readingProgress.viewFullHistory

bookDetails.readingHistory.tab
bookDetails.readingHistory.title
bookDetails.readingHistory.subtitle
bookDetails.readingHistory.allUpdates
bookDetails.readingHistory.newestFirst
bookDetails.readingHistory.oldestFirst
bookDetails.readingHistory.toPage
bookDetails.readingHistory.fromPageToPage
bookDetails.readingHistory.recordedTimeHint
bookDetails.readingHistory.emptyTitle
bookDetails.readingHistory.emptySubtitle
bookDetails.readingHistory.loadError
bookDetails.readingHistory.retry
```

Назви namespace адаптувати до існуючої структури перекладів.

---

# 22. Компонентна структура

Не створювати один великий component-файл.

Рекомендована декомпозиція:

```text
reading-progress/
  reading-progress-block.tsx
  reading-progress-summary.tsx
  reading-progress-stats.tsx
  reading-progress-forecast.tsx
  reading-activity-chart.tsx
  reading-activity-range-control.tsx
  recent-reading-activity.tsx
  reading-history-completeness-notice.tsx

reading-history/
  reading-history-tab.tsx
  reading-history-header.tsx
  reading-history-overview.tsx
  reading-history-list.tsx
  reading-history-day.tsx
  reading-history-event.tsx
  reading-history-sort.tsx
  reading-history-empty-state.tsx
  reading-history-skeleton.tsx
```

Це лише орієнтир. Дотримуватися фактичної feature-структури проєкту.

Винести reusable parts:

- activity chart;
- range control;
- summary stat item;
- date/page formatting helpers, якщо їх ще немає.

Не виносити просту розмітку в надмірну кількість дрібних компонентів без користі.

---

# 23. Data flow

## 23.1. Compact block

Початкові params:

```ts
{
  activityRange: "7d",
  page: 1,
  limit: 3,
  sort: "desc"
}
```

`limit: 3` потрібен, щоб отримати три останні day groups для секції «Остання активність», якщо backend дозволяє такий limit.

Якщо backend має minimum limit більший за 3, використати мінімальне допустиме значення та показати перші три day groups без агрегації.

## 23.2. Full history tab

Initial params:

```ts
{
  activityRange: "7d",
  page: 1,
  limit: 20,
  sort: "desc"
}
```

State:

```ts
activityRange
historyPage
historySort
expandedDayIds або expandedDates
```

При зміні:

- range → page не обов’язково скидати;
- sort → page = 1;
- bookId → скинути всі локальні controls;
- page → зберегти range і sort.

## 23.3. Cache keys

Query key повинен включати:

- `bookId`;
- `activityRange`;
- `page`;
- `limit`;
- `sort`.

Не використовувати один cache key для різних ranges або pages.

---

# 24. Mutations та інвалідація

Після успішного:

```http
POST /api/books/:id/reading-progress
```

або зміни статусу, яка може змінити прогрес:

- invalidation current book details query;
- invalidation reading history queries для цього `bookId`;
- оновлення compact block;
- оновлення full history tab;
- оновлення прогрес-бару;
- оновлення графіка;
- оновлення recent activity.

Не робити ручні optimistic обчислення summary або chart, оскільки всі похідні значення повертає бекенд.

Можна показати optimistic current page лише якщо це вже безпечно реалізовано в проєкті, але після success обов’язково прийняти backend response як source of truth.

---

# 25. Date and number formatting

Використовувати централізовані locale-aware helpers.

## Calendar date

UA:

```text
12 бер. 2026
```

EN:

```text
Mar 12, 2026
```

## Time

UA / EN:

```text
10:20
```

залежно від locale/time settings.

## Numbers

Використовувати `Intl.NumberFormat` або наявний helper.

Не зберігати formatted strings у state.

## Timezone

Не робити ручний shift `date` поля типу `YYYY-MM-DD` через `new Date(date)` без контролю timezone, оскільки це може змістити календарний день.

Для calendar-only date використовувати безпечний date-only formatter або парсер, прийнятий у проєкті.

`recordedAt` форматувати як datetime.

---

# 26. Chart implementation details

1. Chart має приймати готові `points`.
2. Не робити `reduce` для побудови денних значень.
3. `hasActivity` визначає активну / нульову точку.
4. Для `7d` підписати кожен день.
5. Для `14d` дозволено показувати скорочені labels або кожен другий label, але всі bars мають залишатися.
6. Для `all` кількість x-axis labels адаптувати до ширини:
   - bars не видаляти;
   - labels можна проріджувати;
   - tooltip має працювати для кожної точки.
7. Не використовувати fixed bar width, яка ламає довгі періоди.
8. Додати horizontal scroll лише якщо це відповідає UX проєкту; пріоритет — responsive chart container.
9. Не показувати decimal page count.
10. Tooltip повинен використовувати готові поля, не відновлювати їх із сусідніх points.

---

# 27. Status-specific UI

## `reading`

Показати:

- progress;
- remaining pages;
- active stats;
- forecast;
- chart;
- recent activity.

## `paused`

Показати:

- progress;
- paused date;
- stop page;
- active stats;
- chart;
- recent activity.

Не показувати forecast.

Можна додати neutral status chip:

```text
На паузі
```

## `finished`

Показати:

- 100% / final progress;
- start date;
- finish date;
- calendar duration;
- active stats;
- chart;
- recent activity.

Не показувати remaining pages або forecast.

## `abandoned` / `dnf`

Показати:

- progress on stop;
- stopped date;
- active stats;
- chart;
- history.

Не використовувати warning/error semantics.

## `not_started` / `want_to_read`

Без events:

- compact empty state;
- не показувати full chart;
- full history tab може залишатися доступною з empty state або бути прихованою згідно з conventions табів.

Рекомендація: залишити підтабу доступною, щоб структура сторінки не змінювалася залежно від статусу.

---

# 28. Необхідні тести

Використовувати поточний test stack проєкту.

## Unit/component tests

1. Показ блоку для `reading`.
2. Показ summary title для `finished`.
3. `pagesCount = null`.
4. `progressPercent = null`.
5. Показ remaining pages.
6. Приховування remaining для `finished`.
7. Показ duration для `finished`.
8. Показ paused state.
9. Показ abandoned / dnf state.
10. Показ активних днів.
11. Показ average only when not null.
12. Показ best day only when not null.
13. Показ forecast only when backend returns a value.
14. Forecast hidden for `paused`.
15. Forecast hidden for `finished`.
16. Incomplete history notice.
17. Empty history state.
18. Legacy progress without events.
19. Activity range control.
20. Correct query params for `7d`.
21. Correct query params for `14d`.
22. Correct query params for `all`.
23. Chart receives backend points without reaggregation.
24. Zero-activity day tooltip.
25. Recent activity shows no more than three days.
26. View full history navigation.
27. Full-history tab renders.
28. Sort defaults to `desc`.
29. Sort change resets page to 1.
30. Day accordion header.
31. Expanded day events.
32. Time hidden when `recordedAt` unavailable.
33. Pagination uses backend metadata.
34. Page change requests correct page.
35. Loading skeleton.
36. Local refetch state.
37. Error and retry.
38. i18n pluralization.
39. Mobile layout critical elements.
40. Accessibility attributes for accordion.
41. Accessibility attributes for progress bar.
42. Keyboard interaction for tabs and accordion.

## Integration tests

43. Progress mutation invalidates reading history.
44. Status mutation invalidates reading history when appropriate.
45. Switching book resets local filters and accordion.
46. URL tab state opens full history directly, якщо tab navigation URL-driven.
47. Back/forward navigation works for tab state.
48. Previous data remains visible during range refetch.
49. Empty page after data change is handled safely.

---

# 29. Acceptance criteria

Задача завершена, якщо:

1. На сторінці деталей книги є оновлений блок «Прогрес читання».
2. Для завершеної книги блок змінюється на «Підсумок читання».
3. Блок показує current page, pages count, percent і progress bar без frontend-розрахунків.
4. Блок показує коректні status-specific dates.
5. Блок показує активні дні, середній темп і найкращий день із backend response.
6. Forecast показується лише коли backend повернув значення.
7. Є графік активності за 7, 14 днів і весь період.
8. Дні без активності відображаються коректно.
9. Перемикання range виконує server query.
10. Є секція «Остання активність» максимум із трьох day groups.
11. Кнопка «Переглянути повну історію» відкриває окрему підтабу.
12. Додано підтабу «Повна історія читання».
13. Підтаба має summary, chart і список усіх оновлень.
14. Усі оновлення відображаються вже згрупованими за днями.
15. Day group можна розгорнути й побачити окремі events.
16. Для event показуються `pagesRead`, `page` та `recordedAt`, якщо він доступний.
17. Не використовується термін «сесія читання» для progress event.
18. Сортування виконується через backend query.
19. Пагінація виконується на сервері за day groups.
20. Frontend не виконує бізнес-агрегації або математичні розрахунки.
21. Після update progress дані автоматично оновлюються.
22. Реалізовані loading, refetch, error та empty states.
23. UI адаптивний для desktop, tablet і mobile.
24. Компоненти відповідають стилю BookNest.
25. Усі тексти локалізовані українською та англійською.
26. Компоненти доступні з клавіатури й мають коректні ARIA attributes.
27. Тести проходять.
28. Немає дублювання API DTO.
29. Немає нової chart-залежності, якщо в проєкті вже є придатна бібліотека.
30. Немає великих монолітних component-файлів.
31. Немає console errors, TypeScript errors або lint errors.
32. Поточний функціонал оновлення сторінки й статусу книги не зламаний.

---

# 30. Очікуваний результат від агента

Після реалізації агент має надати:

1. Перелік створених і змінених файлів.
2. Короткий опис архітектури компонентів.
3. Який generated hook використано.
4. Як реалізовано range, sort і pagination.
5. Як реалізовано invalidation після mutation.
6. Які empty/error/loading states додано.
7. Які i18n keys додано.
8. Які тести створено або оновлено.
9. Результат:
   - typecheck;
   - lint;
   - unit/component tests;
   - build, якщо він запускався.
10. Окремо зазначити будь-які розбіжності між фактичним backend DTO та очікуваним контрактом.

Не завершувати задачу лише статичним макетом. Має бути реалізований повний функціонал із реальним API, query parameters, станами та тестами.
