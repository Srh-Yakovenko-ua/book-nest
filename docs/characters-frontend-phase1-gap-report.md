# Gap-репорт — Персонажі, frontend, Фаза 1

Заповнено за шаблоном `docs/characters/booknest-characters-implementation-v2/delivery/03-gap-report-template.md`.

## Фаза

Фаза 1 — Ядро персонажів (Must), **лише frontend**. Backend уже був реалізований і змерджений у `dev`.

## Стан репозиторію на момент роботи

- гілка: `feat/character` (git worktree, база — `dev` @ `b6d3d12`).
- backend `apps/api/src/modules/characters/**`, shared-контракти `packages/shared/src/characters.ts` і згенерований Orval-клієнт (`apps/web/src/shared/api/generated/**/characters*`) уже присутні на `dev` — фронт будувався поверх них, без ручного `fetch` і без дублювання типів.
- розбіжності з описом пакета: спека покриває всі фази (relationships/graph/theories/groups/merge), але цей крок свідомо обмежено обсягом Must (Фаза 1) згідно з `02-scope-and-phases.md`.

## Реалізовано

Feature-слайс `apps/web/src/features/characters/` (39 файлів) + вкладка `Персонажі` в деталях книги (`?tab=characters`) + i18n-неймспейс `characters` (uk + en, ідентичні набори ключів).

- **Список у книзі**: серверний `search` + пагінація, клієнтське сортування завантаженої сторінки (`recommended` за замовчуванням: favorite → central → major → supporting → episodic → mentioned → алфавіт; `name`). Skeleton-картки, empty/no-results/error+retry стани, summary-смужка + бейдж-лічильник на вкладці (`GET /api/books/:id/character-summary`).
- **Картка** (`ui/character-card`): портрет/аватар+ініціали, displayName‖name, importance, статус, favorite, індикатор прихованих полів, kebab-меню (редагувати / прибрати з книги / видалити повністю).
- **Details-sheet** (на мобільному — на повний екран): загальні дані + дані у цій книзі + інші появи; спойлер-поля показуються як locked із дією `Показати`, що **re-fetch-ить** деталі з `revealFieldIds` (клієнт ніде не реконструює приховане значення). Приховані ролі/aliases не потрапляють у DOM; замість них — лічильник прихованих ролей.
- **Add flow**: перший екран — пошук existing + suggested + CTA `Створити нового`; повна форма з 3 секціями (Загальні / У цій книзі / прості спойлер-тумблери). Редагування розділяє scope: `PATCH /api/characters/:id` (глобальні) і `PATCH /api/books/:id/characters/:id` (книжкові) — окремими запитами.
- **Quick-capture** (`QuickAddCharacterBar`): одне поле імені + опційний нотаток → миттєве створення (mode `new`); debounced duplicate-suggestion `Це [ім'я]?` з `Прив'язати наявного`; Enter створює, очищає поле й лишає фокус.
- **Duplicate-suggestion**: `Використати` (link existing) / `Все одно створити`.
- **Role picker** (multi-select, custom-роль, per-role spoiler-тумблер), **alias editor** (name/type/scope global|book/spoiler/remove), завантаження аватара/портрета (`useUploadMedia`).
- **Delete/undo**: `DeleteCharacterDialog` показує counts (`deletion-preview`) → soft-delete (`?confirm=true`) → sonner-toast із дією `Скасувати` → `restore`. **Unlink** окремо (book-scoped, не soft-delete-ить глобальний профіль).
- **Командна палітра** (`CharacterCommandPalette`): Cmd/Ctrl+K + кнопка в тулбарі, глобальний spoiler-safe пошук (`GET /api/characters`, з `contextBookId` у контексті книги), вибір відкриває details-sheet.
- POV задається тумблером `isPovCharacter` + `narratorType`; у ролях немає `narrator`/`point_of_view`; `entityKind` не приймає `group` (individual|collective|unknown) — усе на рівні shared-схеми.

## Свідомо відкладено

