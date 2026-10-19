<!-- Source: user message in the Claude Code session of 2026-10-18, copied verbatim below. Scope: the whole message, items 1-9 plus "Не чіпати" and "Перевірка". Reference implementation: the Notes tab, PR #284, docs/specs/book-notes-tab/ (spec.md, tasks.json decisions D1-D7 and assumptions, verify-report.md); repeat its approach and decisions unless this spec says otherwise. Branch feat/book-quotes-tab in .claude/worktrees/book-quotes-tab off origin/dev 6de68b54. -->

<!-- The pasted message lost a few words at line breaks. Each gap is marked [...] and followed by the reading adopted, in a separate note at the end. -->

# Book Details → Quotes tab

Перенеси цитати книги з блоку на Огляді в окрему вкладку «Цитати» на сторінці книги.
Працюй у новому worktree від актуальної dev.

Зразок: вкладка «Нотатки» (PR #284). Перед плануванням прочитай docs/specs/book-notes-tab/
(spec.md, tasks.json з рішеннями D1-D7 і assumptions, verify-report.md) і повтори той самий
підхід та ті самі рішення, якщо нижче не сказано інакше.

Що зробити, так само як у нотатках:

1. Вкладка «Цитати» одразу після «Нотатки». Бейдж показує quotesCount, який повертає лише
   GET /api/books/:id (розширити BookDetailsViewSchema). Списки бібліотеки його не отримують,
   а Огляд не робить жодного запиту за цитатами. Бейдж видно лише при count > 0.
2. Прибрати BookQuotesBlock з Огляду. BookQuotesBlock і useBookQuotes видалити, якщо в них
   не лишилось інших споживачів. Бекенд-роут GET /api/books/:bookId/quotes лишити, якщо він
   ще комусь потрібен.
3. Вкладку зібрати зі шматків архіву цитат: серверний пошук, швидкі фільтри, сортування,
   картки цитат. Без вибору книги чи автора, без сортувань book_title і book_author, без
   сайдбару, карток підсумків і перемикача grid/list. Одна колонк[...]
   назву книги, автора й обкладинку. Пагінація серверна, по 20, нескінченний скрол.
4. Пошук у вкладці шукає лише по тексту, коментарю, розділу й сто[...]
   книги та автора: необов'язковий параметр за зразком searchIn, без нього глобальний
   архів працює як раніше.
5. Стан у URL під ключами з префіксом quote\* (quoteQ, quoteFilter, quoteSort).
6. Перехід на іншу вкладку тієї ж книги і назад зберігає завантаж[...]
   картку. Відкриття іншої книги починається з дефолтів. Механіку брати з нотаток; спільний
   код виносити лише там, де це справді те саме знання.
7. Створення й видалення цитати інвалідують лише detail цієї книги. Усі, хто пише в кеш
   detail, зберігають quotesCount.
8. Спойлери лишаються під заглушкою, і пошук не розкриває їхній текст.
9. i18n uk і en, запис у changelog.

Не чіпати: глобальний архів цитат (крім параметра з п. 4), нотатк[...]
rediscovery блоки цитат.

Перевірка, як у нотатках: тести API і web для всього нового, регресія архіву цитат,
typecheck, lint, format:check, gen:api без диффу, живий прогін у[...]
(порядок вкладок, бейдж без запиту на Огляді, пагінація, повернення скролу, 390px, спойлер
у пошуку). Звіт: PASS / FAIL / NOT RUN по кожному пункту.

Відкриті питання збери в один блок на початку. Якщо зупиняти робо[...]
рекомендований варіант і записуй його як assumption. Наприкінці коміт, пуш і PR в dev

---

## Readings adopted for the gaps

- **Item 3:** "Одна колонка, картки без [...] назву книги, автора й обкладинку" is read as: a single column, and each quote card in the tab hides the book title, author and cover, the same as note cards in the Notes tab.
- **Item 4:** read as: search in the tab matches only the quote text, the comment, the chapter and the page, and does not match the book title or author.
- **Item 6:** read as: switching to another tab of the same book and back keeps the loaded pages, the scroll position and the top visible card, as in the Notes tab (#08). Corrected by decision D15: a quote card has no expanded state, the full text opens in a dialog.
- **"Не чіпати":** read as: the notes (the Notes tab and the notes archive), and the rediscovery quote blocks (quote of the day / random quote on the dashboard and similar).
- **Перевірка:** "живий прогін у [браузері]".
- **Closing paragraph:** read as: if stopping the work is not an option, pick the recommended variant and record it as an assumption. Open questions are listed once, at the start, and work proceeds on the recommendations without waiting. At the end: commit, push, and a PR into `dev`.
