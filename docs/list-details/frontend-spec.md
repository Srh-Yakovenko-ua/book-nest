# Frontend — сторінка деталей кастомного списку

Реалізація клієнтської частини `docs/booknest-list-details-spec.md`. Рішення й порядок етапів —
у [`README.md`](./README.md), контракти — у [`backend-spec.md`](./backend-spec.md).

## Межі

- **Не чіпати `apps/api/**` і `packages/shared/**`** — контракти приходять із бекенду через
  `pnpm gen:api`. До того, як поле з'явиться в згенерованому клієнті, фронт-етап не починається
  (typecheck впаде).
- **Не хардкодити тексти** — усе через `next-intl`, ключі синхронно в `uk.json` і `en.json`
  (скіл `add-i18n-key`).
- Семантичні токени (`bg-background`, `text-ink`, `text-muted-foreground`), не сирі кольори.
- `src/components/ui/**` — вендорений shadcn, **не редагувати**.
- Дані — тільки через `features/lists/api/**`; жодного `fetch` у компонентах.
- Без `useMemo` / `useCallback` / `React.memo` без виміряної проблеми.

## Головний принцип цієї сторінки

**Майже все вже написано в «Моїй бібліотеці».** Тулбар, швидкі фільтри, розширена панель, чіпи
активних умов, режим сітки/списку, панель масового вибору — усе це існує в `features/books` і
працює. Завдання — не вигадати другу реалізацію, а **перевикористати патерн зі скоупом списку**.

| Потрібно                        | Взірець                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| nuqs-парсери й стан запиту      | `features/books/model/library-query.ts`, `use-library-query.ts`                             |
| швидкі таби зі статусами        | `features/books/model/library-quick-filters.ts`, `components/library-quick-filters.tsx`     |
| розширена панель фільтрів       | `features/books/components/library-advanced-filters.tsx`                                    |
| чіпи активних умов              | `features/books/components/library-active-filters.tsx`, `model/use-library-filter-chips.ts` |
| панель масових дій              | `features/books/components/library-bulk-bar.tsx`, `model/selection-store.ts`                |
| компактний рядок (режим списку) | `features/books/components/book-row.tsx`                                                    |
| правий sticky-бар               | `features/series/components/series-details-view.tsx:91`, `series-sidebar.tsx`               |

Копіювати файли **не треба**; треба виносити спільне тільки там, де воно справді спільне
(правило третього використання), а решту писати поруч у `features/lists`.

## Поточний стан

```
apps/web/src/app/[locale]/(app)/lists/[id]/page.tsx     маршрут
features/lists/components/list-details.tsx              завантаження, скелет, стани помилки
features/lists/components/list-details-view.tsx         макет, сітка карток, діалоги
features/lists/components/list-details-header.tsx       шапка
features/lists/components/list-details-toolbar.tsx      пошук + сортування
features/lists/components/list-book-card.tsx            картка книги
features/lists/api/use-list-detail.ts                   useInfiniteQuery, pageSize 24
features/lists/api/list-keys.ts                         ключі кешу
features/lists/model/list-book-sort.ts                  опції сортування
```

Пошук і сортування зараз у `useState` всередині `list-details.tsx` — вони переїжджають в URL.

---

# 1. Макет

## Desktop (≥ 1280 px)

```
┌─────────────────────────────────────────────┬──────────────┐
│ шапка списку (колаж · назва · опис · дії)    │              │
│ 4 статистичні картки                        │  правий бар  │
│ швидкі таби                                 │   19rem      │
│ тулбар                                      │   sticky     │
│ чіпи активних фільтрів                      │              │
│ книги (сітка / список)                      │              │
│ «Показати ще»                               │              │
└─────────────────────────────────────────────┴──────────────┘
```

Обгортка — той самий грід, що в деталях серії:

```tsx
<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-8">
```

Бар — `<aside className="hidden flex-col gap-6 lg:flex">` зі `sticky top-*`. **Sticky вмикається
з `xl`, не з `lg`**: на 768–1279 px бар з'їдає третину ширини й книги стискаються в одну колонку,
тож там він переноситься вниз.

## Порядок блоків на мобільному

1. шапка списку
2. `Зараз читаються`
3. статистичні картки
4. швидкі таби + тулбар + чіпи
5. книги
6. `Ціль для добірки`
7. `Про добірку` (згортуваний, згорнутий)
8. `Спільні книги з іншими списками` (згортуваний, згорнутий)

