# BOOK NEST · Статистика · Етап 04

## Фінальний міжвкладковий UX/UI, контрактний та технічний аудит — ТЗ v1

**Статус:** підготовлене ТЗ, ще НЕ запущене в Claude Code. **Дата аудиту:** 20.10.2026.  
**Репозиторій:** `Srh-Yakovenko-ua/book-nest`. **Перевірений HEAD `dev`:** `af00c4fe1317b6e5102c7f03f7a7e90e972266a1` (merge PR #298, етап 03).  
**Попередня історія:** Огляд / Активність / Вподобання / Прогрес пройшли свої рефактори. Етап 01 (узгодженість scope, placeholder) та етап 02 (weekday activity, 12-місячна навігація календаря) інтегровані PR #297; етап 03 (точні деталізації частотних рейтингів) — PR #298.

**Головне правило:** етап 04 — НЕ новий рефакторинг чотирьох вкладок, а аудит після інтеграції. Реалізувати тільки дефекти, підтверджені тестом, трасуванням, вимірюванням або візуальною перевіркою. Якщо дефектів немає — сформувати фінальний звіт БЕЗ змін коду, БЕЗ формального коміту.

---

## 1. Мета та критерій завершення

1. Підтвердити, що чотири вкладки та їхні KPI, фільтри, часові періоди, drilldown, календар, цілі й рекорди працюють узгоджено; користувач розуміє, **що саме**, **за який період** і **наскільки надійно** виміряно.
2. Перевірити контрактну рівність: числа на екрані відповідають числам у відповіді API і фактичним спискам, які відкриваються з показників; порівняння не змішує різні періоди; дані поза вибраним періодом позначені як «поточний стан» або «за весь час».
3. Перевірити поведінку на мобільному/десктопі, доступність, loading/error/empty/partial і перемикання періоду під час відкритого drilldown.
4. Знайти **підтверджені** вузькі місця `StatisticsOverviewService.getOverview()` та розрахунків часових bucket-ів; змінити тільки там, де є доказ виграшу й сталі контрактні результати.
5. Закінчити коротким підсумковим звітом із PASS / DEFECT_FIXED / DEFERRED / NOT_VERIFIED для кожного сценарію та з обґрунтуванням будь-якої зміни.

**Out of scope:** створення нових вкладок, нових графіків, редизайн сторінки, нова аналітика, нові фільтри, розширення API для інших категорій рейтингу, переїзд на іншу архітектуру, новий кеш/черги/матеріалізовані уявлення, міграції без доведеного блокера, статистика доставок, персонажі, функції книг поза статистикою.

## 2. Preflight / безпечна робота

1. Один раз перевірити `git status --short`, гілку, актуальний `origin/dev` і фактичний базовий SHA. **Не повертатися до SHA з попередніх ZIP**, якщо `dev` уже новіша.
2. Бажаний каталог для продовження роботи: `D:\IT\book-nest\.claude\worktrees\statistics-progress`. **Використовувати його, якщо він наявний і безпечний. Не створювати новий worktree автоматично.** Перевірити поточну гілку / upstream; якщо є незакомічені зміни — не стирати, не робити hard reset і не перезаписувати. Не підміняти їх кодом `dev` без попереднього узгодження змін.
3. Файли `.claude`, кореневий `CLAUDE.md`, локальні правила роботи мають пріоритет для операцій з git. Не робити push/merge за замовчуванням.
4. Перевірити, які задачі вже виправлено після перевіреного HEAD, та **викреслити їх зі scope**. Не повторювати етапи 01–03.
5. Не запускати глобальні ESLint, typecheck, tests, build, Knip, E2E і форматування перед аудитом або між дрібними правками. Дозволені **вузькі діагностичні відтворення / заміри** лише там, де без цього не можна ухвалити рішення. Один фінальний цикл перевірок — у §9.

## 3. Уже добре працює — зберегти, не рефакторити

- **Чотири вкладки** `overview`, `activity`, `tastes`, `progress` та URL-state `tab`, `section`, `metric`, `calendarMode`, `calendarMonth`; переходи з KPI, Back/Forward.
- **Етап 01:** `StatisticsOverview` / `StatisticsScopeState`: `keepPreviousData` і `isPlaceholderData` відрізняються від поточного refetch; placeholder блокує інерційний старий екран через `inert` + візуальне повідомлення, controls зберігають працездатність; `suspendMonthNormalization` у календарі.
- **Етап 02:** `weekdayActivity` із серверною агрегацією, `ReadingWeekdayActivity`, `ReadingActivityHeatmap` і 12-місячні вікна для довгого custom; позначки фактично відображеного діапазону vs metricRange; режими «Активність / Книги за днями».
- **Етап 03:** точний subset API `GET /api/statistics/completed-reads/subset`, завершені цикли читання із snapshot, cursor із fingerprint user/period/filter, 20 записів, без дублів при повторних читаннях; спільні `CompletedReadsList`, `StatisticsDetailSurface`, nested mobile Drawer. **Тільки частотні рейтинги** жанрів/авторів/видавництв/мов клікабельні; rated, returning і discoveries — ні.
- **Прогрес:** наявні `ReadingGoalCard`, `SeriesSection`, `LibraryBalanceSection`, `RecordsSection`, ніяких нових KPI; інтерпретація цілей і балансу як **поточного стану**, навіть коли обрано історичний період; compact goal на Огляді лише для періоду, який включає поточний день.
- Серверні обмеження, частки, historical quality (`legacy_lower_bound`, `legacy_observed_only`), порожні/недоступні стани, i18n uk/en, 10-бальна шкала рейтингу, мобільне show-more; дотримуватися існуючих компонентів і схем.

## 4. P1 — перевірити контрактну рівність historical snapshot і subset SQL

**Підстава в коді:** `CompletedReadMapper.toCompletedRead` використовує `parseReadingCompletionSnapshot` (`ReadingCompletionSnapshotSchema` у `apps/api/src/modules/books/domain/reading-completion-snapshot.ts`). Якщо snapshot невалідний, mapper відкидає його метадані. Натомість `buildCompletedReadsSubsetCondition` у `StatisticsCompletionRepository` SQL перевіряє лише `version`, тип/значення `book.language`, `book.pagesCount` і шуканий атрибут. Інші перевірки Zod (зокрема `provenance`, структура `authors`, `book`, `publisher`, `series`) не повністю повторено. **Це перевірений статичний ризик, але не підтверджена помилка у користувацьких даних.**

**Діагностика (до правки):** створити точковий API integration regression test, що порівнює `overview` frequency count з `GET /completed-reads/subset`: валідні snapshots, автор/жанр/видавництво/мова, додатково вхід із некоректними `provenance`, `series`, `authors` або іншими полями при валідному фільтр-ключі; змішані valid+invalid. Виявити, чи виникає розбіжність. Не тестувати міграцію DB чи всі типи сміттєвих JSON без потреби.

**Тільки якщо тест довів проблему:** мінімально наблизити SQL predicate до фактичної схеми розбору та правил grouping або обрати інший DB-side вузький предикат, **без завантаження всіх читань у JS**, без зміни `ReadingCompletionSnapshotSchema`, без переписування статистики й без фальшивого заниження числа. Прикінцеві інваріанти: `row.completedReadCount === subset.totalCount`, сторінки перелічують рівно `totalCount` у stable keyset; усі tenant/user та soft-delete обмеження збережено. Якщо виправлення всіх malformed-data сценаріїв потребує окремої міграції/масштабного переписування, зафіксувати ризик, докази й окрему пропозицію, а НЕ розширювати етап 04.

**Не чіпати:** existing positive tests в `completed-reads-subset.controller.test.ts` (year/all_time/700days/cursor/ownership/trash/multi-author/multi-genre); лише доповнити потрібний кейс та вузький production patch.

## 5. P1/P2 — міжвкладкова семантика та URL-state (audit first)

Перевірка pairwise-матриці, без генерації сотень поєднань:

| ID  | Передумова / дія                                                                              | Очікувано                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| S01 | `year` → `last_12_months` → `custom` → `all_time`                                             | Дані відповідають поточним controls, старі результати не стають активними на placeholder                                      |
| S02 | Змінити рік або custom-range під час завантаження                                             | UI з `isPlaceholderData` недоступний для кліків, не створює старі drilldown; filter controls дієві                            |
| S03 | Back/Forward, deep link `?tab=activity&section=calendar&calendarMode=books&calendarMonth=...` | Стан відновлюється; некоректний місяць скидається **тільки за актуальною відповіддю**; query поза обраним періодом не заважає |
| S04 | Огляд KPI → Активність/Вподобання                                                             | `tab`,`section`,`metric` правильні; збережено `period/compare`, фокус/скрол і можливість повернутись                          |
| S05 | `compare=previous_period` / `same_period_last_year` та `all_time`                             | Порівняння узгоджене і правильно вимикається для all-time, не з'являються вигадані % для нуля                                 |
| S06 | Історичний рік → Прогрес                                                                      | Цілі та бібліотечний баланс явно **поточні**, тоді як series і records мають scope обраного періоду                           |
| S07 | Історичний рік → Вподобання                                                                   | Frequency subset використовує обраний період; `returning` окремо позначено «за весь час»                                      |
| S08 | Відкритий subset/Popover/Drawer → змінити period                                              | Старі деталі закриваються або ізольовані; не відправляється запит зі змішаними фільтром і періодом                            |
| S09 | Активність: custom > 1 рік та all-time                                                        | Heatmap перегортає 12-місячні вікна, але тижневі підсумки й KPI відображають metricRange; межі явно названі                   |
| S10 | Partial/unavailable/legacy/empty/error                                                        | Без «фальшивих нулів», lower-bound `≥` та unavailable підписи коректні, є recover/retry де потрібно                           |
| S11 | Змінити часовий пояс / неділя vs понеділок                                                    | today, boundaries, weekday distribution і calendar start не суперечать даним/налаштуванням                                    |
| S12 | Частотний рядок жанру/автора/видавництва/мови                                                 | `totalCount` і число на рядку збігаються; rated ranking/returning/discovery не стають неточними drilldown                     |

**Дія:** використовувати вже наявні `statistics-overview.test.tsx`, `use-statistics-params.test.tsx`, `statistics-period.test.ts`, `statistics-calendar.test.ts`, `taste-ranking-list.test.tsx` і API tests. Новий тест або мікропатч тільки за виявленої конкретної регресії. Не переписувати парсери URL, структуру вкладок, сторінку цілком.

## 6. P2 — доступність / responsive / дизайн без редизайну

**Репрезентативна візуальна перевірка:** 375px mobile, ~768px tablet, 1280px desktop; uk/en, light/dark лише для проблемних компонентів (не повний cross product). Сценарії:

- Довгі назви автора/жанру/серії, підписи KPI, dates, згорнуті `TasteRankingList`, grid колонок, без горизонтального overflow сторінки.
- Desktop Popover для subset: висота, внутрішня прокрутка, close/escape, фокус, порядок Tab, доступність незалежного secondary context link. Mobile nested Drawer для читання → деталь одного циклу: Escape/back, закриття вкладеного не закриває обидва, повернення focus.
- Стани initial loading, placeholder, refetch/error/empty/partial з screen reader semantics (`aria-busy`, `role`, підпис тригера), достатні клікабельні області та семантичні заголовки.
- Інформативні тексти межі даних, статичного global state, порівнянь; відсутність зсуву верстки при локалізації жанрів / зміні періоду.

**Якщо немає браузера / мобільного перегляду:** не встановлювати нову E2E framework; позначити `NOT_VERIFIED` й описати точні manual checks. Вносити стилістичні зміни лише для відтвореної проблеми й локально, без загального редизайну.

## 7. P2 — вимірювана продуктивність бекенду

**Підстава:** `StatisticsOverviewService.getOverview()` паралельно збирає багато незалежних розділів і завантажує **весь список finished cycles** за період через `findCompletedReads`. `ReadingCoreComposer.toBuckets()` та `StatisticsOverviewService.toMonthlyBuckets()` виконують `reads.filter` / `activity.filter` окремо для кожного bucket; складність приблизно `O(B × (R+A))`, де B — кількість інтервалів, R — finished cycles, A — активні дні. Це **видимі кандидати на оптимізацію**, не доказ повільного UI.

**Точні дії:**

1. Одна вузька діагностика на наявних локальних/тестових обсягах (малий рік, довгий custom, all_time; із compare і без) — без персональних даних і без нових інтеграцій. Фіксувати орієнтовний час `getOverview` та найдорожчих підрозрахунків, кількість DB запитів, розмір відповіді, B/R/A і середовище. Якщо обсяг даних мізерний, вказати, що профілювання не репрезентативне.
2. Якщо підтверджено матеріальне CPU навантаження саме на bucket-фільтрах — замінити повторні проходи **лише в цих функціях** на одноразову індексацію/агрегацію за датою/інтервалом. Не змінювати порядок, межі дат (inclusive), `uniqueBooksCompleted`, drilldowns, `weekStartDay`, частковість історії.
3. Порівняти конкретні API payload **до/після** або детерміновані golden fixtures: мають бути семантично еквівалентні. Показати зменшення часу на тому самому наборі даних. Якщо доказів немає — відкласти зміни (`DEFERRED`) і не переписувати алгоритми.
4. Не розбивати `GET /overview` на окремі endpoints, не додавати Redis/нові таблиці/індекси або кеш прогресу без окремого профілювання та ТЗ. Не вимикати секції для виграшу latency.

## 8. P2 — деталі, сумісність і безпека після PR #298

- Перевірити, що `GET /completed-reads/subset` і стара interval-ручка працюють незалежно та валідовують свої query; cursor старої ручки залишився сумісним.
- User isolation, finished state, soft-deleted book, 20/50 page size, keyset без повторів на однакових `finishedAt`, null-start all_time, custom до 1830 днів.
- `ReadingStatisticsCompletedReadsSubsetQuerySchema.strictObject`, помилкові фільтри / cursor → 400; нові Zod/Orval models відповідають current shared schema.
- Перевірити, що `StatisticsDetailSurface` reusable і не змінив поведінку деталей читання в chart buckets, day details та records.
- Не додавати «точну» деталізацію для rated/returning/discoveries, доки backend контракт не гарантує ідентичної популяції.

## 9. Правила виконання та фінальні перевірки (Claude Code)

### Фази, виконувати послідовно без погоджень

- **F0 preflight:** один локальний git/status/ref check, підтвердити наявні реалізації у dev; зберегти чужі зміни.
- **F1 аудит:** заповнити матрицю S01–S12, code-level інваріанти, P1 snapshot mismatch, UX і scoped performance observations. Категоризувати кожну знахідку: `PASS`, `DEFECT_CONFIRMED`, `RISK_UNVERIFIED`, `OUT_OF_SCOPE`.
- **F2 малі правки тільки `DEFECT_CONFIRMED`:** мінімальний патч, максимум перевикористання, 1–2 цільові регресійні тести на дефект. Не додавати нові компоненти без потреби.
- **F3 фінальний gate — ОДИН раз перед комітом:** `git diff --check`; relevant targeted tests, typecheck тільки зачеплених workspace-пакетів; ESLint/Prettier тільки змінених файлів; OpenAPI/codegen лише якщо реально мінявся API-контракт (за базовим scope не має). Якщо Docker/Postgres або браузер недоступні — не видавати `PASS`, а зафіксувати `NOT_VERIFIED` і причину.
- **F4 результат:** `docs/specs/statistics-final-audit/verify-report.md` (або компактний звіт поза git за правилами репозиторію) зі статусами, доказами й файлами. Один conventional commit лише якщо є виправлений код/потрібна документація; **ніякого порожнього коміту**. Не пушити й не merge в `dev`, поки користувач явно не дозволив.

Не запускати full monorepo lint/test/build/Knip, e2e, кілька послідовних перегенерацій API чи циклічне сканування всього репозиторію. Для perf діагностики дозволений один scoped запуск/контрольний запуск **лише якщо потрібен для рішення**, це не дозвіл запускати глобальні checks до фіналу.

### Мінімальний звіт для користувача

| ID             | Вердикт                            | Доказ/посилання на файл/тест або вимір | Внесені зміни | Що лишилося |
| -------------- | ---------------------------------- | -------------------------------------- | ------------- | ----------- |
| S01–S12        | PASS / DEFECT_FIXED / NOT_VERIFIED | ...                                    | ...           | ...         |
| P1 snapshot    | PASS / DEFECT_FIXED / NOT_VERIFIED | ...                                    | ...           | ...         |
| P2 UX          | PASS / DEFECT_FIXED / NOT_VERIFIED | ...                                    | ...           | ...         |
| P2 performance | PASS / OPTIMIZED / DEFERRED        | до/після і dataset                     | ...           | ...         |

До звіту додати список фактично запущених команд і результатів. Ніде не називати неперевірений тест успішним. Висновок: `READY`, `READY_WITH_NOT_VERIFIED`, або `BLOCKED` із конкретною причиною.

## 10. Entry points — вузький список

**Точки спільного керування / tests:**

- `apps/web/src/features/statistics/components/overview/statistics-overview.tsx`
- `apps/web/src/features/statistics/components/overview/statistics-overview-tab.tsx`
- `apps/web/src/features/statistics/components/overview/statistics-overview.test.tsx`
- `apps/web/src/features/statistics/model/{statistics-period.ts,use-statistics-params.ts,use-statistics-view.ts,statistics-scope-state.ts,statistics-drilldown.ts}`
- `apps/web/src/features/statistics/components/controls/statistics-period-controls.tsx`

**Вкладки і деталі:**

- `apps/web/src/features/statistics/components/reading/{reading-calendar-card.tsx,reading-activity-heatmap.tsx,reading-weekday-activity.tsx,reading-dynamics-card.tsx}`
- `apps/web/src/features/statistics/components/tastes/{taste-ranking-list.tsx,genres-section.tsx,authors-section.tsx,publishers-section.tsx,languages-section.tsx}`
- `apps/web/src/features/statistics/components/details/{statistics-detail-surface.tsx,statistics-subset-details.tsx,completed-reads-list.tsx,reading-bucket-details.tsx}`
- `apps/web/src/features/statistics/components/progress/{reading-goal-card.tsx,library-balance-section.tsx,series-section.tsx,records-section.tsx}`

**API і розрахунки:**

- `apps/api/src/modules/statistics/application/{statistics-overview.service.ts,reading-core.composer.ts,reading-interval-details.service.ts,completed-read.mapper.ts,statistics-tastes.composer.ts}`
- `apps/api/src/modules/statistics/infrastructure/statistics-completion.repository.ts`
- `apps/api/src/modules/books/domain/reading-completion-snapshot.ts`
- `apps/api/src/modules/statistics/api/{statistics.controller.ts,completed-reads-subset.controller.test.ts}`
- `packages/shared/src/{reading-statistics-intervals.ts,reading-statistics-common.ts,reading-statistics-tastes.ts}`

## 11. Готовність та межі рішення

**ТЗ готове для перевірки/запуску як фінального етапу.** Імплементація має бути _умовною_: за відсутності підтверджених проблем найкращий результат — якісний аудит без комітів. Після етапу 04 можна приймати рішення про закриття роботи над сторінкою «Статистика» або про **окремий** обґрунтований пакет оптимізації, якщо виміри доведуть необхідність.
