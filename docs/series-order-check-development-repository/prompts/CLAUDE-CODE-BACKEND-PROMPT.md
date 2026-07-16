# Готовий промпт для Claude Code — Backend

Скопіюй текст нижче в Claude Code разом із цим ZIP-пакетом.

---

Проаналізуй репозиторій і реалізуй на backend повний функціонал **«Перевірити порядок серій» у Черзі читання**.

## Документація

Спочатку прочитай файли в такому порядку:

1. `00-README.md`
2. `shared/01-product-goal-and-boundaries.md`
3. `shared/02-domain-terms-and-status-rules.md`
4. `shared/03-problem-types.md`
5. `shared/04-detection-grouping-and-ranking.md`
6. `shared/05-edge-cases.md`
7. `shared/06-full-functional-scope.md`
8. `backend/01-backend-audit.md`
9. `backend/02-backend-api-contract.md`
10. `backend/03-backend-fix-operations.md`
11. `backend/04-backend-ignore-disable-concurrency.md`
12. `backend/05-backend-tests-and-acceptance.md`

## Обов’язковий порядок роботи

### 1. Read-only аудит

Перед будь-якими змінами досліди актуальний код:

- моделі Series, Book, Reading Queue, Reading Status, Ownership;
- фактичне поле й helper канонічного порядку серії;
- queuePosition і поточні reorder/insert operations;
- queue limit;
- transaction wrapper;
- optimistic concurrency/version;
- існуючі nextBook/series progress helpers;
- user preferences/ignore infrastructure;
- поточні view models і validation schemas.

Створи файл:

```text
docs/series-order-check/backend-audit.md
```

Використай структуру з `backend/01-backend-audit.md`.

### 2. Реалізація

Реалізуй увесь обсяг із `shared/06-full-functional-scope.md`, а не скорочену версію.

Backend має:

- знаходити всі описані типи проблем;
- повертати одну агреговану проблему на серію;
- стабільно визначати severity і ranking;
- враховувати active reading як умовну позицію перед чергою;
- використовувати канонічний series comparator;
- повертати current і recommended order;
- формувати server-side preview;
- атомарно застосовувати add-one, add-all і reorder-series-slots;
- не рухати сторонні книги при slot reorder;
- захищатися від stale state;
- підтримувати ignore fingerprint;
- підтримувати disable/re-enable перевірки per user and series;
- перевикористати наявні ownership flows;
- забезпечити user isolation;
- уникнути N+1;
- додати unit та integration/e2e tests.

## Критичні обмеження

- `queuePriority` не впливає на позицію черги. Не створюй problem type, ranking або fix, пов’язані з пріоритетом.
- Не додавай фронтенд-код.
- Не дублюй наявний helper порядку серії або queue reorder service.
- Не використовуй `createdAt`, `updatedAt`, алфавіт чи queue insertion date як канонічний порядок.
- Не приймай готовий масив нових позицій від frontend як джерело істини: server має повторно обчислювати preview/apply.
- Не змінюй reading status або ownership приховано.
- Не створюй partial changes: усі queue fixes транзакційні.
- Не роби масштабний рефакторинг не пов’язаних модулів.

## API

Адаптуй рекомендований контракт із `backend/02-backend-api-contract.md` до чинної архітектури. Якщо в проєкті вже є відповідні маршрути або naming conventions, використовуй їх.

Обов’язково потрібні можливості:

- list issues із `limit`;
- preview fix;
- apply fix із expected queue version;
- ignore конкретного fingerprint;
- disable/re-enable series check.

## Тести та завершення

Після реалізації:

1. Запусти typecheck/lint/tests, доступні в репозиторії.
2. Виправ помилки, які спричинені твоїми змінами.
3. Перевір усі acceptance criteria з `backend/05-backend-tests-and-acceptance.md`.
4. Створи підсумковий файл:

```text
docs/series-order-check/backend-implementation-report.md
```

У ньому вкажи:

- що реалізовано;
- які endpoint-и створено/перевикористано;
- які міграції додано;
- як працює DNF;
- як працює optimistic concurrency;
- які тести додано;
- які відомі обмеження залишилися.

Не зупиняйся після аудиту: виконай реалізацію повністю в межах backend.