`Зараз читаються` стоїть **вище статкарток**: перший екран мобільного — це вся увага
користувача, і «продовжити читання» — єдина дія на цій сторінці, яку роблять щодня.

Сітка книг на мобільному — **одна колонка**. Дві колонки на 360 px дають обкладинку 140 px і
назву в три рядки; це гірше, ніж один читабельний рядок.

---

# 2. Стан сторінки — URL

Створити `features/lists/model/list-detail-query.ts` за взірцем `library-query.ts`. Парсери — з
`nuqs/server` (module-scope парсери з `"nuqs"` ламають `next build` на RSC-сторінках).

```ts
export const listDetailQueryParsers = {
  author: parseAsArrayOf(parseAsString).withDefault([]),
  bookType: parseAsStringLiteral(LIST_BOOK_TYPE_VALUES),
  format: parseAsArrayOf(parseAsStringLiteral(LIST_FORMAT_VALUES)).withDefault([]),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  inQueue: parseAsBoolean,
  isFavorite: parseAsBoolean,
  owner: parseAsArrayOf(parseAsStringLiteral(LIST_OWNER_VALUES)).withDefault([]),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(sortValues).withDefault(LIST_BOOK_SORT_DEFAULT),
  status: parseAsArrayOf(parseAsStringLiteral(LIST_STATUS_VALUES)).withDefault([]),
  tab: parseAsStringLiteral(LIST_BOOK_TABS).withDefault("all"),
  view: parseAsStringLiteral(LIST_VIEW_MODES).withDefault("grid"),
};
```

Значення літералів беруться з **згенерованих enum-об'єктів** (`@/shared/api/generated/model`), не
пишуться руками — так контракт і фронт не розходяться.

Правила:

- сторінка пагінації **в URL не потрапляє** — `Показати ще` не змінює адресу;
- пошук у стан URL пише з дебаунсом 250 мс (`useDebouncedValue` вже є);
- `view` — в URL, як і в бібліотеці. У профілі є поле `libraryViewMode`, але фронт його не
  використовує; підключати його заради цієї сторінки — розширення обсягу;
- сортування «окремо для кожного списку» **не зберігаємо**.

---

# 3. Тулбар і фільтри

## 3.1 Швидкі таби (окремий рядок над тулбаром)

`Усі 100` · `Не розпочаті 62` · `Читаю 4` · `Прочитані 28` — числа з `detail.statusCounts`.

Правило синхронізації, дзеркальне до серверного (див. backend-spec §1.3):

- клік по табу → `tab = key`, **`status` очищується**;
- вибір конкретних статусів у розширеній панелі → `tab = "all"`;
- активним підсвічується таб лише коли `status` порожній.

Таб із нульовим лічильником лишається клікабельним (порожній стан пояснить, чому нічого немає) —
ховати таби не можна, вони є навігаційним орієнтиром «скільки чого в добірці».

## 3.2 Тулбар

```
[ Пошук у списку ] [ Фільтри · 4 ] [ Сортування: Позиція в списку ] [ ⊞ ☰ ] [ Вибрати ]
```

- `Фільтри · N` — **N = кількість активних умов**, не знайдених книг. Мультивибір із 3 значень —
  це одна умова, не три.
- Панель фільтрів: `Popover` на desktop, `Sheet` (bottom) на мобільному — обидва примітиви є.
- Порядок груп у панелі: `Статус читання` · `Наявність книги` · `Формат` · `У черзі читання` ·
  `Тільки улюблені` · `Автор` · `Жанр` · `Серійність`.
- `Автор` і `Жанр` — мультивибір із пошуком (`Command`), джерело — `useListFacets(id)`,
  лічильники поруч зі значенням. Пастка: `IntersectionObserver` усередині `cmdk` не спрацьовує —
  якщо знадобиться довантаження, брати `CommandList onScroll` (див. `use-infinite-scroll.ts`).
- `Наявність книги` — мультивибір по шести статусах володіння, `Немає у власності` = `none`.
- `У черзі читання` — три стани (`У черзі` / `Не в черзі` / не вибрано), мапиться в
  `inQueue: true | false | null`.
- `Тільки улюблені` — `Switch`, `isFavorite: true | null` (варіант «не в улюблених» не потрібен).
- `Серійність` — `Усі` / `Серійні книги` / `Окремі книги` → `bookType`.

