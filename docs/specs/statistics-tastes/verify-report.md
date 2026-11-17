# Звірка VERIFY: Статистика, вкладка «Вподобання»

- Base: `origin/dev` `13351f42b9f75126ad4bbc1f4a639de8930d8c31` (PR #294).
- Гілка: `feat/statistics-tastes-refactor`, worktree `D:\IT\book-nest\.claude\worktrees\statistics-tastes`.
- Дата: 2026-10-19.
- Стан: `HEAD` і локальний `origin/dev` дорівнюють base, нічого не закомічено. Робота лежить у незакомічених змінах і трьох нових тестових файлах.
- Звірено з `spec.md` і `tasks.json` (T1-T12, A01-A19). Diff узято з `git status --short`, `git diff --name-only` і `git diff` по одному файлу.

**Blocks: 12/12, Missing:** gates (typecheck, eslint, prettier), прогін тестів у CI, перевірки в браузері на 375 і 1280 у світлій і темній темі, вимір CLS, вирівнювання при `items-center`, перенесення назв на вкладці «Прогрес». Усе це NOT_VERIFIED, бо користувач заборонив запуск до окремої команди.

## Задачі

| ID  | Статус                       | Доказ                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | done                         | `completed-read-card.tsx:19,23` prop `showFinishedAt` з default `false`; `:29` умова `variant === "recent" \|\| showFinishedAt \|\| read.rating === null`; `:10,30-32` `formatDayLong` з `../model/statistics-format`, інакше `formatDayShort`; `:39` `dateTime` збережено; `:38` `flex-wrap gap-x-1.5 gap-y-0.5`; `:45-58` блок `StatisticsDetailSurface` без змін; `statistics-recent-reads.tsx` поза diff. |
| T2  | done                         | `ratings-section.tsx:88-91` `showFinishedAt`, ключ `readingCycleId`; `:52` `hint={t("highRatedHint")}`, `uk.json:9477`, `en.json:9477`; `:37` note без аргументів, `uk/en.json:9480` текст без чисел; `:43-69` три KPI без змін; `:22-32` і `:76` без змін.                                                                                                                                                   |
| T3  | done                         | `ratings-section.test.tsx:37-45` переписаний тест coverage; `:47-62` повне coverage без note; `:106-117` рік і `9/10`; `:119-143` два цикли з однаковою датою; `:145-166` картка без `showFinishedAt` (відсутність дати перевірено через текст, що рівнозначно відсутності `time`).                                                                                                                           |
| T4  | done                         | `taste-ranking-list.tsx:27-33` `scaleMax?: number`; `:37` `scaleMax ?? peak`; `:75` ширина; `:56-58` `min-w-0 break-words whitespace-normal` без `truncate`; `:61-70`, `:82-92`, `:97-117`, `:18-25` без змін; `components/progress/**` поза diff.                                                                                                                                                            |
| T5  | done                         | `genres-section.tsx:5,23,84-88` і `authors-section.tsx:5,24,84-88`: `scaleMax={BOOK_RATING.max}`, `valueLabel` через `statistics.ratings.scale`; частотні списки `genres :59-69`, `authors :61-69` без `scaleMax`. Єдиний новий hook це перекладач, якого вимагає сам критерій; нового запиту немає.                                                                                                          |
| T6  | done                         | `taste-ranking-list.test.tsx:50-78` шкала 80%, 100%, 50%; `:80-102` сім рядків, «Показати ще 4», `aria-expanded`; `:110-116` назва на 98 символів як текст; `:118-132` одна кнопка й одне посилання з `contextActions`.                                                                                                                                                                                       |
| T7  | done                         | `genres-section.test.tsx:116-134` і `authors-section.test.tsx:21-48`: «8,0 / 10» і ширина 80%; старі тести жанрів `:62-114` без змін.                                                                                                                                                                                                                                                                         |
| T8  | done                         | `publishers-section.tsx:54` `hint={t("concentrationHint")}`; `uk.json:9537`, `en.json:9537`; інших змін у файлі немає.                                                                                                                                                                                                                                                                                        |
| T9  | done (з відхиленням від IC3) | `languages-section.tsx:50` `<dl className="w-full sm:max-w-xs">`; `:40` `StatisticsNote` з `shareHint` лише коли `languages.items.length > 0`; `uk.json:9550`, `en.json:9550`; `:56-64`, `:39`, `:41`, `:22-32`, `:46-47` без змін. Критерій 2 у `doneWhen` (hint у KPI) замінено переглянутим IC3; вимога spec §4 P3 виконана.                                                                               |
| T10 | done                         | `languages-section.test.tsx:101-123` сім мов і «Показати ще 4»; `:125-134` note є, у жодному `dd` її немає, «66,7% відомих» є; `:136-142` без мов note немає; старі тести `:28-99` без змін.                                                                                                                                                                                                                  |
| T11 | done                         | `uk.json:9567` форми one/few/many/other «за період (включно з першим)»; `en.json:9567` one/other; змінено лише `afterDiscovery`; `discoveries-section.tsx` поза diff і читає ключ на `:120`.                                                                                                                                                                                                                  |
| T12 | done                         | `discoveries-section.test.tsx:45-53` uk 1, 2, 5; `:55-68` en 1, 2 під `NextIntlClientProvider` і `QueryClientProvider`; `:23-42` заглушка `/api/genres`; `:70-76` значення фікстури й середня оцінка збережені.                                                                                                                                                                                               |

`partial` і `missing` немає.

## Acceptance A01-A19

Вердикт стосується статичної частини. Те, що потребує запуску, винесено в останню колонку як NOT_VERIFIED.

| ID  | Вердикт                      | Доказ                                                                                                                                                                                                                                         | NOT_VERIFIED                                                                             |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A01 | ALREADY_DONE                 | `statistics-overview.tsx:195-213` порядок секцій, `:200,:205` `lg:grid-cols-2`, `:210-212` приховування для `all_time`; файл поза diff                                                                                                        | прогін `statistics-overview.test.tsx:220-232` у CI                                       |
| A02 | ALREADY_DONE                 | `ratings-section.tsx:89` ключ `readingCycleId`; `packages/shared/src/internal.ts:16-25` шкала 0,5-10                                                                                                                                          |                                                                                          |
| A03 | ALREADY_DONE                 | `rating-distribution.tsx:21-33` усі buckets, `aria-label` `:28-31`, `role="img"` `:33`; `ratings-section.tsx:22-32` unavailable без графіка; `reading-ratings.ts:54-56` 20 buckets з нулями; рендерер поза diff                               | щільність у браузері на 375                                                              |
| A04 | DONE                         | `completed-read-card.tsx:29-32,39`; `ratings-section.tsx:88-91`; тести `ratings-section.test.tsx:106-143`                                                                                                                                     | тести не запущені, вигляд картки                                                         |
| A05 | DONE                         | `completed-read-card.tsx:29` умова для recent і неоцінених; `:30-32` короткий формат без prop; `:45-58` без змін; тести `ratings-section.test.tsx:145-166` і наявний `statistics-overview.test.tsx:401-431`                                   | клавіатура, фокус, popover і drawer у браузері; вигляд recent-картки з `flex-wrap` (IC5) |
| A06 | DONE                         | `taste-ranking-list.tsx:37,75`; `genres-section.tsx:84-88`; `authors-section.tsx:84-88`; тести T6 і T7                                                                                                                                        | тести не запущені                                                                        |
| A07 | ALREADY_DONE                 | `reading-tastes.ts:7,9,11`; `statistics-tastes.composer.ts:44,66,142,199,235,269`; у `components/tastes/*.tsx` немає `slice(`, `.sort(`, `toSorted`, `.filter(`                                                                               |                                                                                          |
| A08 | ALREADY_DONE                 | `taste-ranking-list.tsx:16,47,82-92` без змін; `languages-section.tsx:56-64` усі мови; нові тести `taste-ranking-list.test.tsx:80-102`, `languages-section.test.tsx:101-123`                                                                  | 3 на мобільному і всі N на десктопі в браузері                                           |
| A09 | DONE                         | `taste-ranking-list.tsx:56-58` перенесення, назва як текст, нових фокусованих елементів немає; тести `:110-132`                                                                                                                               | touch, клавіатура, screen reader; вирівнювання на `:52`                                  |
| A10 | ALREADY_DONE                 | `taste-ranking-list.tsx:97-117` без змін; `statistics-drilldown.ts:17,25,68`; `authors-section.tsx:63` дії лише в частотних рядках; тест `taste-ranking-list.test.tsx:118-132`                                                                |                                                                                          |
| A11 | DONE                         | `ratings-section.tsx:52` і `uk/en.json:9477`; `publishers-section.tsx:54` і `:9537`; `languages-section.tsx:40` і `:9550`; бекенд `reading-ratings.ts:40`, `statistics-tastes.composer.ts:177,210`                                            |                                                                                          |
| A12 | DONE                         | `ratings-section.tsx:37`; `uk/en.json:9480` без чисел; тести `ratings-section.test.tsx:37-62`                                                                                                                                                 | тести не запущені                                                                        |
| A13 | DONE                         | `languages-section.tsx:50` один `dl` з обмеженою шириною; `:39` джерело і `:41` coverage збережені; тести `languages-section.test.tsx:125-142`                                                                                                | ширина KPI на 375 і 1280                                                                 |
| A14 | DONE                         | `uk/en.json:9567`; `discoveries-section.tsx:120` без змін; тести `discoveries-section.test.tsx:45-76`                                                                                                                                         | тести не запущені                                                                        |
| A15 | ALREADY_DONE                 | `ratings-section.tsx:22-32,46-47,55-56`; `genres-section.tsx:71-76`; `authors-section.tsx:71-76`; `languages-section.tsx:22-32,46-47`; `discoveries-section.tsx:44-50,60-61`; нова note мов прихована без рядків (`languages-section.tsx:40`) |                                                                                          |
| A16 | ALREADY_DONE                 | `statistics-view.ts:10,14,30-31,40-41,47-50`; `statistics-overview.tsx:196`; файлів `model/`, `controls/`, `overview/` у diff немає                                                                                                           | наявні тести огляду не перезапущені                                                      |
| A17 | DONE (лише статична частина) | кожен новий ключ є за тим самим шляхом в `uk.json` і `en.json` (`:9477`, `:9480`, `:9537`, `:9550`, `:9567`); нові класи лише layout-утиліти, кольори через семантичні токени; ARIA-атрибути не змінювались                                   | responsive 375/1280, світла й темна тема, CLS, перенесення на «Прогресі»                 |
| A18 | ALREADY_DONE                 | у diff немає `apps/api`, `packages/shared`, Prisma, generated, lockfile; один запит `statistics-overview.tsx:56`; `useGenreName` збережено (`genres-section.tsx:24`)                                                                          |                                                                                          |
| A19 | DONE                         | 3 нові й 3 оновлені тестові файли, кожен відповідає рядку таблиці P4; `HEAD` дорівнює base, commit і push не було                                                                                                                             | gates і тести в CI відкладено до команди користувача                                     |

Підсумок: DONE 10, ALREADY_DONE 9, DEFERRED 0, BLOCKED 0. Жоден рядок не означає PASS: нічого не запускалося.

## Змінені файли

Змінені:

- `apps/web/src/features/statistics/components/completed-read-card.tsx`
- `apps/web/src/features/statistics/components/tastes/ratings-section.tsx`
- `apps/web/src/features/statistics/components/tastes/taste-ranking-list.tsx`
- `apps/web/src/features/statistics/components/tastes/genres-section.tsx`
- `apps/web/src/features/statistics/components/tastes/authors-section.tsx`
- `apps/web/src/features/statistics/components/tastes/publishers-section.tsx`
- `apps/web/src/features/statistics/components/tastes/languages-section.tsx`
- `apps/web/src/features/statistics/components/tastes/ratings-section.test.tsx`
- `apps/web/src/features/statistics/components/tastes/genres-section.test.tsx`
- `apps/web/src/features/statistics/components/tastes/languages-section.test.tsx`
- `apps/web/src/messages/uk.json`
- `apps/web/src/messages/en.json`

Нові:

- `apps/web/src/features/statistics/components/tastes/taste-ranking-list.test.tsx`
- `apps/web/src/features/statistics/components/tastes/authors-section.test.tsx`
- `apps/web/src/features/statistics/components/tastes/discoveries-section.test.tsx`
- `docs/specs/statistics-tastes/spec.md`, `tasks.json`, `verify-report.md`

Усі файли входять до дозволеного списку spec §6. Каталоги повідомлень змінено лише в ключах `statistics.ratings.highRatedHint`, `statistics.ratings.coverage`, `statistics.publishers.concentrationHint`, `statistics.languages.shareHint`, `statistics.discoveries.afterDiscovery`, однаково в обох мовах.

## Дрейф

У production-коді дрейфу немає: кожен hunk відповідає задачі. Три тестові сценарії виходять за межі `doneWhen`, але кожен спирається на spec:

- `taste-ranking-list.test.tsx:104-108`: без кнопки «Показати ще», коли рядків не більше трьох (P2, mobile 3→N).
- `languages-section.test.tsx:136-142`: note про частки зникає без мов (переглянутий IC3).
- `discoveries-section.test.tsx:70-76`: суфікс середньої оцінки поруч із новим підписом (P4, «без зміни значень»).

`flex-wrap` у рядку дати діє для всіх варіантів картки. Це записаний вибір IC5, не дрейф.

## Рішення та відхилення

- **IC3 переглянуто.** Пояснення частки мов спершу було `StatisticsStat.hint` єдиного KPI. Після зауваження accessibility-аудиту воно стало `StatisticsNote` секції, бо в ролі `dd` KPI кількості мов текст описував частки рядків і структура не відповідала змісту (WCAG 1.3.1). Note показується лише коли `languages.items.length > 0`. Текст: uk «Частки рахуються серед читань із відомою мовою.», en «Shares are counted among reads with a known language.». Зміну і причину записано в `tasks.json` (IC3, поле `deviation` у T9).
- **IC6 прийнято.** `TasteRankingList` також рендерить `components/progress/series-section.tsx`, тож назви циклів на вкладці «Прогрес» тепер переносяться. Файли `progress/**` не змінювались.

## Тести написані, але НЕ запущені

- `apps/web/src/features/statistics/components/tastes/ratings-section.test.tsx` (оновлений)
- `apps/web/src/features/statistics/components/tastes/genres-section.test.tsx` (оновлений)
- `apps/web/src/features/statistics/components/tastes/languages-section.test.tsx` (оновлений)
- `apps/web/src/features/statistics/components/tastes/taste-ranking-list.test.tsx` (новий)
- `apps/web/src/features/statistics/components/tastes/authors-section.test.tsx` (новий)
- `apps/web/src/features/statistics/components/tastes/discoveries-section.test.tsx` (новий)

Жоден із них локально не запускався. Їх прожене CI, коли користувач дасть команду.

## NOT_VERIFIED

- Тести в CI: шість файлів вище й незмінений набір статистики, зокрема `overview/statistics-overview.test.tsx`.
- Браузер: вкладка «Вподобання» на 375 і 1280, світла й темна тема; довгі назви в рейтингах; рядок дати з роком у topRated; ширина KPI мов; розміщення нових підказок.
- CLS: назви жанрів змінюються з ключа на локалізовану назву після `/api/genres` і на 375 можуть тепер переноситися. Потрібен живий вимір.
- Вирівнювання: внутрішній рядок підпису в `taste-ranking-list.tsx:52` лишився `items-center`, тому при назві у два рядки порядковий номер і іконка дії стають по центру. Перевіряється лише візуально.
- Вкладка «Прогрес»: перенесення назв циклів (IC6).

## P0

`git fetch origin dev` виконано один раз на початку сесії, код виходу 0. Після нього `origin/dev` дорівнює `13351f42b9f75126ad4bbc1f4a639de8930d8c31`, тобто baseline зі spec. Worktree `.claude/worktrees/statistics-tastes` створено від нього на гілці `feat/statistics-tastes-refactor`, upstream знято.

## Gates

Гейти прогнано 2026-10-19 за командою «перевір». `bash .claude/scripts/gates.sh` проти `HEAD` перевірив 15 змінених файлів: typecheck ok, lint-web ok, format ok, код виходу 0. Шість пов'язаних тестових файлів скрипт лишив для CI.

## EXCLUDED

- Зауваження accessibility-аудиту низького рівня: `aria-label` тригера картки (`details/statistics-detail-surface.tsx:50` і `:70`, мітка з `completed-read-card.tsx:52`) перекриває видимі дату й оцінку. Воно існувало до цієї роботи, а spec §4 P1 забороняє змінювати деталі, popover, drawer, клавіатуру й фокус.
- Правки `rating-distribution.tsx`: проблему переповнення чи щільності не підтверджено.
- Правки `discoveries-section.tsx`: достатньо i18n.
- Обрізання поза рядками рейтингу (ім'я автора, що повертається, назва картки відкриття, назва в `CompletedReadCard`): поза межами P1, P2 і P3.
- Тест видавництв і правки `overview/statistics-overview.test.tsx`: spec P4 їх не вимагає.
- `apps/api/**`, `packages/shared/**`, Prisma, generated, залежності, `components/ui/**`, глобальні стилі, модель URL, `components/reading/**`, `components/progress/**`, `statistics-overview.tsx`, `statistics.fixtures.ts`: заборонені spec §6, і жодна вимога їх не потребує.

## Commit і push

Commit, push, PR, merge, deploy і генерацію API не виконували. Gates і тести чекають окремої команди користувача.
