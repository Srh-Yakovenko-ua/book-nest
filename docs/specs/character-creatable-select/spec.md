# Refactor: creatable single-select для `Статус` і `Гендер`

> Джерело: ТЗ, яке користувач вставив у чат 2026-10-07. Скопійовано дослівно.
> Scope: лише поля `Статус` і `Гендер` у формі створення/редагування персонажа (`apps/web`, feature `characters`). Бекенд, БД, enum-и та shared-контракти не змінюються.

Проаналізуй актуальну `dev` гілку репозиторію:

https://github.com/Srh-Yakovenko-ua/book-nest

Потрібно зробити невеликий UX-refactor у формі створення/редагування персонажа для полів:

- `Статус`
- `Гендер`

Зараз обидва працюють через:

- звичайний `Select`;
- окремий пункт `Інше / Свій варіант`;
- після цього нижче з’являється окреме full-width поле для custom value.

Хочу замінити це на один **creatable single-select control**.

## Що потрібно зробити

Створи reusable component у `Characters` feature, наприклад:

`CharacterCreatableSingleSelect`

На основі вже існуючого в проекті патерну:

`CommandPrimitive + Popover + editable input + standard options + create custom option`

Орієнтуйся на:

- `CharacterRolePicker`
- `StoreAutocomplete`
- `DeliveryServiceAutocomplete`

Не створюй великий глобальний generic framework.

---

## Статус

Показувати стандартні статуси, крім sentinel `other`.

Користувач може:

- вибрати стандартний статус;
- або ввести власний, наприклад `У полоні`.

Для custom value:

```ts
status = "other";
statusCustomText = "У полоні";
```

Для standard:

```ts
status = selectedStatus;
statusCustomText = "";
```

При edit mode, якщо:

```ts
status = "other";
statusCustomText = "Зник безвісти";
```

у picker потрібно показувати:

`Зник безвісти`

а не:

`Інше`

Окреме поле `Свій статус` видалити.

---

## Гендер

Показувати стандартні gender options, крім sentinel `custom`.

Користувач може:

- вибрати стандартний гендер;
- або ввести власний, наприклад `Гендерфлюїдна`.

Для custom:

```ts
gender = "custom";
customGender = "Гендерфлюїдна";
```

Для standard:

```ts
gender = selectedGender;
customGender = "";
```

При edit mode, якщо:

```ts
gender = "custom";
customGender = "Гендерфлюїдна";
```

у picker потрібно показувати:

`Гендерфлюїдна`

а не:

`Свій варіант`

Окреме поле `Свій варіант` видалити.

---

## UX

Dropdown має:

- показувати стандартні options;
- фільтрувати їх під час введення;
- для нового значення показувати:
  `+ Створити «{value}»`;
- не показувати create action, якщо введений текст збігається зі стандартним option;
- підтримувати `Enter`, `ArrowUp`, `ArrowDown`, `Escape`;
- підтримувати mouse selection;
- не submit-ити всю форму при `Enter`;
- підтримувати clear;
- використовувати існуючі i18n keys або додати мінімально необхідні.

---

## Layout

Залишити поточну структуру:

```text
Важливість | Статус
```

і:

```text
Вид запису | Гендер
```

Без окремих full-width custom inputs нижче.

---

## Важливо

Не змінювати:

- backend API;
- DB;
- enum values;
- shared contracts без необхідності;
- role picker;
- spoiler logic;
- unrelated код.

---

## Тести

Онови або додай тести для:

- standard selection;
- custom creation;
- exact match;
- edit mode з existing custom value;
- custom → standard очищає старий custom text;
- standard → custom;
- `Enter` не submit-ить форму;
- старі окремі поля більше не рендеряться.

Після короткого plan одразу реалізуй refactor.
