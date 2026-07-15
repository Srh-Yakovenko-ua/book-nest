# Backend: тести та acceptance criteria

## Unit tests — detection

Покрити:

- попередньої книги немає в черзі;
- попередня книга стоїть нижче;
- кілька попередніх книг відсутні;
- попередня книга `reading` — issue відсутній;
- попередня книга `paused`;
- активне читання випереджає порядок;
- `finished` не блокує;
- `dnf` поводиться за зафіксованою доменною семантикою;
- `NONE`;
- `WANT_TO_BUY`;
- `IN_TRANSIT`;
- `LENT_TO`;
- `BORROWED_FROM` як доступна книга;
- кілька книг переплутані;
- повністю зворотний порядок;
- одна серія повертається один раз;
- severity і ranking;
- gaps;
- фактичний тип позиції без округлення;
- `null` positions;
- duplicate positions і stable tiebreaker;
- deleted book/series;
- disabled series;
- ignored fingerprint.

## Integration/e2e — preview та apply

Покрити:

- preview додавання однієї книги;
- apply додавання однієї книги;
- preview/apply додавання всіх відсутніх;
- preview/apply reorder series slots;
- сторонні книги не змінюють позиції при slot reorder;
- contiguous queue positions після insert;
- duplicate prevention;
- queue limit;
- idempotent повторний apply;
- transaction rollback;
- stale queue version;
- stale issue fingerprint;
- user isolation;
- auth errors;
- invalid strategy.

## Ignore та preferences

- issue зникає після ignore;
- незмінений fingerprint не повертається;
- зміна суті конфлікту створює новий fingerprint;
- disable series приховує всі її issues;
- re-enable повертає актуальні issues;
- налаштування одного користувача не впливають на іншого.

## Acceptance criteria

- [ ] Проведено й збережено read-only аудит.
- [ ] Використано канонічний series comparator.
- [ ] `queuePriority` не бере участі у detection, ranking або fix.
- [ ] Активне читання враховується як позиція перед чергою.
- [ ] Усі описані problem types визначаються коректно.
- [ ] Одна серія повертається одним item.
- [ ] Результат стабільно ранжований.
- [ ] API повертає current і recommended order.
- [ ] Preview обчислюється на сервері.
- [ ] Apply повторно перевіряє стан.
- [ ] Усі queue changes атомарні.
- [ ] Є optimistic concurrency.
- [ ] Немає partial insert/reorder.
- [ ] Немає duplicate queue items.
- [ ] Підтримано ignore fingerprint.
- [ ] Підтримано disable/re-enable per user and series.
- [ ] Немає N+1.
- [ ] Дані ізольовано за поточним користувачем.
- [ ] Додано unit та integration/e2e tests.
- [ ] Старі queue, series, ownership і reading flows не зламані.
