# Implementation plan — рекомендований порядок

Claude Code має реалізовувати задачу послідовно, не одним великим хаотичним patch.

## Phase 0 — Inspect

1. `git status`.
2. Read `CLAUDE.md`.
3. Inspect current:
   - Prisma `BookLoan`;
   - return flow;
   - loans module;
   - shared loans contracts;
   - generated API client pattern;
   - current split loan pages/routes/sidebar;
   - query state;
   - stat-card component;
   - mobile overview/sidebar pattern;
   - `UiIcon`;
   - translations.
4. Зафіксувати, які з попередніх loans refactors уже є локально.
5. Не перезаписувати їх старою структурою.

---

## Phase 1 — Shared contracts

Додати:
- history result;
- history filter;
- history sort;
- history query;
- history list item;
- detail view;
- overview view;
- people option view, якщо потрібно.

Typecheck shared.

---

## Phase 2 — Backend domain

Додати pure helpers:
- returned calendar date normalization;
- history result;
- delayDays;
- durationDays.

Unit tests.

---

## Phase 3 — Backend repository

Реалізувати:
- completed history base scope;
- search;
- filters;
- period;
- sort;
- pagination;
- overview aggregates;
- top people;
- people options.

Не fetch-all.

Перевірити index.

---

## Phase 4 — Backend service/controller

Endpoints:
- history list;
- overview;
- detail;
- people, якщо потрібно;
- restricted correction.

OpenAPI DTOs.

Tests.

---

## Phase 5 — Generate API client

Запустити актуальну repo command:
`pnpm gen:api`

Не редагувати generated client вручну.

---

## Phase 6 — Frontend route/navigation

- third sidebar child;
- history route;
- active state;
- page shell.

Без детального UI спочатку перевірити navigation.

---

## Phase 7 — Query state/API hooks

- URL params;
- list query;
- overview query;
- people;
- detail;
- correction.

Query invalidation після return/correction.

---

## Phase 8 — Core page

Реалізувати:
- header;
- 4 stat cards;
- toolbar;
- list;
- pagination;
- empty/loading/error.

---

## Phase 9 — History row

Реалізувати:
- direction;
- person;
- timeline;
- result;
- duration;
- click behavior.

Desktop + mobile.

---

## Phase 10 — Sidebar analytics

- top people;
- duration;
- reliability.

На mobile — existing overview pattern.

---

## Phase 11 — Detail drawer / correction

- drawer;
- return-date correction;
- note correction;
- link to book.

Перевірити security та invalidation.

---

## Phase 12 — Localization

Повністю:
- uk;
- en;
- plurals;
- no gendered strings.

---

## Phase 13 — Verification

Запустити мінімум:
- targeted tests;
- `pnpm typecheck`;
- `pnpm lint`.

За можливості:
- `pnpm test`.

Перевірити browser manually:
- empty;
- mixed history;
- only borrowed;
- only lent;
- late;
- no due date;
- mobile.

---

# Не робити під час implementation

- Не створювати `LoanHistory` model.
- Не створювати `LoanContact`.
- Не переписувати всі loans routes.
- Не переносити business calculations на frontend.
- Не створювати новий design system.
- Не додавати bottom nav із mockup.
- Не додавати external messaging.
- Не робити history event sourcing due date changes.
- Не видаляти/міняти recent reminder work.
