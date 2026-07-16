# Frontend: тести та acceptance criteria

## Component tests

Покрити:

- loading skeleton;
- load error і retry;
- empty state;
- count і максимум три cards;
- всі `problemType`;
- error/warning/info;
- long titles;
- відсутню обкладинку;
- current/recommended order;
- allowedActions;
- приховування недозволених дій;
- mobile layout;
- dark/light theme, якщо це підтримують наявні tests.

## Interaction tests

- open preview;
- cancel preview;
- confirm add one;
- confirm add all;
- confirm reorder slots;
- no mutation before confirmation;
- ignore issue;
- disable series confirmation;
- ownership actions;
- paused/open book flow;
- current reading ahead flow;
- success snackbar;
- query invalidation;
- focus return;
- keyboard navigation.

## Error tests

- `QUEUE_STALE`;
- `ISSUE_STALE`;
- `ALREADY_IN_QUEUE` + refetch;
- queue limit;
- 403;
- 404;
- generic mutation error;
- preview error without applying changes.

## i18n tests

- усі ключі існують українською й англійською;
- pluralization для кількості книг;
- довші англійські labels не ламають layout.

## Acceptance criteria

- [ ] Блок розміщений у Черзі читання.
- [ ] Показується максимум три issues у backend order.
- [ ] Загальний count відповідає API.
- [ ] Одна серія відображається однією карткою.
- [ ] Усі problem types мають зрозумілий текст.
- [ ] Severity відображається доступно.
- [ ] Current і recommended order показані коректно.
- [ ] Frontend не обчислює series conflict самостійно.
- [ ] `queuePriority` не використовується для detection або order UI.
- [ ] Multi-item changes завжди мають preview.
- [ ] Queue mutation не відправляється до підтвердження.
- [ ] Після success оновлюються queue та issues без reload.
- [ ] `409` обробляється через refetch і зрозуміле повідомлення.
- [ ] Ignore приховує лише поточний fingerprint.
- [ ] Disable series має confirmation і може бути скасоване в series settings.
- [ ] Реалізовано loading/error/empty/success states.
- [ ] Усі тексти винесено в i18n.
- [ ] Використані наявні theme tokens, компоненти та Lucide icons.
- [ ] Реалізовано keyboard і focus management.
- [ ] Додано component/integration tests.
- [ ] Старі queue interactions не зламані.
