# Готовий промпт для Claude Code

Проаналізуй вкладений ZIP-пакет зі специфікацією фічі **«Продовжити улюблені серії»** та реалізуй фронтенд-частину в актуальній гілці проєкту.

## Послідовність роботи

1. Спочатку прочитай `00-README.md`, а потім усі файли `01`–`09` у вказаному порядку.
2. Проведи **read-only аудит** актуального коду перед будь-якими змінами:
   - знайди сторінку «Улюблені книги» і структуру її правого сайдбара;
   - знайди наявні компоненти sidebar/card/skeleton/error/empty state;
   - знайди API-клієнт, React Query hooks/query keys і mutations для favorites, reading status, ownership, wishlist, queue та reading progress;
   - знайди shared schemas/types, які описують endpoint continuation items;
   - знайди фактично реалізований бекенд endpoint для favorite-series continuations;
   - перевір фактичні route, query params, response shape, enum-значення, nullable поля, queue metadata, progress і pagination/limit;
   - перевір, які CTA вже підтримуються поточними модалками, маршрутами та mutations.
3. До реалізації створи короткий звіт `docs/favorite-series-continuations-frontend-audit.md` у форматі:

```md
# Frontend audit: favorite series continuations

## Уже реалізовано на бекенді

- endpoint:
- query params:
- response contract:
- statuses/enums:
- queue/progress fields:

## Уже є на фронтенді

- page/sidebar components:
- reusable cards/chips/buttons:
- query keys/hooks:
- supported mutations and routes:

## Розбіжності зі специфікацією

- ...

## План інтеграції

- ...
```

4. Після аудиту реалізуй фронтенд-блок **«Продовжити улюблені серії»** у правому сайдбарі сторінки «Улюблені книги».

## Обов’язкові правила реалізації

- Використовуй **фактичний бекенд-контракт**, а не вигадані поля зі специфікації.
- Не дублюй на фронтенді алгоритм визначення `nextBook`, ranking або канонічного порядку серії.
- Не обчислюй результат із поточної сторінки улюблених книг або її пагінації.
- Не змінюй бекенд у межах цього завдання.
- Не створюй нову палітру, новий варіант кнопки, нову систему chips або окрему дизайн-систему. Використовуй компоненти, theme tokens, status chips, typography, spacing, radius, shadows і button variants, які вже є в проєкті.
- Не дублюй API types вручну, якщо вони генеруються або доступні у shared package.
- Використовуй наявну i18n і pluralization-логіку для української та англійської мов.
- Максимум три continuation items у sidebar, у порядку, який повернув бекенд.
- Реалізуй loading, error, retry та всі релевантні empty states.
- Для відсутньої обкладинки використовуй поточний book placeholder.
- Назва книги — максимум два рядки; назва серії — один рядок з ellipsis.
- Клік на книгу відкриває деталі книги; клік на серію — деталі серії.
- CTA визначай за фактичними `readingStatus`, `ownershipStatus`, queue metadata та наявними можливостями проєкту відповідно до специфікації.
- Не показуй повторне «Додати в чергу», якщо книга вже в черзі.
- Не показуй повторне додавання до wishlist для `WANT_TO_BUY`.
- Після mutations оновлюй continuation query через чинну query-key/invalidation архітектуру; optimistic update застосовуй лише якщо це відповідає поточному підходу проєкту.
- Окрема помилка блока не повинна ламати всю сторінку.
- Збережи accessibility: keyboard navigation, focus states, alt, aria-label для icon buttons, відсутність конфлікту між clickable card та внутрішніми діями.
- Analytics додавай лише якщо в проєкті вже є чинна analytics-інфраструктура.

## Коли бекенду не вистачає

Якщо фактичний endpoint або контракт не дозволяє реалізувати вимогу коректно:

1. не змінюй бекенд;
2. не підмінюй відсутні дані локальними евристиками;
3. реалізуй лише ту частину UI, яка має надійні дані;
4. створи `docs/favorite-series-continuations-backend-gaps.md` із таблицею:

```md
| Вимога | Чого бракує | Де перевірено | Необхідна зміна бекенду | Вплив на фронтенд |
| ------ | ----------- | ------------- | ----------------------- | ----------------- |
```

Для кожного gap вкажи конкретний endpoint/тип/поле або mutation, а не загальне формулювання.

## Тести та перевірка

- Додай тести відповідно до чинного test stack проєкту.
- Мінімально покрий: loading, error/retry, empty state, максимум 3 items, CTA для ключових status/ownership cases, item already in queue, mutation + invalidation, navigation clicks, missing cover, long text.
- Запусти релевантні lint/typecheck/tests/build команди, які доступні в проєкті.
- Не виправляй сторонні проблеми, не пов’язані з цією задачею; окремо зафіксуй їх у фінальному звіті.

## Фінальний результат

Після завершення надай:

1. список змінених файлів;
2. стислий опис реалізованого;
3. фактичний endpoint і контракт, з яким інтегровано блок;
4. які CTA та стани підтримані;
5. які команди перевірки виконані та їх результат;
6. невирішені backend gaps або інші обмеження;
7. підтвердження проходження frontend acceptance criteria з `09-acceptance-scope-and-summary.md`.
