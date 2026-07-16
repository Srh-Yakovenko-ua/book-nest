# Dev-фікстури: усі 10 типів конфліктів порядку серій

Залито в базу 2026-07-16 на прохання власника акаунта. **Навмисно не відкочується** — це постійний dev-майданчик для перевірки блока «Перевірити порядок серій». `GET /api/reading-queue/series-order-issues?limit=50` → `total: 10`.

Одна серія дає рівно одну картку (backend бере найпріоритетніший конфлікт), тому кожен тип живе у своїй серії. Порядок нижче — той, у якому backend їх віддає; він збігається з `PROBLEM_TYPE_PRIORITY` у `apps/api/src/modules/series-order-check/domain/series-order-detection.ts`.

| #   | Серія                      | Severity | problemType                      | Як зроблено                                                          |
| --- | -------------------------- | -------- | -------------------------------- | -------------------------------------------------------------------- |
| 1   | Трон зі скла               | error    | `current_reading_ahead_of_order` | ч.2 → `readingStatus: reading`, ч.1 поза чергою                      |
| 2   | Двір шипів і троянд        | error    | `previous_book_after_later_book` | ч.1 і ч.2 у черзі, ч.2 **перед** ч.1                                 |
| 3   | Родина Роялів              | error    | `multiple_books_out_of_order`    | ч.1–3 у черзі в порядку 3 → 2 → 1                                    |
| 4   | Непристойно багаті вампіри | warning  | `multiple_previous_missing`      | ч.3 у черзі; ч.1 і ч.2 → `owned`, поза чергою                        |
| 5   | Гавань Мрій                | warning  | `missing_previous_from_queue`    | ч.2 у черзі; ч.1 → `owned`, поза чергою                              |
| 6   | Мейпл-Гіллз                | info     | `previous_book_paused`           | ч.2 у черзі; ч.1 → `readingStatus: paused`                           |
| 7   | Девід Гантер               | warning  | `previous_book_want_to_buy`      | ч.2 у черзі; ч.1 уже був `want_to_buy`                               |
| 8   | Імперія Віндзорів          | warning  | `previous_book_not_owned`        | ч.2 у черзі; ч.1 уже був `none`                                      |
| 9   | Лайтларк                   | warning  | `previous_book_in_transit`       | ч.2 у черзі; ч.1 → `in_transit` + deliveryInfo (Yakaboo, 2026-07-10) |
| 10  | Френдзона                  | warning  | `previous_book_lent_out`         | ч.2 у черзі; ч.1 → `lent_to_someone` + loanInfo (Олена, 2026-07-01)  |

Черга виросла з 9 до 21 книги (додано 12).

## Правила детекції, з яких це виведено

`resolveProblemType` (`series-order-detection.ts:388`) перевіряє по черзі:

1. affected книга `reading`/`rereading` → `current_reading_ahead_of_order`
2. інакше previous **у черзі** (позиція не null) → `previous_book_after_later_book`
3. інакше previous `paused` → `previous_book_paused`
4. інакше — за ownership previous: `owned`/`borrowed_from_someone` → `multiple_previous_missing` (якщо ≥2 відсутніх) або `missing_previous_from_queue`; `in_transit` / `lent_to_someone` / `none` / `want_to_buy` → відповідний тип

`multiple_books_out_of_order` (`collapseOutOfOrder`) вимагає **≥3** книг серії в черзі (не `finished`/`dnf`), чий порядок не є строго зростаючим за `partNumber`; він поглинає `previous_book_after_later_book` у тій же серії.

Книга рахується «в грі» (`isInPlay`), якщо вона в черзі **або** читається. Previous ігнорується, якщо `finished`/`dnf` (`CLOSED_READING_STATUSES`).

Порядок частин у книзі — поле **`partNumber`**, а не `seriesPosition` (останнє існує лише у view-моделі series-order-check).

## Як прибрати, якщо колись знадобиться

Загального відкату немає — треба прибрати з черги 12 доданих книг, повернути ownership ч.1 у «Непристойно багаті вампіри», «Гавань Мрій», «Лайтларк», «Френдзона», та скинути `readingStatus` у «Трон зі скла» ч.2 і «Мейпл-Гіллз» ч.1.
