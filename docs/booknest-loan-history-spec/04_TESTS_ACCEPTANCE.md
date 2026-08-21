# Tests and Acceptance Criteria — Loan History

## 1. Domain calculations

### On time

Given:
- expected = 2026-08-10
- returnedDate = 2026-08-10

Expect:
- result = `on_time`
- delayDays = null

### Early

Expected 2026-08-10
Returned 2026-08-08

Expect:
- `on_time`

### Late

Expected 2026-08-10
Returned 2026-08-13

Expect:
- `late`
- delayDays = 3

### No due date

expected = null

Expect:
- `no_due_date`
- delayDays = null

### Duration

loanDate 2026-08-01
returnedDate 2026-08-13

Expect:
- durationDays = 12

### Same day

loanDate = returnedDate

Expect:
- durationDays = 0

### Missing loanDate

Expect:
- durationDays = null

---

## 2. Date/time boundaries

Перевірити:
- returnedAt близько UTC midnight;
- date-only expectedReturnDate;
- application timezone/date normalization;
- same calendar day не стає late через timestamp.

---

## 3. History scope

History list включає тільки:
- current user;
- status = returned;
- valid returnedAt.

Не включає:
- active;
- іншого user.

---

## 4. Direction filter

- borrowed only;
- lent only;
- all.

---

## 5. Result filter

- on_time;
- late;
- no_due_date.

Filter до pagination.

---

## 6. Search

Перевірити:
- title;
- author;
- personName;
- case-insensitive behavior;
- no accidental cross-user data.

---

## 7. Person filter

Exact selected person повертає тільки відповідні completed loans.

Top person click на frontend встановлює той самий URL filter.

---

## 8. Period

Inclusive:
- from;
- to.

Custom range:
- from <= to validation.

---

## 9. Sort

### returned_desc

Newest first.

### returned_asc

Oldest first.

### loan_date_desc

Null last.

### duration_desc

Longest calculable first; define null last.

### title/person

Stable tie-breaker.

---

## 10. Pagination

- totalCount correct;
- items correct;
- filter/sort before skip/take;
- page reset after filter change.

---

## 11. Overview summary

Test:
- totalCompleted;
- borrowedCount;
- lentCount;
- onTimeCount;
- lateCount;
- noDueDateCount;
- percentages;
- averageDelayDays;
- averageDurationDays.

No division by zero.

---

## 12. Overview scope

Overview respects:
- type;
- person;
- returnedFrom;
- returnedTo.

Overview ignores:
- result;
- search;
- sort;
- pagination.

---

## 13. Top people

- group counts;
- direction breakdown;
- top 5;
- deterministic order on ties.

---

## 14. Duration analytics

- average;
- longest;
- shortest;
- ignores null loanDate;
- null metrics if no calculable records.

---

## 15. Detail endpoint

- own returned loan -> 200;
- own active loan -> not available as history detail;
- foreign loan -> 404/secure existing semantics;
- missing -> 404.

---

## 16. Restricted correction

Allowed:
- returned date;
- note.

Forbidden payload cannot mutate:
- type;
- status;
- ownership;
- person;
- loanDate;
- expectedReturnDate;
- reminder.

Returned date earlier than loanDate -> validation error.

After date correction:
- result updates;
- delay updates;
- duration updates;
- overview updates after invalidation.

---

## 17. Return flow integration

After returning an active loan:
- active list no longer contains it;
- history contains it;
- returnedAt present;
- history overview total +1;
- correct direction preserved.

If reminder lifecycle exists:
- no pending `nextReminderAt`.

---

## 18. Frontend states

### Overall empty

- no 0/0/0/0 cards;
- correct empty text.

### Filtered empty

- filters stay visible;
- clear filters works.

### Loading

- skeleton, no layout jump where avoidable.

### Error

- retry works.

---

## 19. Frontend interactions

- row -> detail drawer;
- title/cover -> book page;
- menu doesn't trigger row drawer;
- top person -> person filter;
- filters sync URL;
- page resets on filter/search;
- invalid URL params fallback safely.

---

## 20. Localization

Test manually:
- uk plural forms: 1 / 2 / 5 / 21;
- en plural;
- no hardcoded gendered Ukrainian;
- no untranslated keys.

---

## 21. Responsive acceptance

### Desktop
- no overlap with sidebar;
- timeline readable.

### Tablet
- sidebar uses existing collapse behavior.

### Mobile
- no horizontal overflow;
- timeline vertical/compact;
- filter UI usable;
- drawer/sheet usable;
- no newly invented bottom nav.

---

# Final DoD checklist

- [ ] Separate history route exists.
- [ ] Sidebar has third child «Історія позик».
- [ ] No new LoanHistory table.
- [ ] Completed only.
- [ ] Both directions.
- [ ] Backend-derived result/duration/delay.
- [ ] Backend filter/sort before pagination.
- [ ] 4 stat cards.
- [ ] Search + direction + result + person + period.
- [ ] Default newest returned.
- [ ] History timeline row.
- [ ] Detail drawer.
- [ ] Restricted correction only.
- [ ] Analytics sidebar.
- [ ] Empty/loading/error.
- [ ] Mobile adapted.
- [ ] `uk` + `en`.
- [ ] API client regenerated.
- [ ] Relevant tests pass.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] No unrelated refactor.
