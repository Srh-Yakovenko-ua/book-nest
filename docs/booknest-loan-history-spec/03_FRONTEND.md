# Frontend specification — «Історія позик»

## 1. Route

Додати окрему сторінку в current Next.js locale routing.

Семантика:
`/loans/history`

Але якщо актуальний refactor використовує іншу route hierarchy — дотримуйся її, не роби unnecessary route migration.

---

## 2. Feature structure

Максимально перевикористати `features/loans`.

Не створювати окремий disconnected feature, якщо loans уже має:
- API hooks;
- query state;
- shared cards;
- toolbars;
- empty states;
- sidebar patterns.

Можливе розширення:

```text
features/loans/
  api/
    use-loan-history.ts
    use-loan-history-overview.ts
    use-loan-history-detail.ts

  components/
    history/
      loan-history-view.tsx
      loan-history-summary-cards.tsx
      loan-history-toolbar.tsx
      loan-history-list.tsx
      loan-history-row.tsx
      loan-history-sidebar.tsx
      loan-history-detail-drawer.tsx

  model/
    use-loan-history-query-state.ts
```

Назви адаптувати до project conventions.

---

## 3. Navigation

Під існуючою групою «Позичені книги»:

- Треба повернути
- Передано іншим
- Історія позик

Active state — за route.

Для history не потрібно count badge у sidebar.

---

## 4. Data fetching

Окремі query keys для:
- history list;
- history overview;
- history detail;
- history people, якщо endpoint потрібен.

Query keys повинні включати відповідні params.

Після return mutation:
invalidate:
- active loans;
- active summaries/overviews;
- history list;
- history overview.

Після history correction:
invalidate:
- history list;
- history overview;
- history detail.

---

## 5. URL state

Search/filter/sort/page тримати в URL за поточним loans pattern.

Параметри:
- type
- result
- person
- from
- to
- sort
- pageNumber
- search

При зміні filter/search:
- reset pageNumber -> 1.

Invalid params:
- safe fallback до defaults.

---

## 6. Page layout

### Desktop

1. Header.
2. 4 stat cards.
3. Search + filters.
4. Sort + result count.
5. Main 2-column layout:
   - history list;
   - analytics sidebar.

Не дублювати sidebar data з list page.

---

## 7. Summary cards

Перевикористати чинний reusable stat-card component.

Картки:
- Усього завершено
- Повернуто вчасно
- Із запізненням
- Середня тривалість

Неклікабельні.

Icons:
- вибрати existing `UiIcon` за семантикою;
- не додавати SVG, якщо registry уже має відповідну іконку.

---

## 8. Toolbar

Desktop:
- search field;
- direction select;
- result select;
- person select/autocomplete;
- period select;
- sort.

Не показувати active-loan filters:
- overdue;
- return soon;
- reminder;
- no return date як active problem filter.

У history `no_due_date` — це **result завершеної позики**, не current attention state.

---

## 9. Period picker

Presets:
- За весь час
- Цього року
- Минулого року
- Власний діапазон

Frontend converts preset -> `returnedFrom` / `returnedTo`.

Для custom:
- reuse current date range component/pattern;
- не invent a new date picker if one exists.

---

## 10. History row

Створити окремий history presentation component.

Не показувати:
- «Повернути книгу»;
- «Мені повернули»;
- reminder bell;
- +7/+14 quick actions;
- active overdue chip поруч із historical result.

### Header

- cover
- title
- author
- direction badge
- personName
- menu

### Timeline

Desktop — horizontal, якщо поміщається.

Mobile — vertical.

### Result

Success / warning / neutral.

---

## 11. Click behavior

History row click:
open detail drawer.

Cover/title:
link to book.

Menu:
- Деталі
- Перейти до книги
- Виправити дату повернення
- Редагувати нотатку

Не робити Delete default action.

---

## 12. Detail drawer

Reuse current drawer/sheet pattern.

### Sections

Book:
- cover
- title
- author

Loan:
- direction
- person
- contact

Timeline:
- loan/transfer date
- planned return
- actual return

Outcome:
- result
- delay
- duration

Note:
- text / empty state

---

## 13. History correction UI

### Виправити дату повернення

Невеликий dialog:
- date field;
- save/cancel.

Не показувати active loan editor.

### Редагувати нотатку

Reuse textarea/dialog pattern.

Після success:
- toast;
- close;
- invalidate.

---

## 14. Sidebar

### Найчастіше взаємодієте

До 5 людей.

Row click:
set person filter + reset page.

### Тривалість позик

Read-only metrics.

### Надійність повернень

Read-only percentage + counts.

Не додавати static tip card.

---

## 15. Empty state behavior

### Overall empty

Не render:
- summary cards;
- filters-heavy dashboard;
- empty sidebar analytics.

Show meaningful page empty state.

### Filtered empty

Залишити toolbar + summary/analytics scope.

Show:
- message;
- clear filters.

---

## 16. Responsive

### Tablet

Якщо current app collapses right sidebar:
- використати той самий mechanism.

### Mobile

- header compact;
- summary cards 2x2 або current compact pattern;
- filter controls у current mobile toolbar/sheet;
- row timeline vertical;
- no horizontal overflow;
- analytics через existing overview/secondary panel pattern.

Не додавати bottom nav із reference image.

---

## 17. i18n

Namespace за current loans translation architecture.

UA copy:

```text
Історія позик
Усього завершено
Повернуто вчасно
Із запізненням
Середня тривалість
Позичено в інших
Передано іншим
Дата позики
Дата передачі
Планове повернення
Повернено
Без визначеного строку
Повернуто · строк не визначено
Найчастіше взаємодієте
Тривалість позик
Надійність повернень
```

EN — повний equivalent.

Pluralization через ICU/next-intl.

---

## 18. Formatting

Dates:
- reuse current locale-aware date formatter.

Relative dates тут не головні; history показує absolute dates.

Duration/delay:
- numeric + localized plural.

Percent:
- backend value, frontend presentation only.

---

## 19. Design constraints

- стиль BookNest: існуючі surfaces, radii, spacing, tones;
- не копіювати reference image pixel-perfect;
- не додавати нову color system;
- historical late = warning/amber, не active red emergency;
- typography hierarchy важливіша за декоративні елементи.

---

## 20. Accessibility / UX details

- title/cover links мають stop propagation від drawer click;
- menu не trigger drawer;
- keyboard support;
- filters мають visible labels / accessible names;
- status text visible, не тільки icon/color;
- drawer close/escape за current pattern.
