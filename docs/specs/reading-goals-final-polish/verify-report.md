# Звірка VERIFY: фінальне шліфування цілей читання

- Base: `origin/dev` `7aeb25f4`, гілка `feat/reading-goals-final-polish`, worktree `reading-goals-polish`.
- Дата звірки: 2026-11-25T18:42:57Z.
- Контракт: `docs/specs/reading-goals-final-polish/tasks.json` (T01 до T24, A01 до A19). Набір змін узято з `git status --short` і `git diff --shortstat`: 39 tracked файлів (+1844 −313) і 14 нових файлів.
- Аудитор не запускав браузер, gates, тести, `/blast-radius` і `pnpm gen:api`. Це пункти T24 і EXTERNAL, вони позначені як pending, а не missing.

**Задачі: 24. done 23, blocked_on_access 1 (T02), partial 0, missing 0.** T24 закрито після звірки, результати в розділі «Приймання».

## Задачі

| ID  | Статус            | Доказ                                                                                                                                                                                                                                                                                |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T01 | done              | `reading-goal-sync.service.ts`, `reading-goal-activity.recorder.ts` і `scripts/backfill-reading-goal-ordinals.ts` не мають diff; нового тесту ordinals немає. Replay цілі 588e2d47 (main loop): одна запланована зміна, activity 911be6bd 1→2.                                       |
| T02 | blocked_on_access | Справжній `dry_run` на dev чекає ключа Hetzner (B1).                                                                                                                                                                                                                                 |
| T03 | done              | `packages/shared/src/reading-goals.ts:132-143`: query з необовʼязковим `deadline` і відповідь `{ bookCount, countedCount }`.                                                                                                                                                         |
| T04 | done              | `reading-goal-books.repository.ts:131-159`: ті самі умови циклу, що в `findSnapshotProgress`, `readerDaySql(now)`, обсяг списку з `deleted_at IS NULL` і `user_id`, Zod parse, без запису.                                                                                           |
| T05 | done              | `reading-goal-creation-preview.service.ts:29-54`: `assertOwned`, `calendar`, `assertFutureDeadline` лише для переданого дедлайну, `selectQualifyingReadingGoalBooks` з `resolveReadingGoalCountingEnd`. Транзакції й запису немає.                                                   |
| T06 | done              | `reading-goals.controller.ts:108-125`: `READ_THROTTLE`, `ZodQueryPipe`, повний Swagger, DTO в `input-dto/` і `view-dto/`.                                                                                                                                                            |
| T07 | done              | `reading-goals.controller.test.ts`, describe `GET /api/lists/:listId/goal/preview`: 16 тестів, серед них пояс попереду UTC, збіг із create і відсутність записів. `reading-goal-creation-preview.service.test.ts:70-118`. Прогін у CI pending.                                       |
| T08 | done              | Generated diff має лише додані рядки для `previewCreation`. Що їх створив саме `pnpm gen:api`, з diff не довести.                                                                                                                                                                    |
| T09 | done              | `api/use-goal-creation-preview.ts:17-28` (generated fetcher, Zod, ключ із фабрики, `staleTime: 0`); `goal-keys.ts:20-21`; `model/goal-form.ts:144-153`.                                                                                                                              |
| T10 | done              | `goal-creation-preview.tsx:18-47` (`role="status"`, 0 і помилка дають лише загальне правило); `goal-form-dialog.tsx:451-461` лише для create; `goal-form.ts:124-133`.                                                                                                                |
| T11 | done              | `goal-form-dialog.tsx:114-139`, `:170-180` (вихід через `useCloseGuard`); `goal-list-picker.tsx` (керований пошук, `returnListId`, фокус на опції або пошуку); каталог і головна передають `onChangeList`; `list-goal-card.tsx` без diff.                                            |
| T12 | done              | `goal-form-dialog.test.tsx` (8 тестів прогнозу, 5 тестів зміни списку); `goal-list-picker.test.tsx` «after a list change» (4, рендерить `GoalsCatalog`, погоджено); `list-goal-card.test.tsx`; `home-reading-goal.test.tsx`; `goal-form.test.ts`.                                    |
| T13 | done              | `model/goal-primary-action.ts:5-14`: `find` першої книги зі статусом reading у серверному порядку. Тести `:18`, `:34`, `:47`.                                                                                                                                                        |
| T14 | done              | `goal-progress-hero.tsx:56`, `:115-121`; `goal-hero-next-step.tsx:76-99` (Link на `/books/{id}` або кнопка зі спільним `showRemainingBooks`).                                                                                                                                        |
| T15 | done              | `goal-pace-figures.ts:25-47` (`resolveGoalPaceAdvice`, цілі дні, `<1` дає книги на день, `missing` дає `noData`); `goal-hero-next-step.tsx:28-58`. `hero.gap.*` немає в жодній локалі.                                                                                               |
| T16 | done (відхилення) | `model/goal-catalog-href.ts:17-34` і `model/use-goal-catalog-links.ts`. Використано в `goal-catalog-card.tsx:227`, `goals-overview-highlights.tsx:84`, `:149`, `goals-catalog.tsx:66`, `:110`. `createLoader` nuqs розбирає рядок без `?` (`node_modules/nuqs/dist/index.js:45-47`). |
| T17 | done (відхилення) | `goal-detail-header.tsx:48-60`: «Усі цілі» з відновленим каталогом. `GoalMeta` без змін. `goals.detail.back` видалено; `backToGoals` лишився, бо його читає `goal-details.tsx:75`.                                                                                                   |
| T18 | done              | `goal-details.test.tsx` (7 нових або переписаних тестів, обидві гілки дії, повернення до каталогу, некоректний стан); `goal-progress-hero.test.tsx:146-170` (таблиця порад, без дробових книг); `goal-pace-figures.test.ts`.                                                         |
| T19 | done              | `components/empty-state.tsx:18-40` (`xs` = `h-36`, 144 px; макети `inline` і `stacked`); `lib/empty-states.ts`. Нових PNG у diff немає.                                                                                                                                              |
| T20 | done              | `goals-catalog-content.ts` несе статус; `goals-catalog-view.tsx:32-37`, `:160-163` (`empty-search`, `xs`, `inline`). Перевірка «видно без прокручування» на 1280x800 pending у браузері.                                                                                             |
| T21 | done              | `goals-overview.tsx:71-82` (підпис і пояснення видимим текстом); `reading-goal-overview.service.ts` без diff.                                                                                                                                                                        |
| T22 | done              | `goals-catalog.test.tsx:170`, `:185` («0 із 2 цілей із підсумком»), `:201`, `:260`, `:268-270`, describe «return state».                                                                                                                                                             |
| T23 | done              | Набори ключів `goals.*` в uk і en збігаються (0 розбіжностей).                                                                                                                                                                                                                       |
| T24 | done              | `/blast-radius` по читанню, `gates.sh` зелений, цільові тести локально зелені, обидва проходи з «Приймання» виконано (див. нижче). CI на PR ще попереду.                                                                                                                             |

