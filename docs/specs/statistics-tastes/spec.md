# Book Nest · Статистика → Вподобання

## Канонічне ТЗ Claude Code — dev-aligned v3

**Репозиторій:** `Srh-Yakovenko-ua/book-nest`; baseline `origin/dev` = `13351f42b9f75126ad4bbc1f4a639de8930d8c31` (19.10.2026, PR #294). Це контрольна точка, а не дозвіл працювати зі старим HEAD. **Scope:** вузький frontend-рефакторинг наявної вкладки; backend/API/DTO незмінні. **Worktree:** `D:\IT\book-nest\.claude\worktrees\statistics-tastes`, гілка `feat/statistics-tastes-refactor` від актуальної `origin/dev`. Працювати з кореня _цільового_ worktree, де завантажуються `.claude/settings.json` та hooks. Функціональні вимоги визначає цей файл; правила безпеки та виконання — чинний кореневий `CLAUDE.md`.

## 1. Незмінний результат і статус на baseline

Шість секцій у цьому порядку: **Оцінки** (повна ширина), **Жанри | Автори** (`lg+` дві колонки), **Видавництва | Мови** (`lg+` дві колонки), **Нові відкриття** (повна ширина, **не** показувати для `all_time`). На мобільному парні секції — одна колонка. Чотири вкладки статистики (`overview`, `activity`, `tastes`, `progress`) та URL-state залишити без змін. Після PR #294 вкладка «Активність» має графік, звички, календар, `calendarMode`/`calendarMonth`, `section=habits`; жодного повторного впровадження.

**ALREADY_DONE на baseline (підтвердити, не переписувати):** шість секцій, спільний overview-запит, `StatisticsSection`/`StatisticsStat`/`StatisticsMetricTabs`/`TasteRankingList`, локальні режими жанрів та авторів, top-4 оцінених циклів, готові `StatisticsDetailSurface`/`CompletedReadDetails`, локалізації uk/en, стани `partial`/`insufficient`/`unavailable`/`empty`, мобільне 3→N розкриття рейтингів, приховування discoveries для `all_time`, точні наявні context actions, KPI→`tab=tastes&section=ratings`. Backend формує 20 buckets розподілу оцінок; у спільній `overviewFixture` є лише 2 демонстраційні buckets.

**REQUIRED, лише якщо ще не виконано:** P1 дата з роком для `topRated`, усунення дублювання coverage і пояснення 8+; P2 абсолютна шкала `/10` для rated та повні назви рейтингових рядків; P3 зрозумілі частки видавництв/мов, компактний KPI мов і правильний текст відкриттів; мінімальні тести цих змін. **EXCLUDED:** повторна реалізація ALREADY_DONE, будь-яке розширення продуктового scope.

## 2. Семантика даних — суворий контракт

- Одиниця обліку — **завершений цикл читання** (`readingCycleId`), не унікальна книга. Reread однієї книги — окремий цикл, навіть якщо два завершені одного дня. Авторські та жанрові групи можуть перетинатися, тому їхні частки не зобов'язані давати 100% у сумі.
- Шкала оцінок **0,5–10 кроком 0,5**, 20 bucket-значень у реальній відповіді, включно з нульовими. Рейтинг за оцінкою жанру/автора потребує **≥3** оцінених циклів на сутність; середня оцінка видавництва показується за **≥2**. `topRated` має ≤4 циклів. Backend обмежує списки жанрів, авторів і видавництв до **5**, **мови не обмежені топ-5** (схема BookLanguage допускає 7 значень). Ніде не робити додатковий frontend `slice(0,5)`.
- `highRatedShare`: оцінки **≥8/10 серед лише оцінених** читань. `topThreeConcentration`: читання топ-3 видавництв **серед читань із відомим видавництвом**. `shareOfKnown` мови: **серед читань із відомою мовою**. Мова — знімок **мови видання** на завершення, не мова оригіналу. Невідомі значення не маскувати нулем і не вигадувати окрему мову.
- «Нові відкриття» — тільки доведені перші завершення; неповна legacy-історія лишається `partial`/`unavailable`. `completedReadsAfterDiscovery` фактично рахує **пов'язані з відкритою сутністю завершені цикли у вибраному періоді, включно з першим**; це не тільки цикли строго пізніше `firstFinishedAt`. Backend-поле, формулу, сортування та `firstFinishedAt` не змінювати.
- `completed_reads_subset` без точного UI destination може бути unsupported. Зберегти лише достовірні наявні `contextActions` для автора/видавництва та деталі `reading_cycle`; не вигадувати переходи з рейтингів.

## 3. Зафіксовані рішення №1–16

| №   | Рішення, яке не можна загубити                             | Реалізація                                          |
| --- | ---------------------------------------------------------- | --------------------------------------------------- |
| 1   | Шість секцій у зазначеному порядку                         | ALREADY_DONE                                        |
| 2   | «Оцінки» повної ширини, три KPI та адаптивний розподіл/топ | P1; структуру зберегти                              |
| 3   | Повна шкала 0,5–10, читабельні смуги та ARIA               | ALREADY_DONE; міняти лише за підтвердженої проблеми |
| 4   | Топ-4 циклів, reread окремо                                | P1: дата з роком                                    |
| 5   | Жанри: frequency/rated                                     | P2: правильна шкала rated                           |
| 6   | Автори: frequency/rated + повернення до автора             | P2; решту зберегти                                  |
| 7   | Спільний рейтинг: mobile 3→N, desktop усі N                | P2: повні назви, `/10`; мови без ліміту 5           |
| 8   | Видавництва: кількість, концентрація, рейтинг              | P3: база відсотка                                   |
| 9   | Мови: KPI, рейтинг, частки, джерело                        | P3: компактний KPI й база частки                    |
| 10  | Відкриття: 3 KPI, до 3 карток                              | P3: точний підпис числа читань                      |
| 11  | Тільки точні переходи                                      | ALREADY_DONE; не додавати CTA                       |
| 12  | Глобальні URL-контроли, локальні перемикачі                | ALREADY_DONE; URL не міняти                         |
| 13  | Чесні empty/error/insufficient/partial                     | ALREADY_DONE; без per-section HTTP error            |
| 14  | Responsive без глобального overflow                        | P2; локальний snap-scroll відкриттів зберегти       |
| 15  | Перевикористання, без backend/API/DTO змін                 | EXCLUDED для контрактів                             |
| 16  | Мінімальні тести, gates за окремою командою                | P4, правило §6                                      |

## 4. REQUIRED: виконати P0→P4 один раз

### P0 · Свіжий код і план

1. Переконатися, що запуск із кореня repo і hooks активні. **Один раз** виконати безпечне `git fetch origin dev`; звірити fetched HEAD з baseline. Якщо fetch не вдався, **не називати кешований `origin/dev` актуальним і не створювати роботу на здогаді**: описати блокер. Ніяких destructive Git-дій.
2. Знайти/створити окремий worktree `statistics-tastes` від fetched `origin/dev` і потрібну гілку. Якщо вже існує — перевірити прив'язку, гілку та `git status`; **не** скидати чужі зміни, не робити `stash`, `reset --hard`, `clean -f`, force-switch, rebase/merge без доручення. За небезпечного конфлікту повідомити блокер; не торкатися `statistics-overview` worktree.
3. Покласти цей документ у `docs/specs/statistics-tastes/spec.md` в цільовому worktree. Через **один** `/spec-to-ship` PLAN перевірити твердження за актуальним кодом, позначити `REQUIRED` / `ALREADY_DONE` / `EXCLUDED` / `MOVED` / `STALE`, створити `tasks.json` з `doneWhen` тільки для реальних змін. Усі UX-рішення погоджені; stage 3 має `openDecisions: []`, якщо не виник справжній блокер. Не створювати задач за кожним інваріантом і не повторювати великий repo-аудит між етапами.

### P1 · «Оцінки» — дані, coverage, дата циклу

**Торкатися за потреби:** `tastes/ratings-section.tsx`, `components/completed-read-card.tsx`; `tastes/rating-distribution.tsx` тільки за підтвердженої проблеми overflow/щільності.

- Залишити 3 KPI: середня `/10`, кількість/частка 8+, `ratedReadsCount / completedReadsCount`. У KPI 8+ додати короткий uk/en `StatisticsStat.hint` «серед оцінених читань». Якщо `coverage` неповне, не дублювати `rated/total` в `StatisticsNote`: числа вже в KPI; note тільки пояснює, що середня розрахована за оціненими циклами. За повного coverage note відсутній. `unavailable`/`null` не замінювати на 0.
- `RatingDistribution` показує **усі отримані buckets, включно з нульовими**, з точними counts та `role="img"`/ARIA **коли ratings доступні**. Якщо `ratings.availability === "unavailable"`, зберегти існуючий unavailable-state **без графіка**. Не агрегувати/відкидати buckets; не правити компонент, якщо умова вже виконана.
- У `CompletedReadCard` додати сумісний `showFinishedAt?: boolean` (default `false`). Умова показу `variant === "recent" || showFinishedAt || read.rating === null`. **Тільки** `RatingsSection` вмикає `showFinishedAt`. Для цього контексту дату показати **з роком** через чинний `formatDayLong`, разом з оцінкою, з можливістю перенесення рядка. У default та recent прев'ю старі формати й поведінка лишаються. `readingCycleId`, деталі/popover/drawer, keyboard/focus не міняти.

**doneWhen:** оцінені topRated-картки мають рік і rating; reread різних циклів не зливаються; дубль coverage прибраний; інші використання картки незмінні.

### P2 · `TasteRankingList` — шкала та довгі назви

**Торкатися за потреби:** `tastes/taste-ranking-list.tsx`, `tastes/genres-section.tsx`, `tastes/authors-section.tsx`.

- Додати optional `scaleMax?: number`, зберегти default-масштаб `peak = max(rows.value)`. **Тільки** rated-режими жанрів і авторів передають `scaleMax={10}`; 8/10 має заповнювати **80%**. Rated valueLabel явно має `/ 10` через наявну `statistics.ratings.scale` (не хардкодити). Frequency лишається від peak, без додаткового frontend сортування/округлення.
- В усіх рядках рейтингу повна назва має бути **видимою на touch без hover** і доступною читачу екрана: замінити `truncate` на wrap (`min-w-0`, `whitespace-normal`, `break-words` або еквівалент), не ламати secondary, score або `contextActions`; без псевдокнопок, нових tab-stops чи глобального горизонтального overflow. Tooltip — не обов'язковий і не може бути єдиним способом показу повної назви.
- Зберегти наявні порядкові номери, ключі, точні дії та mobile `3→N` з `aria-expanded`/«Показати ще/Згорнути». На `lg+` показувати **усі N** елементів. Backend обмежує жанри/авторів/видавництва до 5; renderer **не обрізає** мови понад 5.
- Перемикачі жанрів та авторів — незалежні локальні `useState`, без зміни URL та додаткового overview-refetch. Чинний `useGenreName`→`useGenres()` **дозволений**; не трактувати його існуючий запит як новий API. `INSUFFICIENT_SAMPLE` і відсутність рейтингу не перетворювати на нуль.

**doneWhen:** rated 8/10 → 80% + `/10`, frequency peak незмінний, довгі назви повні, рядки N>5 не обрізані.

### P3 · «Видавництва», «Мови», «Нові відкриття»

**Торкатися за потреби:** `tastes/publishers-section.tsx`, `tastes/languages-section.tsx`, відповідні ключі `messages/{uk,en}.json`; `tastes/discoveries-section.tsx` **не** чіпати, якщо достатньо i18n.

- **Видавництва:** зберегти `totalPublishers`, `topThreeConcentration`, рейтинг, optional averageRating. Під KPI концентрації додати локалізований `StatisticsStat.hint`: «серед читань із відомим видавництвом». Не змінювати поріг 2 на FE.
- **Мови:** замінити багатоколонкову обгортку **одного** KPI на простий обмежений за шириною `dl` (напр. `w-full sm:max-w-xs`), без фальшивих порожніх колонок. Зберегти **всі N** мов, їх порядок, кількості, `sourceHint` про мову видання та coverage. `shareOfKnown` описати локалізовано як частку **серед читань із відомою мовою**. Не додавати «Невідомо» як штучну категорію.
- **Відкриття:** змінити **лише** `statistics.discoveries.afterDiscovery` у uk/en, зберігши ICU plural: «{count} читань за період (включно з першим)» / “{count} reads in this period (including the first)” з відповідними граматичними формами. Не міняти поле/кількості/порядок/дата першого завершення, три KPI, максимум три картки, `partial`/`unavailable` чи mobile snap-scroll. `all_time` як раніше не показує секцію.
- Якщо конкретний компонент уже відповідає вимозі, **не редагувати його** заради косметики.

**doneWhen:** підписи відповідають знаменникам і backend, один KPI мов компактний, текст відкриттів правдивий; суміжна UI/мережева поведінка незмінна.

### P4 · Тести нових змін і статична фінальна звірка

Тести **писати, але не запускати**. Перевіряти змінені сценарії, а не всі 19 acceptance-критеріїв новими файлами:

| Файл                                                                | Мінімальний новий/оновлений сценарій                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tastes/ratings-section.test.tsx`                                   | topRated дата з **роком** і rating; два `readingCycleId` (включно з однаковою датою); default/recent лишаються незмінними за наявним тестом або вузькою перевіркою |
| `tastes/taste-ranking-list.test.tsx` (лише якщо немає аналогічного) | rated 8/10=80%, frequency max=100%; mobile 3→N, N>5, `aria-expanded`; повний текст без псевдокліків                                                                |
| `tastes/genres-section.test.tsx` / вузький тест автора              | `scaleMax=10` і `/10` передаються у rated; без повторення всіх старих сценаріїв                                                                                    |
| `tastes/languages-section.test.tsx`                                 | усі N>5 мов без обрізання; відомий знаменник                                                                                                                       |
| вузький наявний тест або `tastes/discoveries-section.test.tsx`      | uk/en plural та новий підпис; без зміни значень                                                                                                                    |

Не редагувати `overview/statistics-overview.test.tsx` без реальної зміни інтеграційної поведінки. Старі тести на `NO_RATINGS`, `all_time`, URL, calendar, habits не переписувати. Для 20 buckets, **лише якщо змінюється distribution renderer**, створити локальні тестові дані, а не змінювати `overviewFixture()` глобально. Unit-тести CSS-класів не видавати за реальний браузерний responsive-тест.

Наприкінці один `/spec-to-ship` VERIFY за `tasks.json` та **A01–A19**: кожну вимогу позначити `DONE` / `ALREADY_DONE` / `DEFERRED` / `BLOCKED`, зазначити конкретний diff/proof. Сформувати `docs/specs/statistics-tastes/verify-report.md`; відсутність виконаних gates / UI runtime позначити `NOT_VERIFIED`, не «PASS».

## 5. Acceptance A01–A19 (перевірити, не створювати 19 нових задач)

| ID  | Перевірка                                                          | ID  | Перевірка                                                                         |
| --- | ------------------------------------------------------------------ | --- | --------------------------------------------------------------------------------- |
| A01 | 6 секцій, порядок, all_time без discoveries                        | A02 | завершені цикли, рейтинг 0,5–10                                                   |
| A03 | усі 20 buckets **коли ratings доступні**; unavailable без графіка  | A04 | topRated дата з роком + rating, reread окремо                                     |
| A05 | default/recent `CompletedReadCard`, details/focus без регресій     | A06 | rated `scaleMax=10`, `/10`; frequency від peak                                    |
| A07 | backend порядок, пороги 3/2, top-4 і top-5 там, де він є           | A08 | мови N>5: mobile 3→N, desktop усі N                                               |
| A09 | довгі назви повні на touch, keyboard, screen reader                | A10 | лише точні context actions; unsupported не клікабельний                           |
| A11 | 8+ серед rated, top-3 publisher серед known, language серед known  | A12 | coverage без дубльованих чисел, пояснення неповноти                               |
| A13 | один компактний KPI мов, джерело/coverage збережені                | A14 | uk/en discoveries: за період, включно з першим, plural                            |
| A15 | legacy/partial/unavailable/insufficient/empty не маскуються 0      | A16 | глобальні URL, KPI→ratings, activity/calendar/habits без регресій                 |
| A17 | uk/en, ARIA, responsive, light/dark без регресій                   | A18 | нуль контрактних змін; local modes без нових залежних fetch; useGenres збережений |
| A19 | тільки необхідні тести написані; gates відкладені; без commit/push |     |                                                                                   |

## 6. Файлові межі та виконання Claude Code

**Дозволений diff, тільки за конкретним `REQUIRED`:** `apps/web/src/features/statistics/components/tastes/{ratings-section,rating-distribution,taste-ranking-list,genres-section,authors-section,publishers-section,languages-section,discoveries-section}.tsx`; `apps/web/src/features/statistics/components/completed-read-card.tsx` **тільки** для optional prop дати; вузькі сусідні `*.test.tsx`; `apps/web/src/messages/{uk,en}.json` (тільки зачеплені ключі); `docs/specs/statistics-tastes/{spec.md,tasks.json,verify-report.md}` й обов'язкові документи `/spec-to-ship`.

**Заборонено змінювати:** `apps/api/**`, `packages/shared/**`, Prisma, generated/Orval, залежності/lockfile, загальні UI/shadcn, global styles/theme, navigation/URL model, `components/reading/**`, `components/progress/**`, `components/overview/statistics-overview.tsx`, будь-яку логіку «Огляду»/«Активності»/«Прогресу»; глобальні fixtures без реальної потреби. Якщо потрібен заборонений контракт — **BLOCKED** із мінімальною альтернативою, без самовільного розширення.

**Один процес, не два:** `/spec-to-ship` Stage 0–3 = **P0**, Stage 4–5 = **P1→P3** із належними review та делегуванням, Stage 6 = **P4**, Stage 7 = **DEFERRED / CI-only**, Stage 8 = **звіт**. `/unlazy` — контроль повноти _цих самих_ блоків, а не другий окремий цикл. Виконувати автоматично, без рутинного «продовжуй»; не пропускати обов'язкові `spec-auditor` PLAN/VERIFY, `code-reviewer`, UI/a11y review та hooks згідно актуального `CLAUDE.md`. Один self-contained task slice з `files`/`doneWhen` на агента; обмеження паралельності й no-tooling для subagent — за `CLAUDE.md`. Без циклічного перепрочитування repo чи подвійних аудитів.

**Gates:** `CLAUDE.md` §9 забороняє під час розробки запускати локальні `vitest`/`pnpm test`, ESLint, prettier, typecheck, `/check`, `gates.sh`, build, knip, E2E. Писати тести, але **нічого з цього не запускати** без моєї окремої команди «перевір/commit/push»; Stage 7 лише `DEFERRED / CI-only`. Не вимикати hooks і не приховувати їхню дію. Дозволено лише безпечні `git status`/`diff` і читання коду; вузька UI-перевірка — тільки коли середовище вже працює та цього вимагає чинне правило, інакше `NOT_VERIFIED`. Жодних автоматичних `commit`, `push`, PR, merge, deploy, API-generation.

**Фінальний звіт:** короткий `Blocks: met/total, Missing`, статуси `DONE` (доказ diff), `ALREADY_DONE` (підтвердження коду), `DEFERRED` (гейти/CI/browser), `BLOCKED` (реальний блокер); які файли змінені, які вузькі тести написані **але не запущені**, що не перевірено, які критерії A01–A19 підтверджені статично. Не казати «тести пройшли» без запуску. Якщо виник блокер, виконати решту незалежних безпечних задач і описати незавершене. Жодного commit/push.
