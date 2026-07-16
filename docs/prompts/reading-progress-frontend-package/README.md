# Reading Progress — пакет документації для Claude Code

Цей пакет розбиває велику специфікацію функціоналу **«Прогрес читання»** на невеликі логічні файли.

## Головна зміна розміщення

Поточний блок прогресу знаходиться у правому сайдбарі сторінки деталей книги. Після реалізації він має бути перенесений у **головну контентну колонку** і розташований **безпосередньо під блоком «Про книгу»**.

Правий сайдбар більше не є цільовим місцем для цього блока.

## Порядок роботи агента

1. Прочитати `CLAUDE.md`.
2. Провести аудит готовності бекенду за `docs/02-backend-readiness-audit.md`.
3. Зіставити реальний generated API client із `docs/03-api-contract.md`.
4. Якщо критичних блокерів немає — одразу перейти до frontend-реалізації.
5. Не додавати бізнес-розрахунки на фронтенд і не змінювати бекенд у межах цієї задачі.
6. Наприкінці надати звіт за `docs/12-agent-deliverables.md`.

## Структура пакета

- `CLAUDE.md` — головна інструкція для агента;
- `docs/01-scope-and-placement.md` — межі задачі та розміщення блока;
- `docs/02-backend-readiness-audit.md` — обов’язковий аудит бекенду;
- `docs/03-api-contract.md` — очікуваний API-контракт;
- `docs/04-frontend-architecture-and-data-flow.md` — компоненти, query state, cache та invalidation;
- `docs/05-progress-block.md` — компактний блок у головній частині сторінки;
- `docs/06-full-reading-history-tab.md` — підтаба повної історії;
- `docs/07-statuses-and-ui-states.md` — правила статусів, loading/error/empty/partial states;
- `docs/08-style-responsive-accessibility.md` — дизайн, адаптивність та accessibility;
- `docs/09-localization.md` — i18n і форматування;
- `docs/10-test-plan.md` — тести;
- `docs/11-acceptance-criteria.md` — критерії завершення;
- `docs/12-agent-deliverables.md` — формат фінального звіту;
- `templates/backend-readiness-report.md` — шаблон звіту про готовність бекенду;
- `docs/13-requirements-map.md` — карта покриття вихідної документації.