## Пункти ТЗ

| Пункт                                                    | Стан                     | Доказ                               |
| -------------------------------------------------------- | ------------------------ | ----------------------------------- |
| §1 dry_run і звіт по цілі                                | done / blocked_on_access | T01, T02                            |
| §1 логіку запису не змінювати без бага                   | done                     | sync і recorder без diff            |
| §2 «Змінити список», пошук і фокус, підтвердження виходу | done                     | T11, T12                            |
| §2 кількість одразу, висновок про виконання, 0, помилка  | done                     | T03 до T10                          |
| §2 чинні правила (день створення, дедлайн, архів)        | done                     | `reading-goals.service.ts` без diff |
| §3 одна основна дія біля прогресу                        | done                     | T13, T14                            |
| §3 природна порада без дробових книг                     | done                     | T15                                 |
| §3 «Усі цілі» з відновленням стану каталогу              | done                     | T16, T17                            |
| §4 компактний порожній стан і заголовки статусів         | done, браузер pending    | T19, T20                            |
| §4 знаменник успішності, формула без змін                | done                     | T21                                 |
| Приймання 1-3                                            | done                     | T24, розділ «Приймання»             |

## Drift (зміни, яких не просила жодна задача)

1. `goal-books-tab.tsx`: `focusListOnMount` замінено на `listFocusRequest` (лічильник) з `useEffect`. `goal-details-view.tsx` веде лічильник `listFocus`. Без цього кнопка в hero не повертала б фокус на вже відкриту вкладку «Книги». Зміну покриває тест у `goal-books-tab.test.tsx`. Регіон `section` рендериться завжди (`:105-110`), тому фокус не губиться під час завантаження.
2. `EmptyState`: макет `stacked` тепер обгортає текст у `div` з `display: contents`. Для інших викликів вигляд не змінюється, але DOM змінився.
3. `useGoalsQuery` більше не повертає `hasStatusFilter`; у `apps/web/src` інших читачів немає.
4. `resolveGoalPlanGap` і тип `GoalPlanGap` замінено на `resolveGoalPaceBadge` (погоджено після рев'ю).
5. uk `goals.form.preview.counted` відрізняється від тексту в T10 формою «її вже дочитано» для one. Це граматичне виправлення.
6. Кнопка основної дії в hero має `size="lg"` і `w-full` до `sm`. Це дизайнерське рішення, задача його не задавала.
7. Пояснення знаменника успішності стоїть приміткою під KPI-сіткою («Успішність: …», ключ `successRateNoteLabel`), а не всередині картки. Усередині картки воно розтягувало другий ряд KPI на 375 до 226 px проти 84 px першого. Підпис «N із M цілей із підсумком» лишився в картці.

## Приймання

Ізольовані дані: копія локальної БД `booknest_goals_polish`, API гілки на :4100, веб гілки на :3001, новий синтетичний користувач, список із двома книгами.

1. Ціль зі сторінки списку: «Змінити список» не показується, при нулі є лише загальне правило. Прогрес 0% → 50% → 100%; події «зараховано 1 із 2», «зараховано 2 із 2», «Ціль виконано». На 0% без книги в читанні дія «Переглянути книги цілі» відкрила «Книги» з фільтром «Ще не зараховані» і фокусом на регіоні «Книги цілі»; з книгою в читанні «Продовжити читання» веде на `/uk/books/0731c8e5…`. Порада: «дочитуйте приблизно 1 книгу кожні 3 дні», потім «кожні 4 дні». Для виконаної цілі ні поради, ні дії.
2. Наступна ціль того самого дня через каталог: форма показала нагадування про автоархів і «2 книги зарахуються одразу: їх уже дочитано сьогодні. Ціль одразу стане виконаною.»; при порозі 3 висновок зник, при 2 повернувся. «Змінити список» з чистою формою повернув пікер із пошуком «QA При» і фокусом на опції, зі зміненою формою спершу спитав «Відхилити зміни?», скасування повернуло фокус на «Змінити список». Після створення нова ціль одразу 100%: `book_counted` 1, `book_counted` 2, `goal_completed`; попередня ціль `archived` з результатом `completed` і видна в «Архіві».
3. Каталог `?status=archived&view=list` → картка → «Усі цілі» повернули той самий фільтр і вигляд; пряме відкриття деталей дає «Усі цілі» → `/uk/goals`.
4. Порожній відфільтрований стан на 1280x800: ілюстрація 144 px ліворуч від заголовка, низ «Показати всі цілі» на 743 px, KPI-картки по 114 px. На 375: ілюстрація над текстом, горизонтального скролу немає; форма на 375 без горизонтального скролу. Консоль каталогу й деталей без помилок.

## Помічене, не блокує

- low `goal-creation-preview.tsx:27`: після зміни дедлайну ключ запиту змінюється, і повідомлення зникає до відповіді, бо `placeholderData` немає. Неперевірених чисел це не показує, але текст блимає. (basis: smell)
- low `goal-pace-figures.ts:37`: порада у форматі «книги на день» має десяті частки («1,7 книги на день»). Це чинний формат темпу, не опис відставання. Вимоги §3 це не порушує. (basis: doc)

## NOT_VERIFIED

Після звірки виконано в main loop: `pnpm gen:api` (generated diff лише додає `previewCreation`), `/blast-radius` по читанню, `gates.sh` (typecheck, eslint, prettier зелені), цільові тести локально (web 15 файлів, 292 тести; API 2 файли, 114 тестів, на окремій БД `booknest_test_goalspolish`), приймання в браузері.

Лишилося:

- `CI`: повний прогін на PR у `dev`.
- `EXTERNAL: dry_run на dev` (T02): потрібен ключ Hetzner.
- Окремі заголовки «Архів порожній» і «Поки немає виконаних цілей» перевірено тестами `goals-catalog.test.tsx`; у браузері перевірено той самий макет зі статусом «Прострочені», бо в тестового користувача архів і виконані не порожні.
