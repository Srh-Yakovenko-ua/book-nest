# Claude Code task — реалізувати «Історію позик»

## Мета

Реалізуй у BookNest окрему повноцінну сторінку **«Історія позик»** для завершених `BookLoan`.

Сторінка повинна об’єднувати історію двох напрямків:

- `borrowed_from_someone` — книги, які користувач позичав у інших;
- `lent_to_someone` — книги, які користувач передавав іншим.

Історія не повинна дублювати активні сторінки. Вона відповідає на питання:

- що і коли було позичено/передано;
- кому або в кого;
- який був погоджений строк повернення;
- коли книгу фактично повернули;
- скільки тривала позика;
- чи була вона повернута вчасно.

---

## 0. Перед змінами

Обов’язково:

1. Прочитай `CLAUDE.md`.
2. Перевір актуальну структуру loans у backend, shared та frontend.
3. Перевір `git status` / поточний working tree.
4. Перевикористай уже реалізовані loans patterns, components, query-state, `UiIcon`, `next-intl`, API client.
5. Не відкатуй новіші локальні зміни, навіть якщо їх немає в публічному `dev`.
6. Не створюй дублюючу архітектуру.

---

# 1. Навігація

У sidebar група **«Позичені книги»** повинна мати:

- Треба повернути
- Передано іншим
- **Історія позик**

Для історії створи окремий route за поточним routing pattern проєкту; рекомендована семантика:

`/loans/history`

Не роби «Історію» табом усередині активної сторінки.

Не додавай нову bottom navigation — використовуй поточний application shell.

---

# 2. Lifecycle

Історія будується на тих самих `BookLoan`.

Коли існуючий return flow завершує позику:

- `status` стає `returned`;
- записується `returnedAt`;
- запис зникає з активних loans;
- запис автоматично стає доступним у «Історії позик».

Не створюй ручну кнопку «Перенести в історію».

Не створюй окрему таблицю `LoanHistory`.

---

# 3. Результат завершеної позики

Backend повинен визначати `historyResult`:

### `on_time`

Є `expectedReturnDate`, і фактична календарна дата повернення:

`returnedDate <= expectedReturnDate`

### `late`

Є `expectedReturnDate`, і:

`returnedDate > expectedReturnDate`

Додатково повернути:

`delayDays = returnedDate - expectedReturnDate`

### `no_due_date`

`expectedReturnDate = null`

Для такого запису не показувати «вчасно/із запізненням».

---

# 4. Derived calculations

Усі бізнес-розрахунки виконувати на backend.

Для кожного завершеного запису:

### `durationDays`

Кількість календарних днів від `loanDate` до фактичної дати повернення.

`durationDays = returnedDate - loanDate`

Якщо `loanDate = null`, повертати `durationDays = null`.

### `delayDays`

Тільки для `late`; інакше `null`.

Не рахувати це на frontend.

Порівнювати **календарні дати**, а не raw timestamp із date-only полем. Перевикористай чинну date/timezone normalization стратегію проєкту.

---

# 5. Backend API

Реалізуй read-model історії в існуючому `loans` module.

Мінімально потрібні endpoints:

### `GET /api/loans/history`

Пагінований список завершених позик.

Підтримати:

- `type`
- `result`
- `person`
- `search`
- `returnedFrom`
- `returnedTo`
- `sort`
- `pageNumber`
- `pageSize`

Default:
- усі напрямки;
- усі результати;
- весь час;
- `returned_desc`.

### `GET /api/loans/history/overview`

Повертає backend-calculated:
- stat cards;
- top people;
- duration analytics;
- return reliability.

Overview не повинен залежати від pagination.

### `GET /api/loans/history/:loanId`

Деталі конкретної завершеної позики.

### People filter

Для autocomplete / dropdown людей:
- перевикористай існуючий відповідний endpoint, якщо він уже є;
- інакше додай невеликий `GET /api/loans/history/people`.

Не будуй список людей із поточної page історії.

---

# 6. Фільтри

## Напрямок

- Усі напрямки
- Позичено в інших
- Передано іншим

Під капотом використовувати існуючі `LoanType`.

## Результат

- Усі результати
- Повернуто вчасно
- Із запізненням
- Без визначеного строку

## Людина

