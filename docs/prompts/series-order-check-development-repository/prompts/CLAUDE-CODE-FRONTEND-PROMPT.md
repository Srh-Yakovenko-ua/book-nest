# Готовий промпт для Claude Code — Frontend

Скопіюй текст нижче в Claude Code разом із цим ZIP-пакетом після того, як backend уже реалізував свою частину.

---

Проаналізуй frontend-репозиторій і фактично реалізований backend API, після чого реалізуй повний UI-функціонал **«Перевірити порядок серій» на сторінці Черги читання**.

## Документація

Прочитай файли в такому порядку:

1. `00-README.md`
2. `shared/01-product-goal-and-boundaries.md`
3. `shared/02-domain-terms-and-status-rules.md`
4. `shared/03-problem-types.md`
5. `shared/04-detection-grouping-and-ranking.md`
6. `shared/05-edge-cases.md`
7. `shared/06-full-functional-scope.md`
8. `backend/02-backend-api-contract.md`
9. `frontend/01-frontend-block-and-cards.md`
10. `frontend/02-frontend-fix-flows-and-modals.md`
11. `frontend/03-frontend-states-i18n-a11y.md`
12. `frontend/04-frontend-tests-and-acceptance.md`

## 1. Спочатку перевір фактичний backend

Знайди й задокументуй:

- endpoint отримання issues;
- фактичний response contract;
- problem types і severity;
- queue version/optimistic concurrency;
- preview endpoint;
- apply endpoint;
- ignore endpoint;
- disable/re-enable endpoint;
- ownership mutations/routes;
- чинні enum-и reading status та ownership.

Не припускай, що назви маршрутів дослівно збігаються з документацією.

Якщо чогось не вистачає, не реалізовуй backend у frontend-репозиторії. Створи:

```text
docs/series-order-check/backend-gaps-for-frontend.md
```

Для кожного gap вкажи:

- чого саме немає;
- який UI flow це блокує;
- який очікуваний request/response потрібен;
- які частини frontend можна реалізувати без цього.

Після цього реалізуй максимально повну частину, яку підтримує фактичний backend.

## 2. Реалізуй повний frontend scope

Потрібно:

- додати sidebar-блок на сторінку Черги читання;
- показувати максимум 3 issues та загальний count;
- реалізувати доступний перегляд усіх issues;
- відображати одну картку на серію;
- підтримати всі problem types із backend;
- показувати severity, пояснення, current order та recommended order;
- показувати лише дозволені backend actions;
- реалізувати preview modal для add-one, add-all і reorder;
- не виконувати queue mutation без підтвердження;
- реалізувати ignore поточного fingerprint;
- реалізувати disable series із confirmation;
- додати toggle повторного ввімкнення у відповідне налаштування серії;
- перевикористати чинні flows книги, покупки, замовлення й позики;
- реалізувати loading, error, empty та success states;
- обробити stale queue/issue, duplicate, limit, 403 і 404;
- інвалідовувати всі релевантні React Query query keys;
- не робити full page reload;
- додати i18n українською та англійською;
- додати keyboard/focus accessibility;
- додати frontend tests.

## Критичні обмеження

- Не обчислюй конфлікти, severity, ranking або recommended order на frontend.
- Не використовуй `queuePriority` для визначення або відображення проблем порядку: воно не впливає на позицію книги.
- Не створюй нову бібліотеку компонентів або нову палітру.
- Використай чинні theme tokens, sidebar/card/modal/button/chip/tooltip компоненти.
- Для іконок використай Lucide, який уже застосовується в проєкті; не додавай іншу icon library.
- Не змінюй reading status або ownership без чинної mutation і явної дії користувача.
- Не роби optimistic reorder на основі власного алгоритму. Preview і результат мають приходити з backend.
- Не реалізовуй backend у frontend-репозиторії.

## UX після успіху

Після fix:

- закрий модалку;
- покажи snackbar `Порядок серії виправлено`;
- онови queue, positions, counts, issues та current reading, якщо релевантно;
- поверни focus на змінену книгу або success live region.

## Завершення

1. Запусти typecheck/lint/tests, доступні в репозиторії.
2. Виправ помилки, спричинені змінами.
3. Перевір acceptance criteria з `frontend/04-frontend-tests-and-acceptance.md`.
4. Створи:

```text
docs/series-order-check/frontend-implementation-report.md
```

Вкажи:

- реалізовані компоненти та flows;
- використані endpoint-и й query keys;
- invalidation після кожної mutation;
- додані i18n keys;
- додані tests;
- backend gaps або відомі обмеження.

Не обмежуй реалізацію коротким MVP: завдання охоплює весь функціонал, описаний у пакеті.