- **Багатий набір фільтрів/сортувань** зі `frontend/03` (importance/ролі/вид/гендер/attitude/favorite/POV/зі-спойлерами/без-аватара/можливі-дублі/архівні) — книжковий roster-ендпоінт їх не підтримує (див. «Розбіжності»). Перенесено до пізнішої фази або окремого backend-завдання.
- **Теги персонажа** (`CharacterTagsPicker`) — спека відносить теги до Фази 2; `tagIds` у `updateInBook` не задаються.
- Серійний контекст (`Станом на книгу`), режим читання, арка, теорії, recap, merge-візард, граф — Фази 2–4.

## Розбіжності зі специфікацією

1. **Roster = лише `search` + пагінація.** `GET /api/books/:bookId/characters` приймає тільки `search/pageNumber/pageSize` — без серверних фільтрів і без параметра сортування. Тому сортування зроблено клієнтським (реордер поточної сторінки), а фільтр-панель зі `frontend/03` не реалізована. Багаті фільтри є лише на глобальному `GET /api/characters`, але він повертає інший DTO (`CharacterGlobalSummaryView`, без книжкового контексту — importance/status/portrait/displayName). → Потрібне backend-рішення: або додати фільтри/сортування книжковому ендпоінту, або віддавати книжковий summary через глобальний з book-контекстними полями.
2. **`CharacterSummaryView` (елемент списку) без ролей/виду/опису.** Тому картка не показує «1-2 primary ролі»/species/safe-description із списку — вони доступні лише в details-sheet. `frontend/03` описує ролі на картці як бажане; це обмеження DTO.
3. **Немає media-kind для персонажів.** `MediaKindSchema` = `avatar | book_cover | series_cover`; окремого `character_portrait`/`character_avatar` немає. І аватар персонажа, і книжковий портрет завантажуються з `kind: "avatar"`. → За потреби окремого kind — backend-завдання.
4. **Reveal-ключі лише книжкові** (`appearanceNotes/description/displayName/personalImpression/portrait/speciesOverride/status`); глобальні поля профілю у v1 не спойлер-маскуються (whole-profile hidden mode — пізніша фаза), що відповідає формі DTO.

## Рішення, які треба підтвердити у власника

- **quick-capture нотаток → `bookProfile.description`** (не `personalImpression`) — обрано одне джерело, як вимагає `features/09`.
- **link-existing** (з picker/quick-add/duplicate «Використати») створює книжкову появу з дефолтним `bookProfile`; користувач уточнює через редагування.
- **редагування** підвантажує деталі з усіма `revealFieldIds` (власник знімає маску зі своїх же полів для редагування), далі зберігає у два окремі запити (global + book). Якщо другий запит впаде після успішного першого — часткове збереження (прийнятно; є retry + field-errors).
- **`seriesId` не передається** в duplicate-candidates/suggestions (його немає на `BookView` без припущень щодо форми), тому «спочатку тієї самої серії» в existing-picker не застосовано — дрібний follow-up, якщо `seriesId` зʼявиться на пропсі вкладки.
- URL-стан roster використовує ключі `characterSearch/characterSort/characterPage`, щоб не конфліктувати з наявним `?tab=` та параметрами інших вкладок.

## Ризики / борг

- Клієнтське сортування — page-local: при пагінації понад одну сторінку порядок стосується лише завантаженої сторінки (для типової кількості персонажів у книзі — одна сторінка, тож на практиці не проявляється; за замовчуванням `pageSize=20`).
- Часткове збереження при edit (два запити) — див. вище.
- Тести написані, але **не запускались** (за прямою вказівкою) — перед merge прогнати `pnpm test`.

## Наступні кроки

1. Прогнати тести (`pnpm --filter @app/web test`) і фінальні гейти на цій гілці.
2. Жива UI-перевірка (responsive, focus/keyboard, light/dark, спойлер-флоу) — виконує власник у своїй сесії (за умовою — без паралельної MCP-перевірки під час роботи інших агентів).
3. Backend-завдання (за пріоритетом): фільтри/сортування книжкового roster-ендпоінту; окремий media-kind для персонажів; за потреби — ролі в summary-DTO.
4. Фаза 2 (серія/читання/журнал) — окремим зрізом.