Autocomplete/dropdown за `personName`.

## Період

Frontend presets:

- За весь час
- Цього року
- Минулого року
- Власний діапазон

Backend отримує нормалізовані `returnedFrom` / `returnedTo` у date-only форматі.

## Пошук

Placeholder:

`Пошук за книгою або людиною…`

Search backend-side за:
- title;
- originalTitle;
- author;
- personName;
- за можливості contact/note, якщо це відповідає чинній loans search semantics.

---

# 7. Сортування

Backend до pagination.

Варіанти:

- `returned_desc` — **Нещодавно повернені** — default;
- `returned_asc` — Найдавніше повернені;
- `loan_date_desc` — За датою позики / передачі;
- `duration_desc` — За тривалістю;
- `title_asc` — За назвою;
- `person_asc` — За людиною.

Додай stable tie-breaker (`id`) для однакових значень.

Не сортуй `page.items` на frontend.

---

# 8. Stat cards

Показувати 4 неклікабельні картки.

## 1. Усього завершено

Основне:
`37 позик`

Третій рядок:
`21 передано · 16 позичено`

## 2. Повернуто вчасно

Основне:
`26 позик`

Третій рядок:
`70% усіх завершених`

## 3. Із запізненням

Основне:
`9 позик`

Третій рядок:
`У середньому — на 6 днів`

Якщо late = 0:
`Усі позики зі строком повернуто вчасно`

## 4. Середня тривалість

Основне:
`18 днів`

Третій рядок:
`Від позики / передачі до повернення`

Усі значення та відсотки рахує backend.

Якщо завершених позик немає взагалі — не показувати 4 нульові картки; показати page empty state.

---

# 9. Історичний запис

Не використовуй активну loan card один-в-один.

Створи reusable history row/card, який передає **timeline**, а не CTA.

Показувати:

- обкладинку;
- title;
- firstAuthorName;
- direction badge;
- `personName`;
- timeline:
  1. дата позики / передачі;
  2. планова дата повернення;
  3. фактична дата повернення;
- result badge;
- `durationDays`.

### Direction copy

Для `borrowed_from_someone`:
- badge: `Позичено в інших`
- перша дата: `Дата позики`

Для `lent_to_someone`:
- badge: `Передано іншим`
- перша дата: `Дата передачі`

### Планова дата

Якщо `expectedReturnDate = null`:
`Без визначеного строку`

### Result

`on_time`:
**Повернуто вчасно**
зелений/success tone.

`late`:
**Із запізненням на 5 днів**
amber/warning tone, не роби його активним danger-state.

`no_due_date`:
**Повернуто · строк не визначено**
neutral tone.

Під result можна показувати:
`22 дні` / `30 днів усього`.

---

# 10. Поведінка кліку

Клік по history row:
- відкриває **detail drawer** конкретної позики.

Title/cover:
- можуть мати окремий явний link на сторінку книги;
- не роби всю картку навігацією на книгу, бо основний click — деталі позики.

---

# 11. Detail drawer

Показувати:

- книга;
- напрямок;
- personName;
- contact, якщо є;
- loanDate;
- expectedReturnDate;
- returnedAt / returnedDate;
- durationDays;
- historyResult;
- delayDays, якщо late;
- note.

Не робити reminder основним історичним контентом.

Actions:

- Перейти до книги
- Виправити дату повернення
- Редагувати нотатку

Не показувати звичайну prominent кнопку Delete.

---

# 12. Обмежене редагування history

Якщо в поточній архітектурі немає безпечного endpoint для завершеної позики, додай окрему mutation за **loanId**, а не bookId.

Дозволити змінювати тільки:

- фактичну дату повернення;
- note.

Заборонити цим endpoint:
- повертати `status` у active;
- змінювати ownership;
- змінювати type;
- змінювати personName;
- змінювати loanDate;
- змінювати expectedReturnDate;
- активувати reminder.

Після зміни фактичної дати backend автоматично перераховує:
- result;
- delayDays;
- durationDays;
- overview analytics.

Валідація:
- completed loan належить current user;
- status = returned;
- нова фактична дата не може бути раніше `loanDate`, якщо `loanDate` є.

---

# 13. Правий sidebar

Sidebar історії **аналітичний**, не операційний.

