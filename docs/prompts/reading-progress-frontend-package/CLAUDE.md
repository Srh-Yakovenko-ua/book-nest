# Завдання для Claude Code: Reading Progress

## Мета

Перевірити, що бекенд повністю готовий для функціоналу історії прогресу читання, а потім реалізувати frontend:

1. Оновлений блок **«Прогрес читання»** на сторінці деталей книги.
2. Підтабу **«Повна історія читання»**.
3. Реальні API-запити, range/sort/pagination, loading/error/empty/partial-data стани, локалізацію, адаптивність, accessibility і тести.

## Критична зміна layout

Поточний `reading-progress-block.tsx` знаходиться у правому сайдбарі.

Потрібно:

- прибрати його з правого сайдбара;
- розмістити в основній контентній частині сторінки деталей книги;
- поставити **відразу під блоком «Про книгу»**;
- зберегти нормальний порядок секцій на desktop, tablet і mobile;
- не дублювати блок одночасно у двох місцях.

## Обов’язковий workflow

### Фаза 1 — аналіз проєкту

Перед кодом знайти:

- структуру сторінки деталей книги;
- місце, де зараз рендериться блок у sidebar;
- блок «Про книгу» та контейнер основної колонки;
- механізм головних табів і підтабів;
- `apps/web/src/features/books/components/reading-progress-block.tsx` або його актуальний шлях;
- generated hook для `GET /api/books/:id/reading-history`;
- реальні DTO і query-параметри;
- mutation для оновлення прогресу та зміни статусу;
- React Query conventions, query keys та invalidation;
- chart library;
- наявні Card, Tabs, Select, Accordion/Collapse, Pagination, Skeleton, Alert, Tooltip, Empty State;
- i18n, date/number helpers, responsive conventions і test stack.

### Фаза 2 — аудит бекенду

Виконати всі перевірки з `docs/02-backend-readiness-audit.md`.

Створити короткий звіт за шаблоном `templates/backend-readiness-report.md`.

Рішення після аудиту:

- **Ready:** одразу реалізувати весь frontend.
- **Ready with naming differences:** адаптуватися до generated client і задокументувати mapping.
- **Minor optional gaps:** реалізувати коректні fallback/partial states без frontend-агрегацій.
- **Critical gap:** не вигадувати дані й не реалізовувати backend. Зафіксувати блокер у звіті та продовжити всі frontend-частини, які можна реалізувати без порушення контракту.

## Незмінні технічні правила

- Backend response — єдине джерело істини для summary, activity і history.
- Не групувати raw events за днями на фронтенді.
- Не рахувати pagesRead, progressPercent, pagesRemaining, average, bestDay, forecast, reading duration або completeness.
- Не заповнювати пропущені календарні дні на фронтенді.
- Не дублювати backend DTO вручну, якщо є generated/shared types.
- Не робити окремі API-запити для summary, chart і history.
- Не додавати нову chart-залежність, якщо в проєкті вже є придатна.
- Не змінювати backend у межах цієї задачі.
- Не завершувати роботу статичним макетом.
- Не створювати монолітний компонент.

## Порядок читання документації

1. `docs/01-scope-and-placement.md`
2. `docs/02-backend-readiness-audit.md`
3. `docs/03-api-contract.md`
4. `docs/04-frontend-architecture-and-data-flow.md`
5. `docs/05-progress-block.md`
6. `docs/06-full-reading-history-tab.md`
7. `docs/07-statuses-and-ui-states.md`
8. `docs/08-style-responsive-accessibility.md`
9. `docs/09-localization.md`
10. `docs/10-test-plan.md`
11. `docs/11-acceptance-criteria.md`
12. `docs/12-agent-deliverables.md`

## Очікуваний результат

Повна функціональна frontend-реалізація з реальним generated API client, query parameters, server-side pagination, коректним cache/invalidation, локалізацією, адаптивністю, accessibility і тестами.