## 3.3 Чіпи активних умов

Під тулбаром, кожен із `×`, поруч `Скинути все`. Один чіп на одне значення (`Фентезі ×`), не на
групу. Взірець логіки — `use-library-filter-chips.ts`.

---

# 4. Статистичні картки

Чотири неклікабельні картки, джерело — `useListOverview(id)`. Структура й висота — така сама, як
на інших сторінках (взірець: `lists-summary-cards.tsx`, `books-library.tsx`).

| #   | Іконка           | Заголовок       | Значення               | Третій рядок                                             |
| --- | ---------------- | --------------- | ---------------------- | -------------------------------------------------------- |
| 1   | `Books`          | Усього книг     | `{totalBooks} книг`    | `Від {distinctAuthorsCount} різних авторів`              |
| 2   | `CircleCheckBig` | Прочитано       | `{finishedCount} книг` | `{percent}% усієї добірки`                               |
| 3   | `ListTodo`       | У черзі читання | `{inQueueCount} книг`  | `{totalBooks - inQueueCount} книг ще не додано до черги` |
| 4   | `LibraryBig`     | Є у власності   | `{ownedCount} книг`    | `{totalBooks - ownedCount} книг ще не у власності`       |

Граничні стани:

- `totalBooks === 0` — сторінка показує порожній стан замість карток; ділення на нуль не виникає.
- картка 2, `finishedCount === 0` → `Ще жодної прочитаної книги`.
- картка 3, `inQueueCount === 0` → `Жодної книги ще не заплановано`; `inQueueCount === totalBooks`
  → `Уся добірка вже запланована`.
- картка 4, `ownedCount === totalBooks` → `Уся добірка у власності`; `ownedCount === 0` →
  `Жодної книги ще немає у власності`.

Картки **нічого не фільтрують і не мають `onClick`**. Відсоток — `Math.round`.

Скелет: чотири картки з тією самою висотою, поки `overview` вантажиться — інакше вся сторінка
стрибне після відповіді.

---

# 5. Картка книги

## 5.1 Один шаблон, а не вісім станів

Спека перелічує вісім «станів картки». Це **один компонент і одна мапа**:

```ts
const CTA_BY_STATUS = {
  dnf: "view",
  finished: "view",
  not_started: "start",
  paused: "resume",
  reading: "continue",
  rereading: "continue",
  want_to_read: "start",
} as const satisfies Record<ReadingStatus, ListBookCta>;
```

Слоти картки:

1. обкладинка (`aspect-[2/3]`, fallback-іконка при `cover === null`);
2. назва (2 рядки, `line-clamp-2`) + автори (1 рядок, `line-clamp-1`);
3. бейдж статусу читання + бейдж володіння (компонент `StatusBadge` уже є);
4. метарядок: сторінки · рейтинг · `Позиція N` (лише при `sort === "position"`) · чіп `У черзі`;
5. один CTA + меню `•••`.