## Блок 1. Найчастіше взаємодієте

Top 5 `personName` за кількістю завершених позик.

Для кожного:
- ім’я;
- `8 позик`;
- додатково: `5 передано · 3 позичено`.

Клік:
- застосовує `person` filter до основного списку.

## Блок 2. Тривалість позик

Показувати:
- Середня — `18 днів`
- Найдовша — `73 дні`
- Найкоротша — `2 дні`

Рахувати backend-side тільки за записами, де можна визначити duration.

## Блок 3. Надійність повернень

Показувати:
- `% повернуто вчасно`;
- кількість `on_time`;
- кількість `late`;
- кількість `no_due_date`.

Це read-only analytics.

Не додавати статичний блок «Порада».

---

# 14. Scope analytics

Для `overview` stat cards + sidebar analytics:

Враховувати:
- `type`;
- `person`;
- `returnedFrom`;
- `returnedTo`.

Не застосовувати до overview:
- текстовий `search`;
- `result`;
- pagination;
- sort.

Таким чином analytics відображає вибраний аналітичний контекст, але не стає безглуздою при фільтрі `late`.

---

# 15. Empty / loading / error

## Загальний empty state

Якщо завершених позик немає:

**Історія позик поки порожня**

`Завершені позики з’являться тут після того, як книгу буде позначено повернутою.`

Не показувати 4 stat cards із нулями.

## Filtered empty

**За цими умовами нічого не знайдено**

Дія:
`Очистити фільтри`

## Loading

Використати існуючі skeleton patterns.

## Error

Існуючий error pattern + retry.

---

# 16. Responsive

Desktop:
- 4 stat cards;
- filters/search;
- main history list;
- right analytics sidebar.

Tablet/mobile:
- не створюй нову навігацію;
- перевикористай чинний responsive shell;
- правий sidebar перенеси у чинний mobile overview / secondary panel pattern, якщо він уже є;
- stat cards — адаптивна grid/compact representation;
- filters — current mobile filter pattern;
- history timeline повинен залишатися читабельним, дозволено вертикальний timeline на вузькому екрані.

---

# 17. Localization

Усі тексти через `next-intl`.

Мінімум:
- `uk`
- `en`

Коректні plural forms:
- позика / позики / позик;
- день / дні / днів;
- книга / книги / книг.

Не хардкодити українські строки в components.

---

# 18. Icons / design

Перевикористовуй поточний design system і `UiIcon`.

Не додавати custom SVG, якщо семантично відповідна іконка вже є.

Preferred semantics:
- history / book-copy — загальна історія;
- circle-check — вчасно;
- clock / clock-alert — запізнення / тривалість;
- calendar — dates;
- users — people.

Не вважати reference PNG pixel-perfect специфікацією. Відтворити структуру та hierarchy у стилі чинного BookNest.

---

# 19. Backend requirements

- query/filter/sort виконувати до pagination;
- не рахувати analytics із `page.items`;
- не fetch-all + filter/sort in memory;
- не робити N+1;
- якщо Prisma не виражає column-to-column comparison або duration sort, використати safe parameterized SQL за патернами репозиторію;
- не створювати новий history table;
- додати/перевірити індекс для `userId + status + returnedAt`, якщо немає еквівалентного;
- не рефакторити `status` String у enum у межах цієї задачі.

---

# 20. Tests

Покрий:
- history result;
- delayDays;
- durationDays;
- date boundaries;
- no due date;
- filters;
- search;
- sort;
- pagination;
- overview analytics;
- top people;
- user isolation;
- completed-only isolation;
- detail endpoint;
- restricted history correction;
- frontend query state;
- empty states.

Детальний checklist — `04_TESTS_ACCEPTANCE.md`.

---

# 21. Definition of Done

Завдання готове, коли:

- історія — третя окрема сторінка loans;
- completed records автоматично видно після return;
- active records у history не потрапляють;
- обидва напрямки підтримуються;
- calculations backend-side;
- filters/sorts працюють до pagination;
- overview не залежить від current page;
- detail drawer працює;
- responsive не ламає existing shell;
- `uk`/`en` повні;
- API client regenerated, якщо потрібно;
- typecheck/lint/tests проходять.

Не роби unrelated refactor.
