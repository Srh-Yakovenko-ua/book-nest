# Book Nest — Статистика → Прогрес | SPEC v2 · dev-aligned

**Єдине виконуване ТЗ.** База рішень: `BOOK_NEST_STATISTICS_PROGRESS_FINAL_TZ_DEV_ALIGNED_v1.md`. Збережено R01–R20 й A01–A24; функціональну семантику не змінено. Перевірений `origin/dev`: `69479f6a066fa0b4fcd7102cc8219878b44638a1` (2026-10-19; PR #295, вкладка «Вподобання»). **Це знімок під час пакування, а не pinned checkout**: перед роботою один безпечний `git fetch origin dev`, повторна звірка HEAD.

## 0. Dev delta: враховані реалізовані сусідні вкладки

- **«Активність», PR #294:** URL-state для `calendarMode/calendarMonth`, динаміка/звички/календар, focus-target; усі ці файли та навігацію лишити недоторканими. `?tab=progress` і глобальний period/comparison мають працювати як зараз.
- **«Вподобання», PR #295:** `components/tastes/taste-ranking-list.tsx` уже підтримує **перенесення довгих назв** (`break-words whitespace-normal`), мобільне розкриття після 3 рядків, контекстні лінки й `scaleMax?`; покрито `taste-ranking-list.test.tsx`. Для `SeriesSection` перевикористовувати цей компонент **без змін**. Частотні серійні бари залишити з **відносним масштабом за максимальним значенням**, **не** передавати `scaleMax=10` (це лише для rated genre/author). Не створювати повторних тестів `TasteRankingList`.
- PR #295 також змінив `CompletedReadCard`, рейтингові картки, publishers/languages, uk/en i18n та додав тести. Це **не scope** вкладки «Прогрес». У i18n змінювати **лише** `statistics.goal`, `statistics.series`, `statistics.libraryBalance`, `statistics.records`; не перезаписувати сусідні ключі. Ні один `progress/*.tsx` не змінений PR #295.
- Якщо після пакування з'явилися нові коміти, `spec-auditor` PLAN робить `CONFIRMED/MOVED/STALE/ALREADY_DONE/FALSE` тільки для зачеплених припущень; реальну виконану поведінку позначає `ALREADY_DONE`, не дублює.

## 1. Scope та незмінні контракти

**Мета:** точковий frontend UX/UI, доступність, uk/en і вузькі тести _існуючих чотирьох секцій_ у сталому порядку: Ціль читання → Серійне читання → Баланс бібліотеки → Ваші рекорди (`components/overview/statistics-overview.tsx`, `PageTabsPanel value="progress"`). Не змінювати wrapper, число секцій, tab/URL-state, глобальні period/comparison, спільний `useReadingStatisticsOverview`, initial/refetch error, loading, invalid-range, сторінку цілей і backend.

**Часова семантика:** `goal` і `libraryBalance` — поточний snapshot незалежно від обраного періоду; бібліотечний forecast на ковзних попередніх 12 місяцях; `series` і `records` — за вибраний період. Не змінювати джерела чи формули під виглядом UI-фіксів.

**Backend контракт (читати, не змінювати):**

- `StatisticsGoalComposer` вибирає найближчу за deadline активну ціль, метрики з Reading Goals; CTA і `otherGoals` уже реалізовані.
- `StatisticsSeriesComposer`: `mostActive` рахує всі completed read _cycles_, `topProgress` і `lifecycle` — доведені перші завершення; списки максимум 5/3, марафон мінімум 2 поспіль. Lifecycle іноді `LEGACY_HISTORY_INCOMPLETE`; показники неадитивні.
- `StatisticsLibraryComposer` і `StatisticsLibraryRepository`: snapshot власних (`owned`, `lent_to_someone`) книг; TBR і readRatio за **поточними** статусами; forecast за підтвердженими first completions owned книг останніх 12 міс. (мін. 3; unresolved history → unavailable). `flow` зараз завжди `unavailable/HISTORY_NOT_TRACKED`.
- `record-engine.ts`: максимум 4 із 7 типів за **фіксованим серверним пріоритетом**; не додавати п'ятий запис, локальне сортування чи нову формулу. Legacy `selectedPeriodQuality="legacy_lower_bound"` обмежує достовірність історичних сторінок/активності, не дозволяє домислювати значення.
- Перевикористати `StatisticsSection`, `StatisticsStat` (`hint`), `StatisticsSectionState`, `StatisticsNote`, `TasteRankingList`, `Progress`, `StatisticsDetailSurface`, існуючі formatters/next-intl. Ніяких нових shared UI abstractions, мережевих запитів чи залежностей.

## 2. Зафіксовані рішення (без нового погодження)

| ID  | Рішення                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | Залишити чотири секції у поточному порядку та без зміни загальної архітектури.                                                                                                           |
| R02 | Локально пояснити часовий контекст: поточний стан у «Цілі» й «Балансі», вибраний період у «Серіях» і «Рекордах», без повторення довгих приміток.                                         |
| R03 | Повна картка цілі: повна назва з переносами; `compact` на «Огляді» не змінювати без необхідності.                                                                                        |
| R04 | У full-цілі прибрати дубльований статус «Активна», зробити помітним темп; `pace=null` — нейтральний стан, не фальшивий позитивний.                                                       |
| R05 | Дедлайн і доступна прогнозована дата у full-цілі мають показувати рік; наявний `formatDateLong`.                                                                                         |
| R06 | Дисплей прогресу ніколи не показує 100% при `remainingCount > 0` лише через округлення; залишити backend-метрики незмінними.                                                             |
| R07 | Для low/none confidence прогноз цілі лишається недоступним, із чітким локалізованим поясненням; не підставляти дату.                                                                     |
| R08 | Серійні KPI залишити: розпочато/продовжено/завершено/наздогнано; пояснити, що категорії не завжди взаємовиключні й їх не можна складати.                                                 |
| R09 | «Найбільший прогрес» переозначити **лише текстом** як «Поступ у серіях» / «Вперше завершені книги за період»; жодної зміни формули.                                                      |
| R10 | При нулі завершених читань за період показати змістовний empty-state серій, не «невдалося порахувати частку»; при >0 і жодному читанні в серії показати чесні 0% та порожній рейтинг.    |
| R11 | `lifecycle` unavailable показує причину, не чотири нулі; решта доступних серійних показників залишаються видимими.                                                                       |
| R12 | «Баланс бібліотеки»: чіткий підпис про поточний зріз, незалежний від історичного фільтра.                                                                                                |
| R13 | `readRatio`: уточнити назву «Прочитані серед власних» і підпис «За поточними статусами»; `null` означає «—», не 0%.                                                                      |
| R14 | Прогноз TBR: назва і hint пояснюють ковзні 12 місяців і невраховані майбутні покупки; при unavailable — причина **біля KPI**, без дублювання наприкінці секції.                          |
| R15 | Не показувати недостовірний `flow` і не будувати історію надходжень/вибуття; не впроваджувати новий backend event ledger.                                                                |
| R16 | «Ваші рекорди»: зберегти title та до 4 вибраних backend записів; уточнити description як добірку рекордів вибраного періоду.                                                             |
| R17 | У картках рекордів повні довгі назви доступні на touch і клавіатурі, без залежності тільки від hover.                                                                                    |
| R18 | Для `peak_month` явно пояснити, що переможець визначений за завершеними читаннями; за legacy lower bound пояснити обмежену достовірність **показаних сторінок**, не обнуляти завершення. |
| R19 | Зберегти лише точні поточні navigation/drilldown: день через `StatisticsDetailSurface`, книга через активний book link; не робити всі рекорди клікабельними.                             |
| R20 | Адаптивність, i18n uk/en, доступність й мінімальні локальні регресійні тести — обов'язкові; глобальні gates відкладені за `CLAUDE.md`.                                                   |

## 3. Виконання P0–P5: один `/spec-to-ship`

### P0: preflight + PLAN (stages 0–3)

Запускати Claude Code **з кореня репозиторію** для підвантаження hooks. Знайти саме `BOOK_NEST_STATISTICS_PROGRESS_CLAUDE_CODE_v2_OPTIMIZED.zip` (якщо шлях інший, використовувати повідомлений користувачем шлях); **прочитати архів і витягти тільки `SPEC.md`** у цільовий worktree як `docs/specs/statistics-progress/spec.md`, звірити вміст; не запускати npm/генераторів для розпакування.

До worktree: один `git fetch origin dev`, перевірка SHA, `git status --short`, існування цільової гілки й worktree. Новий worktree: `D:\IT\book-nest\.claude\worktrees\statistics-progress`, гілка `feat/statistics-progress-refactor`, **від актуального `origin/dev`**. Якщо worktree/гілка вже існують, перевірити їх базу та незбережені зміни; **нічого не скидати, не ребейзити, не перезаписувати чужу роботу**. При неможливості безпечно інтегрувати свіжу dev — `BLOCKED`, а не робота на старій базі потайки. Якщо `fetch` не відбувся, не називати локальну копію свіжою. Далі всі зміни тільки у вибраному worktree.

`/spec-to-ship` Stage 0–3: `spec-auditor` PLAN звіряє **поточні** `file:line`; створює `docs/specs/statistics-progress/tasks.json` з `REQUIRED/ALREADY_DONE/EXCLUDED`, `doneWhen`, залежностями, файлами. Рішення R01–R20 уже зафіксовані; не питати рутинних підтверджень, про об'єктивний блокер повідомляти. `/unlazy` веде **ці самі** blocks, не ще один цикл.

### Slice A = P1 + P2: ціль, серії (stages 4–5)

**P1 · `components/progress/reading-goal-card.tsx`**

- `full`: одне коротке пояснення поточного snapshot поруч із заголовком (прибрати дубль примітки внизу), повне ім'я через wrap/`break-words`, зрозумілий headline `completed/target`, CTA; без зайвої вкладеної загальної картки. Рядок статусу «Активна» прибрати лише у full, виділити `pace` (`ahead/on_track/behind/critical`), `null` нейтральний.
- Дедлайн і достовірний прогноз у full — `formatDateLong` із роком. `low/none` confidence або дата `null` → чітка локалізована відсутність, без вигаданих дат. `primaryGoal=null`/CTA `/goals`, інші активні цілі та contextActions збережені.
- Єдина логіка **відображуваного** percent для обох варіантів `GoalProgress`: округлити backend `progressPercent`, за `remainingCount>0` обмежити display до 99%; `remainingCount=0` може мати 100%; текст/`Progress.value`/`aria-label` мають збігатися. **Backend progressPercent не перераховувати.** Компонування і wrap змінити лише у `full`; `compact` «Огляду» лишити як було, крім необхідної спільної корекції percent.
- Одразу з P1: лише локальні `statistics.goal` uk/en keys та вузькі тести довгої назви, full/compact, confidence, 99.5%, дат, CTA. Не переписувати тести «Огляду» без потреби.

**P2 · `components/progress/series-section.tsx`**

- Підпис «за вибраний період». Пріоритет availability: якщо `series.availability="unavailable"` — unavailable, не empty; якщо `completedReadsCount===0` — **один** meaningful empty-state без 0/0%, нульового lifecycle чи рейтингів. Якщо completed>0, але серійних=0 — показати фактичні `0%` (за backend `seriesShare===0`) + empty рейтингу, без фальшивого марафону; якщо ratio `null` у нетипових даних — не конвертувати самовільно в 0.
- Чотири lifecycle KPI лишити, пояснити **неадитивність** за допомогою короткої `StatisticsNote` або `StatisticsStat.hint`. Lifecycle unavailable → його причина, інші доступні частини лишити. «Найактивніші» = завершені cycles; «Поступ у серіях» = вперше завершені books. Не міняти сортування/ліміти 5/3/контекстні links.
- `TasteRankingList` після PR #295 **уже підтримує** перенесення та mobile expand; використовувати як є, без `scaleMax` для frequency-серій. Сітка рейтингу `lg:grid-cols-2` без змін. Одразу з P2: відповідні uk/en keys і вузькі тести для zero/none/legacy/ranking, не дублювати існуючі ranking-list тести.

**Після Slice A:** потрібні агенти/змістовний review за `CLAUDE.md`; виправити підтверджені findings перед наступним slice. Ні тести, ні lint/gates не запускати.

### Slice B = P3 + P4: бібліотека, рекорди (stages 4–5)

**P3 · `components/progress/library-balance-section.tsx`**

- Єдиний короткий current-snapshot підпис; 3 наявні `StatisticsStat` у `grid-cols-1 sm:grid-cols-3`, без нових KPI. `readRatio` назвати «Прочитані серед власних», hint — «За поточними статусами»; `null` → `—` з поясненням, ніколи 0%. Наявна шкала `Progress` лише за числового значення.
- Forecast: пояснити біля KPI 12-місячний **підтверджений first-completions темп власних** книг і **невраховані майбутні покупки**; `data=null`/`unavailable` → `—` та локалізована причина **біля цього KPI**, без дубля `StatisticsNote` внизу. `0 monthsRemaining` при порожньому TBR і надійному forecast — валідне 0, не unavailable. `flow` — лише якщо backend повернув надійні доступні дані (сьогодні таких немає); нічого не вигадувати.
- Одразу з P3: відповідні `statistics.libraryBalance` uk/en keys та вузькі тести current vs historical period, ratio null, forecast unreliable, no flow.

**P4 · `components/progress/records-section.tsx`**

- Зберегти title «Ваші рекорди», опис як **добірку до 4** рекордів за період; 7 типів — джерело можливих кандидатів, не всі обов'язково присутні. Зберегти порядок server items, ключ `type`, mobile `snap-x` scroll/role/Tab, desktop grid.
- Довгі book/series назви повністю читабельні через wrap/`break-words`, touch та keyboard, без tooltip-only. При `peak_month` коротко позначити, що перемога за `completedReads`; `pagesRead` — супутнє число, може бути lower-bound за `isLowerBound` із локальною приміткою поруч. Наявні lower-bound `longest_streak` і `most_pages_in_day` зберегти; не створювати другий глобальний warning.
- Навігація незмінна: лише точна `ReadingDayDetails` для `most_pages_in_day` через `StatisticsDetailSurface` (popover desktop / drawer mobile); book link лише для active; інші картки не робити клікабельними, не вигадувати subset/readingCycle destination. `items=[]` → наявний empty-state.
- Одразу з P4: відповідні `statistics.records` uk/en keys та вузькі тести типової/порожньої/legacy картки, довгого заголовка й існуючих точних links.

**Після Slice B:** потрібні агенти/змістовний review за `CLAUDE.md`; виправити підтверджені findings. Subagents не запускають tooling чи gates.

### P5: completeness VERIFY + closure (stages 6–8)

- Перевірити **всі** `R01–R20/A01–A24` і фактичні `tasks.json.doneWhen` через read-only diff з урахуванням **untracked**: `git status --short`, `git diff --name-only`, `git diff`, `git ls-files --others --exclude-standard`. Не покладатися лише на `git diff`: нові `*.test.tsx`, `tasks.json` і `verify-report.md` можуть бути untracked. `spec-auditor` VERIFY один раз після змістовних slices; якщо `missing`, виправити targeted, повторити VERIFY лише за потреби.
- `DONE` = підтверджено кодом/diff; `ALREADY_DONE` = вже було в актуальній dev; `EXCLUDED` = поза scope; `BLOCKED` = конкретний блокер; `NOT_VERIFIED` = не перевірено виконанням. A01–A24 **не означають** 24 нові тести; вузькі тести додані по slices. Не заявляти про runtime/a11y/viewport без фактичної перевірки.
- `/spec-to-ship` Stage 7 **DEFERRED**: написані Vitest-тести призначені для **CI** і наразі `NOT_VERIFIED`; локальні eslint/typecheck/prettier/build, `/check`/`gates.sh`, dev-server, browser/screenshots/E2E також `NOT_VERIFIED` **до окремої команди користувача**. Це різні категорії перевірок, не все називати `CI-only`.
- Stage 8 — короткий звіт із блоками `/unlazy` (`Blocks`, `Missing`), виконаними A01–A24, змінами файлів і відкладеними перевірками. Немає автоматичних commit/push/PR/merge/deploy.

## 4. Критерії приймання: не писати окремий тест на кожен рядок

| ID  | Перевірюваний результат                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- |
| A01 | `tab=progress` містить **4** секції у старому порядку; інші вкладки/URL залишилися незмінними.                               |
| A02 | Зміна таба не створює нових endpoint/query, збережено глобальний період та keyboard tabs.                                    |
| A03 | У «Цілі» й «Балансі» прямо сказано «поточний стан», у «Серіях» і «Рекордах» — «вибраний період».                             |
| A04 | Full-ціль показує повну довгу назву з переносами й не впливає на compact-версію «Огляду».                                    |
| A05 | Дедлайн і надійний прогноз full-цілі показують **рік**, з `formatDateLong`.                                                  |
| A06 | Full-ціль не дублює статус «Активна», а темп відображає коректно для всіх станів/null.                                       |
| A07 | За `remainingCount>0` індикатор і текст не показують 100% тільки через округлення; при завершенні можливі 100%.              |
| A08 | Відсутній/низькодостовірний прогноз цілі має зрозумілий unavailable текст; відсутні вигадані дати.                           |
| A09 | Empty-goal і CTA `/goals`, кілька активних цілей і відповідні links працюють як раніше.                                      |
| A10 | За нуля завершених читань секція серій показує один чесний empty-state, не «не вдалося» і не 0/0%.                           |
| A11 | За >0 завершених читань без серій показує 0% та порожній рейтинг; не додає фальшивий марафон.                                |
| A12 | Lifecycle доступний — чотири метрики й пояснення неадитивності; unavailable — причина, не нулі.                              |
| A13 | У рейтингах серій семантика циклів / перших завершень чітка, backend-сортування, ліміти 5/3 та посилання збережені.          |
| A14 | Серійний марафон при даних відображається, відсутній — не вигадується.                                                       |
| A15 | Баланс: поточні owned/TBR без прив'язки до вибраного періоду; трійка KPI і responsive grid збережені.                        |
| A16 | `readRatio` названо часткою серед власних за поточними статусами, `null` не перетворено на 0%.                               |
| A17 | Прогноз бібліотеки пояснює 12 міс., власні книги й майбутні покупки; причина unavailable біля KPI, без подвійних нотаток.    |
| A18 | Немає нового flow, endpoint, DTO, backend-змін чи діаграми без даних.                                                        |
| A19 | Рекорди: до 4, backend порядок незмінний, опис коректно називає добірку.                                                     |
| A20 | Довгі назви всіх записів доступні на mobile/touch та desktop; немає глобального горизонтального overflow.                    |
| A21 | `peak_month` пояснює перемогу за читаннями й legacy застереження щодо сторінок; existing lower-bound для streak/day лишився. |
| A22 | Точні посилання й day popover/drawer діють як раніше; хибної клікабельності не додано.                                       |
| A23 | Для змінених станів є вузькі тести; `overview` і `activity` не отримали регресій від shared components.                      |
| A24 | uk/en повні, без hardcoded текстів; тести/gates не запущені без команди, про це сказано `NOT_VERIFIED`.                      |

## 5. Файлові межі / регресійні інваріанти

**Змінювати лише за завданням:**

- `apps/web/src/features/statistics/components/progress/{reading-goal-card,series-section,library-balance-section,records-section}.tsx`;
- `apps/web/src/messages/{uk,en}.json` — **лише** ключі чотирьох progress-секцій, не результати PR #295 в tastes;
- вузькі `apps/web/src/features/statistics/components/progress/*.test.tsx`.

**Умовно, лише після доказу необхідності:** `apps/web/src/features/statistics/components/overview/statistics-overview.test.tsx` (точкова регресія URL/Overview), вузький допоміжний frontend файл, якщо неможливо локально. `components/tastes/taste-ranking-list.tsx` після PR #295 вже вирішує проблему переносу; **не чіпати в нормальному сценарії**. `completed-read-card.tsx`, `rating*`, `genres`, `authors`, `languages`, `publishers`, `discoveries`, їхні тести та localization-keys не змінювати.

**Заборонено:** `apps/api/**`, `packages/shared/**`, Prisma/DB, generated API, package/lockfile, CI/hooks, Reading Goals feature, URL parsers, `statistics-overview.tsx`, інші tabs/components Activity/Tastes, backend record/lifecycle/forecast logic, нові endpoint/DTO, нові бібліотеки. Лише `docs/specs/statistics-progress/{spec.md,tasks.json,verify-report.md}` як робочі artifacts `/spec-to-ship`; зайві документаційні копії не створювати. Жодних destructive git команд, прихованого reset/stash/rebase, коміту чи пушу.

**Регресії:** компактна `ReadingGoalCard` в «Огляді» лишається візуально незмінною, крім виправленого відображуваного percent; Tastes використовує `TasteRankingList` із `scaleMax` тільки для rated, а Series — без `scaleMax`; Activity URL-state `calendarMode/calendarMonth` і клавіатурна навігація лишаються недоторканими. Історичні `null`/unavailable/legacy не стають нулями; контекстні переходи не підмінюються неточними. Відсотки та ARIA синхронізовані; mobile не має глобального горизонтального overflow.

**Операційні правила:** актуальний кореневий `CLAUDE.md` та skills мають пріоритет у безпеці/агентах. `spec-auditor` PLAN до реалізації та VERIFY після; `frontend-engineer`, `frontend-test-engineer`, design/a11y/review агенти в межах обов'язкових тригерів; не плодити повторних review окремо від двох змістовних slices. Максимум 2–3 агенти одночасно. Тести написати, **локально не запускати нічого важкого або gates** без окремої команди. Автоматично виконати послідовні етапи без проміжного погодження.
