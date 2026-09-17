# BookNest — Refactor вибору книги в «Додати цитату»

Потрібно переробити вибір книги в модалці `Додати цитату` на сторінці Quotes.

Поточний Quotes `BookPicker` має проблеми: selected book і search query змішані в одному state, після вибору title книги стає search query, selected book може скидатися під час search, а список фактично обмежений першою сторінкою книг.

Не латати поточний combobox. Реалізувати reusable single-select picker для книги на основі існуючих BookNest patterns.

## 1. Базовий підхід

Створити reusable single-select picker на рівні Books feature, концептуально:

```text
features/books/components/book-single-select-picker.tsx
```

Точний naming адаптуй до conventions проекту.

За основу взяти:

- single-select UX із Dedications;
- `RadioGroup` / selectable book rows;
- automatic infinite scroll із Series;
- existing `useLibraryBooks`;
- existing `BookThumb`, cover fallback та book presentation primitives.

Не імпортувати Dedications component напряму в Quotes.
Не копіювати `DedicationBookPickerDialog`.
Не використовувати multi-select Checkbox semantics.

## 2. Data fetching

Використати existing:

```ts
useLibraryBooks(...)
```

Новий backend endpoint не потрібен.

Параметри:

- explicit `title_asc` або current canonical equivalent;
- debounced backend search;
- `pageSize` приблизно 20–24;
- без `useSoloBooks`;
- усі книги бібліотеки, допустимі для створення цитати.

Не завантажувати всю library одним request.

## 3. Search і selected book

Search і selected book мають бути незалежними state:

```ts
searchQuery;
selectedBook;
```

Правила:

- вибір книги не записує title у search query;
- search не скидає selected book автоматично;
- очищення search не очищує selected book;
- form зберігає canonical `bookId`.

## 4. UX до вибору

Замість маленького Popover/combobox показати inline picker усередині `QuoteDialog`:

```text
Книга *

[ Пошук за назвою або автором ]

┌───────────────────────────────┐
│ ○ [cover] 1984               │
│           Джордж Орвелл       │
│                               │
│ ○ [cover] Академія...        │
│           Стелла Так          │
│                               │
│ ○ [cover] Аркан вовків       │
│           Павло Дерев'янко    │
└───────────────────────────────┘
```

Результати:

- scrollable;
- cover + title + author;
- single-select;
- selected row clearly marked.

Не відкривати nested modal поверх QuoteDialog.

## 5. UX після вибору

Після вибору книги picker згортається у compact selected state:

```text
Книга *

┌────────────────────────────────┐
│ [cover] Аркан вовків           │
│         Павло Дерев'янко       │
│                      Змінити   │
└────────────────────────────────┘
```

`Змінити`:

- повертає search/list picker;
- не очищує поточну книгу одразу;
- current selected book лишається selected, доки user не вибере іншу.

## 6. Infinite scroll

Reuse existing `useInfiniteScroll` pattern із Series:

```text
initial page
→ scroll near bottom
→ fetchNextPage()
→ append results
```

Не використовувати `Завантажити ще` як основний UX.

При зміні search query pagination має коректно reset-итися, а results попереднього search не змішуються з новими.

## 7. Search behavior

Search:

- debounced;
- backend-driven;
- працює по всій library, а не лише по вже завантажених книгах;
- використовує existing Books API semantics для title/author.

При пустому search:

- показувати library у `title_asc`.

No results:

- compact state `Книг не знайдено`.

## 8. QuoteDialog integration

Create mode:

- book required;
- submit відправляє правильний `bookId`.

Edit mode:

- current book preselected;
- спочатку compact selected state;
- `Змінити` відкриває picker;
- current book selected у results.

Перевір поточний `QuoteBookPreview`.

Якщо новий selected state його дублює:

- прибрати дубль;
- або reuse `QuoteBookPreview` як selected state.

Не залишати два preview однієї книги.

## 9. Modal layout

Picker list:

- обмежена висота;
- власний scroll.

QuoteDialog:

- не виходить за viewport;
- footer залишається доступним;
- немає horizontal overflow;
- зберігається current responsive dialog pattern.

## 10. Не робити

Не:

- збільшувати `pageSize` до 1000;
- залишати старий cmdk/Popover і лише латати state;
- робити nested modal;
- створювати новий Books API;
- використовувати `useSoloBooks`;
- використовувати Checkbox/multi-select;
- робити local-only search;
- зберігати selected title як search query;
- створювати dependency Quotes → Dedications.

## Очікуваний результат

- current Quotes combobox більше не використовується;
- є reusable `BookSingleSelectPicker`;
- search і selected book state незалежні;
- вся library доступна через infinite scroll;
- search працює по backend library;
- books мають predictable `title_asc`;
- selection single-select;
- немає nested modal;
- після вибору picker згортається у compact state;
- `Змінити` повертає список;
- create/edit Quote правильно працюють із `bookId`;
- немає duplicate book preview;
- використані існуючі BookNest patterns і data source.
