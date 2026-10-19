# Звірка VERIFY: Статистика, вкладка «Прогрес»

- Base: `origin/dev` `69479f6a066fa0b4fcd7102cc8219878b44638a1` (PR #295).
- Гілка: `feat/statistics-progress-refactor`, worktree `D:\IT\book-nest\.claude\worktrees\statistics-progress`.
- Дата: 2026-10-19T16:33:43Z, точкова повторна звірка T7, R14, A17, F1 і F2 о 2026-10-19T16:36:19Z.
- Стан: `HEAD` дорівнює base, нічого не закомічено. Робота лежить у незакомічених змінах і чотирьох нових тестових файлах.
- Звірено з `spec.md` (R01-R20, A01-A24) і `tasks.json` (T0-T13, TA1-TA3, TX1-TX3). Набір змін узято з `git status --short`, `git diff --name-only`, `git diff --numstat`, `git diff` по файлах і `git ls-files --others --exclude-standard`.

**Blocks: 13 обов'язкових задач, 13 done, 0 partial, 0 missing.** **Missing:** лише запуски: тести в CI, gates, build, dev-server, браузер, a11y. Усе це NOT_VERIFIED, бо Stage 7 відкладено за вказівкою користувача.

## Набір змін

| Файл                                                   | Стан      | Рядки    |
| ------------------------------------------------------ | --------- | -------- |
| `components/progress/reading-goal-card.tsx`            | modified  | +53 -26  |
| `components/progress/series-section.tsx`               | modified  | +61 -28  |
| `components/progress/library-balance-section.tsx`      | modified  | +13 -17  |
| `components/progress/records-section.tsx`              | modified  | +11 -4   |
| `apps/web/src/messages/uk.json`                        | modified  | +22 -13  |
| `apps/web/src/messages/en.json`                        | modified  | +22 -13  |
| `components/progress/reading-goal-card.test.tsx`       | untracked | 216      |
| `components/progress/series-section.test.tsx`          | untracked | 221      |
| `components/progress/library-balance-section.test.tsx` | untracked | 154      |
| `components/progress/records-section.test.tsx`         | untracked | 243      |
| `docs/specs/statistics-progress/{spec.md,tasks.json}`  | untracked |          |
| `docs/specs/statistics-progress/verify-report.md`      | untracked | цей файл |

Префікс `components/` означає `apps/web/src/features/statistics/components/`. Інших шляхів немає: ні `apps/api`, ні `packages/shared`, ні Prisma, generated, `package.json`, lockfile, `.github`, `.claude`, ні `statistics-overview*.tsx`, `taste-ranking-list*`, спільних `statistics-*.tsx`, `features/reading-goals/**`, `components/ui/**`.

## Задачі

| ID  | Статус       | Доказ                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0  | ALREADY_DONE | `HEAD` і `origin/dev` дорівнюють `69479f6a`, гілка `feat/statistics-progress-refactor`; рядок про чистий `git status` замінено набором змін вище.                                                                                                                                                                                                                                                                      |
| T1  | done         | `reading-goal-card.tsx:226-229` `toDisplayPercent`; виклики `:58` (compact) і `:103` (full), інших `Math.round` немає; `:215-220` один `percent` для тексту, `Progress.value` і `progressLabel`; тести `reading-goal-card.test.tsx:146-182`.                                                                                                                                                                           |
| T2  | done         | `:85`, `:108` без `note`, підпис у `description` (`uk.json:9578`); `:112` `break-words` у full, `:69` `truncate` у compact; рядка статусу й `goals.status` немає; `:117`, `:175-191` `GoalPace` з `GOAL_SIGNAL_TONE.pace`, `null` дає `secondary` і `paceUnknown`; `:121-124`, `:133-138` `formatDateLong`; `:231-235` лише medium/high; `:47-51`, `:88-93`, `:147-173` без змін; compact змінено лише в `:58`, `:69`. |
| T3  | done         | `reading-goal-card.test.tsx:58-74` довга назва full і compact; `:76-107` статус, чотири темпи, `null`, compact без темпу; `:109-144` дати з роком і недоступний прогноз; `:146-182` 99% і 100%; `:184-209` CTA, інші цілі, `/goals/{goalId}`; `:211-215` підпис один раз.                                                                                                                                              |
| T4  | done         | `uk.json:9604` «за вибраний період»; `series-section.tsx:23-29` unavailable першим; `:31-41` один empty-state; `:155-169` частка і шкала лише для числа, `?? 0` немає; `:59-60`, `:94` порожній рейтинг і без марафону.                                                                                                                                                                                                |
| T5  | done         | `series-section.tsx:136-144` чотири KPI; `:145` `StatisticsNote` неадитивності лише в доступній гілці (`uk.json:9611`); `:124-131` причина без змін; `:57`, `:80` підписи (`uk.json:9622`, `:9625-9626` «Поступ у серіях»); `:62-89` без `scaleMax`, без сортування; `:51` сітка без змін.                                                                                                                             |
| T6  | done         | `series-section.test.tsx:64-84` zero і unavailable; `:86-107` none; `:109-136` legacy; `:165-220` note, заголовки, valueLabels, посилання, марафон.                                                                                                                                                                                                                                                                    |
| T7  | done         | `uk.json:9632` поточний стан; `library-balance-section.tsx:30` три KPI; `:39-52` нова назва, hint і `"—"` для `null`; `:25` оцінки немає лише за `unavailable` або `data === null`, `:55-69` причина біля KPI, інакше значення і hint; `uk.json:9640` «за останні 12 місяців»; нижньої note немає; `:26`, `:73-81` flow лише за `available`. F1 і F2 закрито.                                                          |
| T8  | done         | `library-balance-section.test.tsx:33-45` підпис і «87 із 186»; `:47-67` ratio і `null`; `:69-102` прогноз і 0 міс.; `:104-125` три причини в останніх двох `dd`, без `role="status"`; `:142-153` без flow.                                                                                                                                                                                                             |
| T9  | done         | `records-section.tsx:6`, `:42` опис з `RECORDS_LIMIT` (`uk.json:9650`); `:46-58` регіон без змін; `:224` `break-words` без `line-clamp-2`, `:166` `min-w-0`; `:128`, `:133` дві примітки `peak_month`; `:101-124`, `:140-151`, `:189-202` без змін.                                                                                                                                                                    |
| T10 | done         | `records-section.test.tsx:115-153` опис, порядок, довга назва, empty; `:155-207` peak month і streak; `:209-242` точні посилання, одна кнопка дня, решта некликабельна; `:84-95` `fetch` заглушено.                                                                                                                                                                                                                    |
| T11 | done         | Hunks обох каталогів лише в `:9577-9670`, тобто в `statistics.goal..statistics.records`. Ключі збігаються: goal 23/23, series 22/22, libraryBalance 14/14, records 19/19. Кожен `t()` має ключ, кожен ключ має виклик. Plural uk one/few/many/other, en one/other. У `.tsx` немає кирилиці й JSX-літералів.                                                                                                            |
| T12 | done         | Набір змін вище; нові імпорти лише `Badge`, `GOAL_SIGNAL_TONE`, `cn`, `formatDateLong`, `RECORDS_LIMIT`, `StatisticsNote` і типи; жоден новий рядок не дорівнює назві секції чи `statistics.states.lowerBound`.                                                                                                                                                                                                        |
| T13 | done         | Цей звіт і блок `verify` у `tasks.json`; commit, push, PR і merge не робились.                                                                                                                                                                                                                                                                                                                                         |
| TA1 | ALREADY_DONE | `statistics-overview.tsx:56`, `:215-220`, файл поза diff.                                                                                                                                                                                                                                                                                                                                                              |
| TA2 | ALREADY_DONE | `taste-ranking-list.tsx:16`, `:56`, файл поза diff.                                                                                                                                                                                                                                                                                                                                                                    |
| TA3 | ALREADY_DONE | `reading-goal-card.tsx:135-137`, `:231-235`; `series-section.tsx:23-29`, `:124-131`; `library-balance-section.tsx:43-44`; `records-section.tsx:101-124`, `:140-151`, `:189-202`.                                                                                                                                                                                                                                       |
| TX1 | EXCLUDED     | Жодного backend, contract, Prisma, generated, deps, CI чи hooks шляху в diff.                                                                                                                                                                                                                                                                                                                                          |
| TX2 | EXCLUDED     | Лише захищений рядок flow `library-balance-section.tsx:73-81`, без діаграми.                                                                                                                                                                                                                                                                                                                                           |
| TX3 | EXCLUDED     | Нічого не запускалось, див. NOT_VERIFIED.                                                                                                                                                                                                                                                                                                                                                                              |

## Рішення R01-R20

| ID  | Вердикт      | Доказ                                                                                                                                                                 |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | ALREADY_DONE | `statistics-overview.tsx:215-220`, поза diff                                                                                                                          |
| R02 | DONE         | `uk.json:9578`, `:9632` поточний стан; `:9604`, `:9650` вибраний період; `snapshotNote` і нижню note прогнозу прибрано                                                |
| R03 | DONE         | `reading-goal-card.tsx:112` full, `:69` compact                                                                                                                       |
| R04 | DONE         | статус прибрано; `reading-goal-card.tsx:117`, `:175-191`                                                                                                              |
| R05 | DONE         | `reading-goal-card.tsx:121-124`, `:133-138`                                                                                                                           |
| R06 | DONE         | `reading-goal-card.tsx:226-229`                                                                                                                                       |
| R07 | DONE         | `reading-goal-card.tsx:231-235`, `:135-137`; `uk.json:9598`                                                                                                           |
| R08 | DONE         | `series-section.tsx:136-145`; `uk.json:9611`                                                                                                                          |
| R09 | DONE         | `uk.json:9625-9626`; формула без змін `series-section.tsx:86-87`                                                                                                      |
| R10 | DONE         | `series-section.tsx:31-41`, `:155-169`                                                                                                                                |
| R11 | ALREADY_DONE | `series-section.tsx:124-131`                                                                                                                                          |
| R12 | DONE         | `uk.json:9632`; `library-balance-section.tsx:29`                                                                                                                      |
| R13 | DONE         | `uk.json:9635-9637`; `library-balance-section.tsx:39-52`                                                                                                              |
| R14 | DONE         | назва `uk.json:9638`; hint `uk.json:9640` «за останні 12 місяців» і майбутні покупки; причина біля KPI `library-balance-section.tsx:25`, `:55-61`; нижньої note немає |
| R15 | DONE         | `library-balance-section.tsx:26`, `:73-81`; backend поза diff                                                                                                         |
| R16 | DONE         | `records-section.tsx:42`, `:53-57`; `uk.json:9650`                                                                                                                    |
| R17 | DONE         | `records-section.tsx:224`, без tooltip; touch і клавіатура NOT_VERIFIED                                                                                               |
| R18 | DONE         | `records-section.tsx:128`, `:133`; `uk.json:9667-9668`                                                                                                                |
| R19 | ALREADY_DONE | `records-section.tsx:140-151`, `:189-202` без змін                                                                                                                    |
| R20 | NOT_VERIFIED | код: чотири тести, паритет uk/en, без hardcoded тексту; адаптивність, a11y і gates не запускались                                                                     |

Підсумок: DONE 16, ALREADY_DONE 3, NOT_VERIFIED 1.

## Acceptance A01-A24

Вердикт стосується коду. Те, що потребує запуску, винесено в останню колонку.

| ID  | Вердикт      | Доказ                                                                                    | NOT_VERIFIED                                                    |
| --- | ------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A01 | ALREADY_DONE | `statistics-overview.tsx:215-220`, поза diff                                             | `statistics-overview.test.tsx` не перезапущено                  |
| A02 | ALREADY_DONE | `statistics-overview.tsx:56`; нових hooks чи `fetch` немає                               | `statistics-overview.test.tsx:243-247` не перезапущено          |
| A03 | DONE         | `uk.json:9578`, `:9632`, `:9604`, `:9650`                                                |                                                                 |
| A04 | DONE         | `reading-goal-card.tsx:112`, `:69`; тест `:58-74`                                        | тест; перенесення на 375 і 1280                                 |
| A05 | DONE         | `reading-goal-card.tsx:121-124`, `:133-138`; тест `:109-134`                             | тест                                                            |
| A06 | DONE         | `reading-goal-card.tsx:117`, `:175-191`; тест `:76-107`                                  | тест; вигляд badge, контраст behind 4.23:1 (відоме, поза scope) |
| A07 | DONE         | `reading-goal-card.tsx:226-229`, `:215-220`; тест `:146-182`                             | тест                                                            |
| A08 | DONE         | `reading-goal-card.tsx:231-235`; `uk.json:9598`; тест `:136-144`                         | тест                                                            |
| A09 | ALREADY_DONE | `reading-goal-card.tsx:47-51`, `:88-93`, `:147-173` без змін; тести `:184-209`           | тести                                                           |
| A10 | DONE         | `series-section.tsx:31-41`; тест `:64-84`                                                | тест                                                            |
| A11 | DONE         | `series-section.tsx:155-169`, `:59-60`, `:94`; тест `:86-107`                            | тест                                                            |
| A12 | DONE         | `series-section.tsx:136-145`, `:124-131`; тести `:109-169`                               | тести                                                           |
| A13 | DONE         | `series-section.tsx:53-89`; `uk.json:9621-9627`; тести `:171-203`                        | тести                                                           |
| A14 | ALREADY_DONE | `series-section.tsx:43`, `:94-110` без змін; тест `:205-220`                             | тест                                                            |
| A15 | DONE         | `library-balance-section.tsx:29-37`; `uk.json:9632`; тест `:33-45`                       | тест; сітка на 375 і 1280                                       |
| A16 | DONE         | `library-balance-section.tsx:39-52`; `uk.json:9635-9637`; тести `:47-67`                 | тести                                                           |
| A17 | DONE         | `library-balance-section.tsx:25`, `:54-70`; `uk/en.json:9640`; тести `:69-125`           | тести                                                           |
| A18 | DONE         | `library-balance-section.tsx:26`, `:73-81`; api, shared, DTO поза diff                   |                                                                 |
| A19 | DONE         | `records-section.tsx:42`, `:53-57`; `uk.json:9650`; тести `:115-138`                     | тести                                                           |
| A20 | DONE         | `records-section.tsx:224`, `:166`; тест `:140-146`                                       | touch, mobile і desktop, відсутність горизонтального overflow   |
| A21 | DONE         | `records-section.tsx:125-136`, `:101-124`; тести `:155-207`                              | тести                                                           |
| A22 | ALREADY_DONE | `records-section.tsx:140-151`, `:189-202` без змін; тести `:209-242`                     | popover від 1024 і drawer нижче; тести                          |
| A23 | DONE         | чотири нові тестові файли; спільні компоненти поза diff                                  | прогін нових тестів і наборів overview та activity у CI         |
| A24 | DONE         | паритет 23/22/14/19, plural, без кирилиці й літералів у `.tsx`; NOT_VERIFIED сказано тут | gates і тести за задумом                                        |

Підсумок: DONE 19, ALREADY_DONE 5, BLOCKED 0. Жоден рядок не означає PASS: нічого не запускалося.

## Прогалини (закрито)

1. **F1, закрито.** `uk.json:9640` тепер каже «вперше дочитані за останні 12 місяців», як і `en.json:9640` «in the last 12 months».
2. **F2, закрито.** `library-balance-section.tsx:25` тепер `forecast.availability === "unavailable" ? null : forecast.data`: available або partial з даними показує значення і hint, а `"—"` з причиною лише за `unavailable` або `data === null` (spec P3, AD09). `flowCounts` на `:26` лишився з умовою `available` (IC8). Тести `library-balance-section.test.tsx` не змінювались і далі відповідають компоненту: `:69-88` available з даними, `:90-102` available з 0 місяців, `:104-125` unavailable з `data: null`. Гілку partial з даними тест не покриває, T8 цього не вимагає.

## Drift

- F2 закрито, див. «Прогалини (закрито)».
- `reading-goal-card.tsx:134` `text-right` на `dd` прогнозу: косметика під довший текст недоступного прогнозу.
- `statistics.goal.forecastUnavailable` переписано (`uk.json:9598`): підтримує R07.
- `series-section.tsx:156` текст `shareUnknown` став `text-muted-foreground`: косметика в межах T4.
- `library-balance-section.test.tsx:127-140` тест доступного flow поза списком T8, покриває IC8.

Поза межами §5 файлів немає. Змін i18n поза `statistics.goal`, `statistics.series`, `statistics.libraryBalance`, `statistics.records` немає. Видалені ключі `statistics.goal.snapshotNote`, `statistics.goal.status`, `statistics.libraryBalance.forecastPace` не згадуються ніде в `apps/web/src`.

## Зафіксовані рішення

- `GoalPace` рендериться окремим `<dl>` з `<dt>` темпу і `<dd>` з `Badge` (`reading-goal-card.tsx:179-189`), a11y-виправлення Slice A.
- Назву прогнозу змінено на «Непрочитаного вистачить приблизно на» / «Unread books will last about» (`uk.json:9638`, `en.json:9638`).
- `forecastHint` скорочено, en переписано на «Owned books first finished in the last 12 months: {rate} a month on average. Future purchases not counted.» (`en.json:9640`).
- `statistics.series.marathon` отримав plural для `{length}` (`uk.json:9628`, `en.json:9628`).
- `statistics.records.values.peakMonthDetail` отримав plural для `{pages}` (N7, `uk.json:9666`, `en.json:9666`); `records-section.tsx:130` передає число, `formatNumber` прибрано.

## Відоме поза scope, не виправлено

- (a) Warning `Badge` темпу behind у світлій темі має контраст 4.23:1 за виміром accessibility-auditor. Причина в глобальному токені `--warning` у `apps/web/src/styles/globals.css`, спільному з Reading Goals; файл поза межами §5.
- (b) `StatisticsNote` має `role="status"` (`statistics-states.tsx:62`) і стоїть на статичній note неадитивності (`series-section.tsx:145`). Спільний компонент поза scope, spec сама називає `StatisticsNote` для цієї note.
- (c) Рядок flow передає числа без розділювачів тисяч (`library-balance-section.tsx:75-79`). Так було й раніше, а backend завжди повертає flow unavailable (`statistics-library.composer.ts:26`).

## NOT_VERIFIED, за категоріями

**Тести в CI.** Чотири нові файли `components/progress/*.test.tsx` і наявні `statistics-overview.test.tsx`, `taste-ranking-list.test.tsx` та набори Activity як регресійний захист. Запуск лише після push, який користувач ще не дозволив.

**Локальні gates.** typecheck, eslint і prettier на diff через `bash .claude/scripts/gates.sh`; prettier також перевірить `tasks.json` і цей файл.

**Build.** `pnpm build` для web.

**Dev-server, браузер, viewport, a11y.** `pnpm dev:web`, `/uk/statistics?tab=progress` і `/en/...` на 375 і 1280 у світлій і темній темі: перенесення довгих назв, відсутність горизонтального overflow, вміщення badge темпу (N8), Tab по регіону рекордів і тригеру дня, popover від 1024 і drawer нижче, читання `GoalPace` і нотаток screen reader, контраст.
