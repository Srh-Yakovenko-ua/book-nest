# Перевірка порядку серій у Черзі читання — пакет для розробки

Цей ZIP є невеликим документаційним репозиторієм для повної реалізації блока **«Перевірити порядок серій»**.

## Враховані зміни

- `queuePriority` не впливає на фактичну позицію книги та повністю виключений із логіки пошуку й виправлення конфліктів.
- Не додається логіка типів серій або книг, яких ще немає в поточній моделі продукту.
- Увесь описаний функціонал є обов’язковим обсягом реалізації; скороченого етапу немає.
- Backend є джерелом істини для detection, grouping, severity, preview і apply.
- Frontend показує готовий результат та не дублює алгоритм порядку серій.

## Структура

```text
series-order-check-development-repository/
├── 00-README.md
├── MANIFEST.md
├── shared/
│   ├── 01-product-goal-and-boundaries.md
│   ├── 02-domain-terms-and-status-rules.md
│   ├── 03-problem-types.md
│   ├── 04-detection-grouping-and-ranking.md
│   ├── 05-edge-cases.md
│   └── 06-full-functional-scope.md
├── backend/
│   ├── 01-backend-audit.md
│   ├── 02-backend-api-contract.md
│   ├── 03-backend-fix-operations.md
│   ├── 04-backend-ignore-disable-concurrency.md
│   └── 05-backend-tests-and-acceptance.md
├── frontend/
│   ├── 01-frontend-block-and-cards.md
│   ├── 02-frontend-fix-flows-and-modals.md
│   ├── 03-frontend-states-i18n-a11y.md
│   └── 04-frontend-tests-and-acceptance.md
└── prompts/
    ├── CLAUDE-CODE-BACKEND-PROMPT.md
    └── CLAUDE-CODE-FRONTEND-PROMPT.md
```

## Як передавати завдання

### Backend Claude Code

Передай агенту весь ZIP і текст із:

```text
prompts/CLAUDE-CODE-BACKEND-PROMPT.md
```

Агент спочатку проводить read-only аудит, а потім реалізує backend повністю.

### Frontend Claude Code

Після завершення backend передай frontend-агенту весь ZIP і текст із:

```text
prompts/CLAUDE-CODE-FRONTEND-PROMPT.md
```

Frontend-агент спочатку перевіряє фактично реалізований backend. Якщо чогось не вистачає, він створює окремий файл з backend gaps і не пише backend-код у frontend-репозиторії.

## Розподіл відповідальності

```text
Backend:
виявляє конфлікт → групує по серії → визначає severity → формує preview → атомарно застосовує fix.

Frontend:
показує issue → пояснює зміни → отримує підтвердження → викликає backend → оновлює UI.
```
