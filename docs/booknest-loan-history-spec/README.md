# BookNest — «Історія позик»

Цей пакет — готова документація-промпт для Claude Code на реалізацію повноцінної сторінки **«Історія позик»** у домені позичених книг.

## Що має бути результатом

У групі навігації **«Позичені книги»** мають бути три окремі робочі сторінки:

1. **Треба повернути** — активні `borrowed_from_someone`.
2. **Передано іншим** — активні `lent_to_someone`.
3. **Історія позик** — усі завершені позики обох напрямків.

«Історія позик» — не таб активної сторінки, а окремий route і окрема повноцінна сторінка.

## Ключова продуктова логіка

Запис автоматично потрапляє в історію після існуючої дії повернення:

`active loan -> return action -> status = returned + returnedAt -> history`

Не створювати ручну дію «Перенести в історію».

## Важлива вимога перед початком

Перед змінами Claude Code повинен:

1. Прочитати `CLAUDE.md` та актуальні архітектурні правила репозиторію.
2. Перевірити **поточний working tree**, `git status` і вже реалізовані зміни в loans.
3. Не відкочувати та не ламати новіші рефактори:
   - поділ на «Треба повернути» / «Передано іншим»;
   - нові stat cards;
   - sidebar blocks;
   - оновлене сортування;
   - Quick Actions;
   - reminder lifecycle (`remindBeforeDays`, `nextReminderAt`), якщо він уже є локально.
4. Вважати поточний working tree джерелом істини. Публічний `dev` може бути позаду локальних змін.

## Поточна база, яку треба перевикористати

У наявній моделі `BookLoan` вже є суттєва основа для історії:
- `type`;
- `personName`;
- `contact`;
- `loanDate`;
- `expectedReturnDate`;
- `note`;
- `status`;
- `returnedAt`.

Поточний return flow уже завершує активну позику через `status = "returned"` і записує `returnedAt`.

**Не створювати окрему таблицю `LoanHistory`.** Історія — це read-model над завершеними `BookLoan`.

## Обсяг цієї задачі

Реалізувати:

- backend read API для історії;
- shared Zod contracts/types;
- окрему frontend route/page;
- навігацію;
- 4 stat cards;
- пошук;
- фільтри;
- сортування;
- пагінацію;
- історичні картки/рядки з timeline;
- аналітичний правий sidebar;
- detail drawer;
- обмежене виправлення історичного запису;
- desktop/tablet/mobile адаптацію;
- `uk` та `en` локалізації;
- тести.

Не реалізовувати в цій задачі:

- `LoanContact` як нову нормалізовану сутність;
- окрему сторінку людини;
- QR / паспорт позики;
- фото стану книги;
- журнал усіх попередніх змін `expectedReturnDate`;
- автоматичні SMS/email людині;
- нову систему notifications;
- новий bottom navigation.

## Файли в пакеті

- `00_CLAUDE_TASK.md` — головний промпт для Claude Code.
- `01_PRODUCT_UX.md` — продуктова логіка та UX.
- `02_BACKEND_API.md` — backend, contracts, API, calculations.
- `03_FRONTEND.md` — frontend структура та responsive.
- `04_TESTS_ACCEPTANCE.md` — тести та acceptance criteria.
- `05_IMPLEMENTATION_PLAN.md` — порядок реалізації.
- `reference/history-loans-mockup.png` — ескіз як візуальний орієнтир, **не pixel-perfect специфікація**.
