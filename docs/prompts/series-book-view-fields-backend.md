# Промпт для бекендера: розширити `SeriesBookView`

## Контекст

На сторінці деталей серії вкладка «Книги серії» має перевикористовувати ту саму картку книги, що й сторінка всіх книг (`BookRow`), щоб зберегти візуальну консистентність.

`BookRow` приймає view-model `LibraryBook` (`apps/web/src/features/books/model/library-book.ts`), яку будує `toLibraryBook(book: BookView, labels)` — тобто вона розрахована на **`BookView`**.

Ендпоінт серії (`GET /api/series/:id`) віддає `SeriesBookView` — навмисно вужчу проєкцію. Через це вкладку зараз реалізовано в **урізаному** вигляді: частина полів картки просто не рендериться, бо даних немає.

Задача: розширити проєкцію так, щоб картка в серії могла показувати той самий набір полів, що й на сторінці книг.

## Головне: міграція НЕ потрібна

Усі потрібні поля **вже існують** у `model Book` (`apps/api/prisma/schema.prisma:193`):

| Поле                        | Рядок у schema.prisma | Тип                                |
| --------------------------- | --------------------- | ---------------------------------- |
| `genres`                    | 200                   | `String[] @default([])`            |
| `formats`                   | 201                   | `String[] @default([])`            |
| `ageCategory`               | 203                   | `String @default("not_specified")` |
| `publicationYear`           | 209                   | `Int?`                             |
| `publisherId` / `publisher` | 198 / 224             | `String?` / `Publisher?`           |
| `tags`                      | 227                   | `BookTag[]`                        |

Це **розширення проєкції, а не зміна схеми**. Ні `prisma migrate`, ні DDL не потрібні. Відповідно й пастка з raw-SQL індексами (CLAUDE.md §6) тут не спрацьовує.

## Чого бракує в `SeriesBookView`

`packages/shared/src/series.ts:98` (`SeriesBookViewSchema`) зараз має:
`authors`, `cover`, `createdAt`, `currentPage`, `id`, `isFavorite`, `originalTitle`, `ownershipStatus`, `pagesCount`, `partNumber`, `rating`, `readingStatus`, `title`.

Треба додати (форми брати з `BookViewSchema`, `packages/shared/src/books.ts:1082` — не вигадувати нові):

| Поле               | Форма в `BookViewSchema`                    | Навіщо на картці серії                                                                  |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `formats`          | `z.array(BookFormatSchema)`                 | Чип формату (Паперова / Електронна / Аудіо) — поле рівня книги, різниться в межах серії |
| `publicationYear`  | `z.number().nullable()`                     | Рік видання                                                                             |
| `ageCategory`      | `AgeCategorySchema`                         | Бейдж 18+                                                                               |
| `tags`             | `z.array(...)` → у FE мапиться в `tag.name` | Теги — показувати завжди, вони диференціюють книги в серії                              |
| `genres`           | `z.array(z.string())`                       | **Ключове** — див. нижче                                                                |
| `isInReadingQueue` | `z.boolean()`                               | Індикатор черги читання                                                                 |
| `publisher`        | `BookPublisherRefSchema.nullable()`         | Опційно — див. «Відкрите питання»                                                       |

## Чому `genres` — критичне, а не «ще одне поле»

ТЗ вимагає контекстної логіки: **жанр показувати в картці лише тоді, коли книги серії різножанрові**; за єдиного спільного жанру — ховати.

Ця перевірка потребує жанрів **кожної книги окремо**. У `SeriesView` є поле `genres` (`packages/shared/src/series.ts:87`), але це **агрегат рівня серії** — з нього неможливо вивести, чи книги різняться між собою. Тобто без `genres` на `SeriesBookView` логіка нездійсненна в принципі, і зараз вона у фронті **не реалізована** (не заглушена, не підроблена — саме відсутня).

## Окремо: `isInReadingQueue` і `formats`

Обидва поля були обов'язковими на `LibraryBook`. Оскільки в payload серії їх немає, захардкодити `isInReadingQueue: false` означало б мовчки рендерити хибний стан («не в черзі» замість «невідомо»).