Індикатор улюбленого — іконка-серце в куті обкладинки, не окремий бейдж (він з'їдає рядок).

Довгі назви — `line-clamp` + `title`-атрибут, не `truncate` в один рядок: у списку книг назва
важливіша за вирівнювання.

## 5.2 Меню `•••` картки

`Переглянути книгу` · `Продовжити читання` (якщо доречно) · `Додати в чергу` /
`Перейти до черги` · `Додати до іншого списку` · **`Перемістити вище`** · **`Перемістити нижче`** ·
`Прибрати зі списку`.

`Перемістити вище/нижче` — **завжди в DOM**, навіть коли є drag handle. Це не запасний варіант для
випадку «DnD не завезли», це доступний шлях виконати ту саму дію з клавіатури. Вони `disabled` із
поясненням, коли `canReorder === false`.

## 5.3 Режим списку

Компактний рядок: `[drag] [обкладинка 40×60] [назва + автор] [статус] [володіння] [сторінки] [•••]`.
На вужчих екранах колонки метаданих зникають зліва направо, назва лишається завжди. Взірець —
`book-row.tsx`.

Режим списку — **основний вибір для добірок понад ~30 книг**; за замовчуванням усе одно `grid`,
але користувач перемикається одним кліком і вибір живе в URL.

## 5.4 Ручний порядок

`canReorder = sort === "position" && q === "" && активних фільтрів немає && !isFetching`.

Коли `canReorder === false` — drag handle прихований, пункти переміщення `disabled`, при спробі —
підказка:

> Щоб змінити порядок книг, виберіть сортування «Позиція в списку» та скиньте пошук і фільтри.

Причина не косметична: `↑ ↓` міняє книгу місцями із сусідом **у повному списку**, а не у видимій
вибірці, тож у відфільтрованому виді результат не збігся б із тим, що людина бачить.

---

# 6. Правий бар

Чотири блоки в порядку: `Ціль для добірки` · `Зараз читаються` · `Про добірку` ·
`Спільні книги з іншими списками`.

Блок без релевантних даних **ховається повністю**, без порожнього стану. Єдиний виняток —
`Ціль для добірки` в початковому стані з кнопкою створення.

## 6.1 Ціль для добірки

Див. [`../reading-goals/frontend-spec.md`](../reading-goals/frontend-spec.md). До реалізації цілей
блок не рендериться взагалі — решта бару працює без нього.

## 6.2 Зараз читаються

Джерело — `overview.currentlyReading`. `null` → блок не рендериться.

```
Зараз читаються
[обкладинка] Назва книги
             Автор
             стор. 128 з 320 · 40%
             [ Продовжити читання ]
Ще 2 книги читаються
```

Прогрес: `readingProgress.currentPage` і `pagesCount`. Якщо `pagesCount === null` — показати лише
сторінку без відсотка, не рахувати відсоток від невідомого. Прогрес-бар: примітив `ui/progress`
не прокидає `value` в ARIA, тому `aria-valuenow` передавати явно.

`Ще N книг читаються` — тільки при `othersCount > 0`, ICU-плюрал.

Клік по книзі або по CTA → сторінка деталей книги.

## 6.3 Про добірку

Постійний інформаційний блок, **не дублює статкартки**.

```
Про добірку
6 жанрів
4 серії · 11 окремих книг
7 840 сторінок          ← «Для 17 із 20 книг», якщо pagesKnownCount < totalBooks
[Романтика] [Драма] [Фентезі]
```

- Числа — з `overview`: `genresCount`, `seriesCount`, `soloCount`, `totalPages`, `pagesKnownCount`,
  `topGenres`.
- Уточнення про сторінки показувати **тільки** коли `pagesKnownCount < totalBooks`.
- Чіпи жанрів — **інформаційні**, без `onClick`, не фільтрують.
- Блок неклікабельний цілком.
- Не показувати тут: загальну кількість книг, кількість авторів, прочитані, у черзі, у власності.
- Числа через `toLocaleString` локалі.

## 6.4 Спільні книги з іншими списками

Джерело — `useListRelated(id)`. Порожній масив → блок не рендериться.

- Згорнутий стан — **3 рядки**, решта за `Показати всі` **всередині блока** (без модалки й без
  окремої сторінки).
- Рядок: назва списку (`Link` на `/lists/{id}`) + `{sharedCount} спільних книг` (ICU-плюрал).
- Уся строка клікабельна, не лише текст назви.
- `bookCount` можна показати як `6 з 8` — це і є сценарій «списки, що майже дублюють один одного».

---

# 7. Масовий вибір

Кнопка `Вибрати` в тулбарі вмикає режим. Стан — Zustand-стор за взірцем
`features/books/model/selection-store.ts` (окремий стор для списку, щоб вибір не перетікав між
сторінками).

**Дії першої реалізації:** `Прибрати зі списку` · `Додати до іншого списку` · `Додати в чергу` ·
`Улюблені` (додати / прибрати).

Правила:

- панель дій — sticky знизу; на мобільному вона **над** нижньою навігацією, не перекриває її;
- `Вибрати все` = **тільки завантажені книги**, підпис явний: `Вибрано 24 із 100 завантажених`;
- вибір **скидається** при зміні фільтра, таба, сортування й пошуку. «Я видалив 40 книг, а бачив 12» —
  саме те, що ми не допускаємо;
- підтвердження перед масовим прибиранням зі списку **не потрібне** — це зняття членства, а не
  видалення книги. Toast із `Скасувати` достатньо;
- після дії — вихід із режиму вибору.

---

# 8. Порожні стани

| Стан                                | Що показати                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| Список порожній (`bookCount === 0`) | Пояснення + `Додати книги` + `До списків`. Тулбар, таби й статкартки не рендеряться. |
| Немає результатів пошуку            | Текст + `Очистити пошук`.                                                            |
| Немає результатів через фільтри     | Текст + `Скинути фільтри` + перелік активних умов, які до цього призвели.            |
| Порожній швидкий таб                | `У цій добірці ще немає прочитаних книг.` Без додаткової CTA.                        |
| Помилка завантаження                | Повідомлення + `Спробувати ще раз` (`refetch`).                                      |
| 404 списку                          | Уже реалізовано в `list-details.tsx`.                                                |

Часткова відсутність даних у картці: немає обкладинки → іконка-заглушка; немає автора →
`Автор невідомий`; немає сторінок → метарядок без сторінок (не `0 сторінок`); немає рейтингу →
блок рейтингу не рендериться.

---

# 9. Оновлення після дій

**Оптимістично — лише улюблене й `↑ ↓`.** Усе інше — pending-стан на конкретному елементі +
інвалідація.

Причина: після прибирання книги треба перерахувати `overview`, `statusCounts`, `facets` і
`related`. Оптимістично підтримувати чотири похідні структури й коректно їх відкочувати при
помилці — робота, яка не окупається.

Ключі кешу (розширити `list-keys.ts`):

```ts
export const listKeys = {
  detail: (id: string) => [LISTS_ROOT, "detail", id] as const,
  facets: (id: string) => [LISTS_ROOT, "facets", id] as const,
  list: (params: ListsListParams) => [LISTS_ROOT, "list", params] as const,
  overview: (id: string) => [LISTS_ROOT, "overview", id] as const,
  related: (id: string) => [LISTS_ROOT, "related", id] as const,
  root: [LISTS_ROOT] as const,
  summary: [LISTS_ROOT, "summary"] as const,
};
```

| Дія                            | Інвалідувати                                         |
| ------------------------------ | ---------------------------------------------------- |
| додати книги                   | `detail`, `overview`, `facets`, `related`, `summary` |
| прибрати книгу (в т.ч. масово) | те саме                                              |
| перемістити позицію            | `detail`                                             |
| додати в чергу                 | `detail`, `overview`                                 |
| улюблене                       | `detail`                                             |
| редагувати список              | `detail`, `list`                                     |
| дублювати список               | `list`, `summary`                                    |

Загальні правила: не перезавантажувати сторінку після локальної дії; не скидати пошук/фільтри/
сортування після редагування книги; loading показувати лише на елементі, над яким виконується дія;
при помилці — попередній стан + зрозумілий текст.

Toast після прибирання: `Книгу прибрано зі списку` з дією `Скасувати` (вже реалізовано в
`list-details-view.tsx:118`).

---

# 10. Доступність

- Усі іконкові кнопки мають `aria-label`.
- Видимий focus-ring на кожному інтерактиві (`focus-visible:ring-3 ring-ring/50`).
- Панель фільтрів і сортування — клавіатура повністю (`Tab`, `Escape`, `Enter`/`Space`); фокус
  повертається на кнопку-тригер після закриття.
- `Перемістити вище/нижче` — завжди доступні з клавіатури (див. §5.2).
- Після зміни позиції — `aria-live="polite"`: `Книгу «{title}» переміщено на позицію {n} з {total}`.
- Модалки мають `DialogTitle`; фокус повертається на елемент, що їх відкрив.
- Прогрес-бар: `aria-valuenow` явно (вендорений `ui/progress` його не прокидає).
- Швидкі таби — `role="tablist"` із `aria-selected`, або група кнопок із `aria-pressed`; змішувати
  не можна.
- Контраст чіпів і бейджів — перевірити в обох темах.

---

# 11. i18n

Нові ключі — під наявним `lists.details`. Обидві локалі одночасно (`add-i18n-key`).

```
lists.details.tabs.{all,not_started,reading,finished}
lists.details.filters.{button,title,reset,apply,activeCount}
lists.details.filters.groups.{status,ownership,format,queue,favorite,author,genre,series}
lists.details.filters.queue.{in,notIn}
lists.details.filters.series.{all,seriesOnly,soloOnly}
lists.details.stats.{total,finished,inQueue,owned}.{title,value,caption,captionEmpty,captionFull}
lists.details.sidebar.currentlyReading.{title,cta,others,progress}
lists.details.sidebar.about.{title,genres,seriesAndSolo,pages,pagesPartial}
lists.details.sidebar.related.{title,shared,showAll,collapse}
lists.details.selection.{enter,exit,selectAll,selected,remove,addToList,addToQueue,favorite,unfavorite}
lists.details.reorder.{hint,announced}
lists.details.view.{grid,list}
lists.details.empty.filtered.{title,description,reset}
lists.details.error.{title,description,retry}
```

Перейменувати наявні підписи сортування відповідно до спеки:
`added_desc` → `Нещодавно додані`, `added_asc` → `Давно додані`, `title_asc` → `Назва: А–Я`,
`author_asc` → `Автор: А–Я`, `rating_desc` → `Оцінка: від найвищої`.
Нові: `author_desc` → `Автор: Я–А`, `rating_asc` → `Оцінка: від найнижчої`.

Порядок в `LIST_BOOK_SORT_OPTIONS` — рівно як у спеці (§«Рекомендований фінальний dropdown»).

---

# 12. Файли

```
features/lists/model/list-detail-query.ts          новий — nuqs-парсери
features/lists/model/use-list-detail-query.ts      новий — читання/запис стану
features/lists/model/list-detail-tabs.ts           новий — таби ↔ статуси, дзеркало серверного правила
features/lists/model/use-list-detail-chips.ts      новий — чіпи активних умов
features/lists/model/list-book-cta.ts              новий — мапа readingStatus → CTA
features/lists/model/list-selection-store.ts       новий — Zustand
features/lists/api/use-list-overview.ts            новий
features/lists/api/use-list-facets.ts              новий
features/lists/api/use-list-related.ts             новий
features/lists/api/use-duplicate-list.ts           новий (етап 4)
features/lists/api/use-list-bulk.ts                новий (етап 4)
features/lists/api/list-keys.ts                    +overview/facets/related
features/lists/api/use-list-detail.ts              прокидання фільтрів
features/lists/components/list-details.tsx         стан із URL замість useState
features/lists/components/list-details-view.tsx    грід із баром, таби, чіпи, режим перегляду
features/lists/components/list-details-toolbar.tsx кнопка фільтрів, перемикач вигляду, «Вибрати»
features/lists/components/list-quick-tabs.tsx      новий
features/lists/components/list-advanced-filters.tsx новий
features/lists/components/list-active-filters.tsx  новий
features/lists/components/list-stats-cards.tsx     новий
features/lists/components/list-sidebar.tsx         новий — контейнер правого бара
features/lists/components/list-currently-reading-card.tsx  новий
features/lists/components/list-about-card.tsx      новий
features/lists/components/list-related-card.tsx    новий
features/lists/components/list-book-row.tsx        новий — режим списку
features/lists/components/list-bulk-bar.tsx        новий
features/lists/components/list-book-card.tsx       слоти, CTA-мапа, drag handle
features/lists/components/list-details-header.tsx  колаж, прибрати дублювання кількості книг
apps/web/src/messages/{uk,en}.json                 ключі
```

# 13. Тести

`frontend-test-engineer`, Vitest + RTL, мок на межі `fetch` (не мокати RQ-хуки).

- Таби: клік по `Прочитані` ставить `tab=finished` і чистить `status`; вибір статусів у панелі
  повертає `tab=all`.
- Лічильники табів рендеряться з `statusCounts`, а не рахуються з завантажених книг.
- Статкартки: граничні підписи (`0`, `всі`) для карток 2–4; при `totalBooks === 0` картки не рендеряться.
- `Про добірку`: уточнення про сторінки з'являється лише при `pagesKnownCount < totalBooks`.
- `Зараз читаються`: блок відсутній при `currentlyReading === null`; `Ще N книг` лише при `othersCount > 0`.
- `Спільні книги`: блок відсутній при порожньому масиві; `Показати всі` розгортає в межах блока.
- `canReorder`: drag handle зникає при активному пошуку / фільтрі / сортуванні ≠ `position`.
- Масовий вибір: скидається при зміні фільтра; `Вибрати все` бере лише завантажені.
- Порожній відфільтрований стан показує `Скинути фільтри`, а не `Очистити пошук`.

# Гейти

```bash
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm knip
```

Жива перевірка — у запущеному застосунку (`pnpm dev:web:dev`), обидві теми, обидві локалі.
Storybook для приймання не використовується.
