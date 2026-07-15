# Backend: обов’язковий read-only аудит

Перед реалізацією backend-агент не змінює код, а досліджує актуальну гілку.

## 1. Серії

Перевірити:

- модель `Series`;
- зв’язок книги із серією;
- фактичне поле та тип канонічної позиції;
- чинний comparator/sort helper;
- логіку `nextBook`;
- soft delete та user ownership;
- поведінку gaps, `null` і duplicate positions.

## 2. Черга

Перевірити:

- модель queue item;
- джерело `queuePosition`;
- правило contiguous positions;
- add-to-queue;
- insert before/after;
- move/reorder;
- bulk reorder;
- queue limit;
- транзакції;
- version/updatedAt/ETag;
- поточні помилки duplicate і stale state.

`queuePriority` перевіряється лише для підтвердження, що воно не змінює фактичний порядок. Не додавати detection або fix на його основі.

## 3. Reading status

Перевірити:

- enum;
- джерело істини;
- активну reading session;
- `paused`;
- семантику `dnf`;
- можливі legacy `null`;
- спільні helpers нормалізації.

## 4. Ownership

Перевірити фактичні enum-значення та доступні mutations/routes для:

```text
NONE
WANT_TO_BUY
IN_TRANSIT
OWNED
BORROWED_FROM
LENT_TO
```

## 5. Наявні endpoint-и та helpers

Знайти й повторно використати:

- series ordering helper;
- queue reorder service;
- insert-before operation;
- ownership mutations;
- current reading data;
- React/API view models;
- transaction wrapper;
- user preferences або ignore infrastructure.

## 6. Звіт аудиту

Створити файл:

```text
docs/series-order-check/backend-audit.md
```

Формат:

```text
Уже є:
- ...

Немає:
- ...

Канонічний порядок:
- поле
- тип
- helper
- fallback

Фактичний порядок черги:
- поле
- спосіб reorder
- queue limit

Reading status:
- джерело істини
- DNF semantics

Optimistic concurrency:
- наявний механізм

Ignore/disable:
- наявна інфраструктура

Обрані маршрути:
- ...

План змін:
- файли/модулі
- міграції, якщо справді потрібні
- тести
```

Після аудиту реалізація має спиратися на фактичну архітектуру, а не механічно копіювати рекомендовані назви маршрутів.