Тому обидва зроблено опційними (`library-book.ts:16,21`), а `BookRow` тепер рендерить індикатор черги лише за явного `inReadingQueue === true` і має гард `book.formats ?? []`. Відсутність = нічого не рендериться, замість хибного твердження.

Коли ці поля з'являться в `SeriesBookView` — опційність варто переглянути й повернути обов'язковість, бо тоді «невідомо» перестане бути легітимним станом.

## Розбіжність форми, яку варто врахувати

`BookView` віддає прогрес вкладеним об'єктом:

```ts
readingProgress: ReadingProgressViewSchema.nullable(); // { currentPage, rating, ... }
```

а `SeriesBookView` — **пласко**: `currentPage: number | null`, `rating: number | null` (див. `toSeriesBookView`, `apps/api/src/modules/series/domain/series.mapper.ts:79`).

Через це `toLibraryBook(book: BookView)` не можна викликати з `SeriesBookView` навіть після додавання решти полів. Два варіанти:

1. **Вирівняти `SeriesBookView` під `BookView`** (вкладений `readingProgress`) — тоді FE перевикористовує `toLibraryBook` як є, без другого мапера. Ціна: ламає наявних споживачів пласких `currentPage`/`rating`.
2. **Лишити пласку форму** — FE тримає окремий мапер `SeriesBookView → LibraryBook`. Ціна: два мапери, тобто два місця, де знання про картку дублюється.

Рекомендація — варіант 1, але це рішення власника бекенду: воно зачіпає наявний контракт, і його треба звіряти з іншими місцями, де `SeriesBookView` вже спожито.

## Відкрите питання: видавництво

ТЗ каже не повторювати видавництво в кожному рядку, а показати **один раз як атрибут серії** (у вкладці «Про серію» або в короткій інформації).

Проблема: поля `publisher` немає **ні в `SeriesBookView`, ні в `SeriesView`**. Тобто «видавництво серії» як концепт у моделі не існує — існує лише `Book.publisherId`.

Варіанти:

- Вивести на бекенді агрегат рівня серії (наприклад `publishers: BookPublisherRef[]` на `SeriesView`) — тоді FE покаже одне видавництво, коли воно єдине, і список, коли їх кілька. Це чесно відображає дані.
- Додати `publisher` на `SeriesBookView` і агрегувати у FE.
- Визнати, що припущення «в межах серії видавництво одне» не гарантоване моделлю, і уточнити вимогу.

Потрібне рішення продукту, а не тільки технічне.

## Де саме правити

1. `packages/shared/src/series.ts:98` — розширити `SeriesBookViewSchema`.
2. `apps/api/src/modules/series/domain/series.mapper.ts:79` — `toSeriesBookView` заповнює нові поля.
3. `apps/api/src/modules/series/infrastructure/series.repository.ts:50` — `seriesDetailsArgs.include.books.include` має підтягнути `tags` і `publisher` (решта — скалярні колонки Book, окремого `include` не потребують). **Перевірити, що це не породжує N+1**: `include` на вкладеному масиві книг Prisma резолвить одним запитом, але варто підтвердити на реальній серії.
4. Тести: сервіс-юніт + контролер-інтеграція через `createTestApp` (CLAUDE.md §6 крок 9).
5. `pnpm --filter @app/api generate:openapi`, далі `pnpm gen:api` в корені.
6. Після цього FE знімає урізаність: вмикає контекстну логіку жанру, чипи формату/року/віку/тегів.

## Архітектурні межі (CLAUDE.md §5)

- Prisma — лише в репозиторії, ніде більше.
- Мапер повертає ViewModel; репозиторій — model-рядки, ніколи ViewModel.
- DTO — Zod у `packages/shared`, єдине джерело правди для FE і BE.
- Без коментарів у коді, без `any`, без `!`.

## Definition of done

- `SeriesBookView` містить `formats`, `publicationYear`, `ageCategory`, `tags`, `genres`, `isInReadingQueue` (+ рішення щодо `publisher` і форми `readingProgress`).
- `GET /api/series/:id` реально їх віддає — з підтвердженням через `curl`, а не «має працювати».
- N+1 перевірено.
- Гейти зелені: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm knip`.
