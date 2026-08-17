import type { ChangelogCategory, Nullable } from "@app/shared";

import { parseISO } from "date-fns";

import { createLogger } from "../core/logger.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { createSeedClient } from "./seed-client.js";

const logger = createLogger("seed.changelog");

type ChangelogSeedEntry = {
  bodyEn: string;
  bodyUk: string;
  category: ChangelogCategory;
  publishedAt: string;
  slug: string;
  titleEn: string;
  titleUk: string;
  version: Nullable<string>;
};

const CHANGELOG_ENTRIES: ChangelogSeedEntry[] = [
  {
    bodyEn: "Pick book genres from a shared catalog and add your own custom ones.",
    bodyUk: "Обирайте жанри книг зі спільного каталогу та додавайте власні.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:25.000Z",
    slug: "genres",
    titleEn: "Genres",
    titleUk: "Жанри",
    version: null,
  },
  {
    bodyEn: "Upload and crop book covers to bring your library to life.",
    bodyUk: "Завантажуйте та обрізайте обкладинки книг, щоб бібліотека виглядала жваво.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:30.000Z",
    slug: "book-covers",
    titleEn: "Book covers",
    titleUk: "Обкладинки книг",
    version: null,
  },
  {
    bodyEn:
      "Rating stars now snap cleanly to half or full, and a duplicate series-part link opens the book's edit page.",
    bodyUk:
      "Зірки рейтингу тепер чітко фіксуються на половині або цілій зірці, а посилання на дубль частини серії відкриває сторінку редагування книги.",
    category: "fix",
    publishedAt: "2026-07-10T12:40:05.000Z",
    slug: "reading-polish",
    titleEn: "Rating and link fixes",
    titleUk: "Виправлення рейтингу та посилань",
    version: null,
  },
  {
    bodyEn:
      "Add books to your personal library, track reading statuses, and open a detailed page for each book.",
    bodyUk:
      "Додавайте книги до особистої бібліотеки, ведіть статуси читання та відкривайте детальну сторінку кожної книги.",
    category: "feature",
    publishedAt: "2026-06-30T00:00:00.000Z",
    slug: "book-library",
    titleEn: "My library and book page",
    titleUk: "Моя бібліотека та картка книги",
    version: null,
  },
  {
    bodyEn:
      "Every book now has a full page with reading progress, rating, cover, and one-click quick actions.",
    bodyUk:
      "Кожна книга тепер має повноцінну сторінку: прогрес читання, рейтинг, обкладинка та швидкі дії в один клік.",
    category: "feature",
    publishedAt: "2026-07-10T12:41:00.000Z",
    slug: "book-details",
    titleEn: "Detailed book page",
    titleUk: "Детальна сторінка книги",
    version: null,
  },
  {
    bodyEn: "Group books into series and track which part is next to read.",
    bodyUk: "Об'єднуйте книги в серії та стежте, яка частина наступна до прочитання.",
    category: "feature",
    publishedAt: "2026-07-03T00:00:00.000Z",
    slug: "series",
    titleEn: "Book series",
    titleUk: "Серії книг",
    version: null,
  },
  {
    bodyEn: "The reading-impression text limit is now 5000 characters.",
    bodyUk: "Ліміт тексту вражень від читання збільшено до 5000 символів.",
    category: "improvement",
    publishedAt: "2026-07-10T12:40:15.000Z",
    slug: "longer-impressions",
    titleEn: "Longer reading impressions",
    titleUk: "Довші враження від читання",
    version: null,
  },
  {
    bodyEn:
      "Plan your reading order: add books to a queue, reorder them, and start reading right from it.",
    bodyUk:
      "Плануйте порядок читання: додавайте книги в чергу, змінюйте послідовність і починайте читати прямо звідти.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:50.000Z",
    slug: "reading-queue",
    titleEn: "Reading queue",
    titleUk: "Черга читання",
    version: null,
  },
  {
    bodyEn: "Mark books as favorites and collect them on a dedicated favorites page.",
    bodyUk: "Позначайте улюблені книги та збирайте їх на окремій сторінці обраного.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:45.000Z",
    slug: "favorites",
    titleEn: "Favorites",
    titleUk: "Обране",
    version: null,
  },
  {
    bodyEn: "Keep track of books you lent out or borrowed, with a full loan history.",
    bodyUk: "Ведіть облік книг, які ви позичили комусь або взяли почитати, з історією позик.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:40.000Z",
    slug: "loans",
    titleEn: "Book loans",
    titleUk: "Позики книг",
    version: null,
  },
  {
    bodyEn: "Create your own book lists, add books to them, and arrange them however you like.",
    bodyUk: "Створюйте власні списки книг, додавайте до них книги та впорядковуйте на свій смак.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:55.000Z",
    slug: "custom-lists",
    titleEn: "Custom lists",
    titleUk: "Власні списки",
    version: null,
  },
  {
    bodyEn: "Follow app updates in the What's New feed, with an unread indicator.",
    bodyUk: "Слідкуйте за оновленнями застосунку у стрічці «Що нового» з позначкою непрочитаних.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:20.000Z",
    slug: "whats-new",
    titleEn: "What's New feed",
    titleUk: "Стрічка «Що нового»",
    version: null,
  },
  {
    bodyEn: "Track ordered books in transit, and review your delivery history and statistics.",
    bodyUk: "Відстежуйте замовлені книги в дорозі та переглядайте історію доставок і статистику.",
    category: "feature",
    publishedAt: "2026-07-10T12:40:35.000Z",
    slug: "delivery",
    titleEn: "Book deliveries",
    titleUk: "Доставки книг",
    version: null,
  },
  {
    bodyEn: "The series sequence on the book page now shows book covers.",
    bodyUk: "У розділі послідовності серії на сторінці книги тепер показуються обкладинки книг.",
    category: "improvement",
    publishedAt: "2026-07-10T12:40:10.000Z",
    slug: "series-book-covers",
    titleEn: "Covers in the series sequence",
    titleUk: "Обкладинки в послідовності серії",
    version: null,
  },
  {
    bodyEn:
      "Your library now shows books as poster-style cards — cover art with reading-status and ownership badges, quick actions, and genre chips.",
    bodyUk:
      "Бібліотека тепер показує книги як картки-постери: обкладинка з позначками статусу читання й власності, швидкі дії та чипи жанрів.",
    category: "improvement",
    publishedAt: "2026-07-11T06:00:00.000Z",
    slug: "library-cards-redesign",
    titleEn: "Refreshed library cards",
    titleUk: "Оновлені картки бібліотеки",
    version: null,
  },
  {
    bodyEn:
      "Filter your library with a rating range slider and multi-select pickers for authors, publishers, tags, and genres, then apply them together. Summary cards now surface extra stats like series and author counts and your current reading progress.",
    bodyUk:
      "Фільтруйте бібліотеку повзунком діапазону рейтингу та мультивибором авторів, видавців, тегів і жанрів, а потім застосовуйте їх разом. Картки підсумків тепер показують додаткову статистику: кількість серій та авторів і ваш поточний прогрес читання.",
    category: "improvement",
    publishedAt: "2026-07-12T06:00:00.000Z",
    slug: "library-filters-summary",
    titleEn: "Improved library filters and stats",
    titleUk: "Покращені фільтри та статистика бібліотеки",
    version: null,
  },
  {
    bodyEn:
      "Refreshed the empty-state illustrations across the app and added a localized page-not-found screen for unknown links.",
    bodyUk:
      "Оновили ілюстрації порожніх станів у застосунку та додали локалізовану сторінку, коли за посиланням нічого не знайдено.",
    category: "improvement",
    publishedAt: "2026-07-13T12:00:00.000Z",
    slug: "empty-states-refresh",
    titleEn: "Refreshed empty states and 404 page",
    titleUk: "Оновлені порожні стани та сторінка 404",
    version: null,
  },
  {
    bodyEn:
      "The book page now shows a reading-activity chart with key stats and a pace forecast, plus a full day-by-day history of your progress updates.",
    bodyUk:
      "Сторінка книги тепер показує графік активності читання з ключовою статистикою та прогнозом темпу, а також повну історію оновлень прогресу за днями.",
    category: "feature",
    publishedAt: "2026-07-16T00:00:00.000Z",
    slug: "reading-progress-history",
    titleEn: "Reading statistics and history",
    titleUk: "Статистика та історія читання",
    version: null,
  },
  {
    bodyEn:
      "Keep notes on your books and series — organize them by category, pin the important ones, mark favorites, and hide spoilers.",
    bodyUk:
      "Ведіть нотатки до книг і серій — впорядковуйте їх за категоріями, закріплюйте важливі, позначайте улюблені та ховайте спойлери.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:00.000Z",
    slug: "notes",
    titleEn: "Notes",
    titleUk: "Нотатки",
    version: null,
  },
  {
    bodyEn:
      "Save favorite quotes from your books with page references, mark the ones you love, and hide spoilers.",
    bodyUk:
      "Зберігайте улюблені цитати з книг із зазначенням сторінок, позначайте найкращі та ховайте спойлери.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:01.000Z",
    slug: "quotes",
    titleEn: "Quotes",
    titleUk: "Цитати",
    version: null,
  },
  {
    bodyEn:
      "Browse, search, and sort the dedications from your books, and mark the ones that stay with you.",
    bodyUk:
      "Переглядайте, шукайте та сортуйте присвяти з ваших книг і позначайте ті, що западають у душу.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:02.000Z",
    slug: "dedications",
    titleEn: "Book dedications",
    titleUk: "Присвяти книг",
    version: null,
  },
  {
    bodyEn:
      "Build a wishlist of books to buy, add store links with prices, and see the best current offer at a glance.",
    bodyUk:
      "Складайте список книг до купівлі, додавайте посилання на магазини з цінами та одразу бачте найкращу пропозицію.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:03.000Z",
    slug: "books-to-buy",
    titleEn: "Books to buy",
    titleUk: "Книги до купівлі",
    version: null,
  },
  {
    bodyEn:
      "Organize books with your own tags — create and edit them, give them colors, and see how often you use each one.",
    bodyUk:
      "Впорядковуйте книги власними тегами — створюйте й редагуйте їх, задавайте кольори та дивіться, як часто ви користуєтеся кожним.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:04.000Z",
    slug: "tags",
    titleEn: "Tags",
    titleUk: "Теги",
    version: null,
  },
  {
    bodyEn:
      "A new home page greets you after signing in — library summary cards, a deliveries widget, and an overview of your reading progress.",
    bodyUk:
      "Нова головна сторінка вітає вас після входу — картки підсумків бібліотеки, віджет доставок та огляд вашого прогресу читання.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:05.000Z",
    slug: "home-dashboard",
    titleEn: "Home dashboard",
    titleUk: "Головна панель",
    version: null,
  },
  {
    bodyEn:
      "Spot when series books sit out of order in your reading queue and fix the sequence with a one-click preview.",
    bodyUk:
      "Помічайте, коли книги серії стоять у черзі читання не за порядком, і виправляйте послідовність одним кліком із попереднім переглядом.",
    category: "feature",
    publishedAt: "2026-07-18T06:00:06.000Z",
    slug: "series-order-check",
    titleEn: "Series order check",
    titleUk: "Перевірка порядку серій",
    version: null,
  },
  {
    bodyEn:
      "When adding a book to the reading queue you can now set a priority reason and a target date, shown back on the book and in the queue.",
    bodyUk:
      "Додаючи книгу в чергу читання, тепер можна вказати причину пріоритету та цільову дату — вони показуються на книзі та в черзі.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:07.000Z",
    slug: "reading-queue-priority",
    titleEn: "Reading-queue priority",
    titleUk: "Пріоритет у черзі читання",
    version: null,
  },
  {
    bodyEn: "Assign several authors to a single book.",
    bodyUk: "Призначайте кілька авторів одній книзі.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:08.000Z",
    slug: "multiple-authors",
    titleEn: "Multiple authors",
    titleUk: "Кілька авторів",
    version: null,
  },
  {
    bodyEn: "Series now carry their own genres, just like books do.",
    bodyUk: "Серії тепер мають власні жанри, як і книги.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:09.000Z",
    slug: "series-genres",
    titleEn: "Series genres",
    titleUk: "Жанри серій",
    version: null,
  },
  {
    bodyEn: "Books marked 18+ now show an adult-content badge on cards and rows.",
    bodyUk:
      "Книги з позначкою 18+ тепер показують значок дорослого контенту на картках і в рядках.",
    category: "improvement",
    publishedAt: "2026-07-18T06:00:10.000Z",
    slug: "adult-age-badge",
    titleEn: "18+ age badge",
    titleUk: "Значок 18+",
    version: null,
  },
  {
    bodyEn:
      "Browse the publishers in your library with their ratings and purchases, open a page for each one, and manage your own custom publishers.",
    bodyUk:
      "Переглядайте видавництва своєї бібліотеки з їхніми рейтингами й покупками, відкривайте сторінку кожного та керуйте власними видавництвами.",
    category: "feature",
    publishedAt: "2026-07-24T00:00:00.000Z",
    slug: "publishers",
    titleEn: "Publishers",
    titleUk: "Видавництва",
    version: null,
  },
  {
    bodyEn:
      "Keep a cast of characters for each book — add them with roles, mark favorites, and hide spoilers.",
    bodyUk:
      "Ведіть список персонажів для кожної книги — додавайте їх із ролями, позначайте улюблених і ховайте спойлери.",
    category: "feature",
    publishedAt: "2026-07-24T00:00:01.000Z",
    slug: "characters",
    titleEn: "Characters",
    titleUk: "Персонажі",
    version: null,
  },
  {
    bodyEn:
      "Build a timeline of a book's key events to remember what happened, with support for several parallel timelines.",
    bodyUk:
      "Створюйте хронологію ключових подій книги, щоб пам'ятати, що сталося, з підтримкою кількох паралельних ліній.",
    category: "feature",
    publishedAt: "2026-07-24T00:00:02.000Z",
    slug: "book-timeline",
    titleEn: "Event timeline",
    titleUk: "Хронологія подій",
    version: null,
  },
  {
    bodyEn:
      "Your reading queue now shows summary cards and its total page volume, and you can filter it by status, format, genre, rating, and more.",
    bodyUk:
      "Черга читання тепер показує картки підсумків і загальний обсяг сторінок, а фільтрувати її можна за статусом, форматом, жанром, рейтингом та іншим.",
    category: "improvement",
    publishedAt: "2026-07-24T00:00:03.000Z",
    slug: "reading-queue-insights",
    titleEn: "Reading-queue insights and filters",
    titleUk: "Огляд і фільтри черги читання",
    version: null,
  },
  {
    bodyEn:
      "The series page now highlights read pages, your reading window, and favorite book in the series, plus genres, years, and publishers.",
    bodyUk:
      "Сторінка серії тепер показує прочитані сторінки, період читання й улюблену книгу серії, а також жанри, роки та видавництва.",
    category: "improvement",
    publishedAt: "2026-07-24T00:00:04.000Z",
    slug: "series-details-stats",
    titleEn: "Richer series details",
    titleUk: "Докладніша сторінка серії",
    version: null,
  },
  {
    bodyEn:
      "Get reminders about book returns and deliveries in the notification bell and by email. The bell now has two tabs: Reminders and What's New.",
    bodyUk:
      "Отримуйте нагадування про повернення книг і про доставки у дзвіночку сповіщень і на пошту. Дзвіночок тепер має дві вкладки: «Нагадування» і «Що нового».",
    category: "feature",
    publishedAt: "2026-07-31T00:00:00.000Z",
    slug: "reminders",
    titleEn: "Reminders",
    titleUk: "Нагадування",
    version: null,
  },
  {
    bodyEn:
      "A settings page is now available: turn loan and delivery emails on or off, choose how many days ahead to be reminded about a return, and set your time zone. You can also send yourself a test notification from there.",
    bodyUk:
      "З'явилася сторінка налаштувань: вмикайте листи про позики та доставки, задавайте, за скільки днів нагадувати про повернення, і обирайте свій часовий пояс. Звідти ж можна надіслати собі тестове сповіщення.",
    category: "feature",
    publishedAt: "2026-07-31T00:00:01.000Z",
    slug: "settings",
    titleEn: "Settings",
    titleUk: "Налаштування",
    version: null,
  },
  {
    bodyEn:
      "An uploaded cover now appears in your library by itself as soon as it is ready, without reloading the page.",
    bodyUk:
      "Завантажена обкладинка тепер з'являється в бібліотеці сама, щойно буде готова, без перезавантаження сторінки.",
    category: "improvement",
    publishedAt: "2026-07-31T00:00:02.000Z",
    slug: "live-cover-updates",
    titleEn: "Covers without a reload",
    titleUk: "Обкладинки без перезавантаження",
    version: null,
  },
  {
    bodyEn:
      "The series list is rebuilt: switch between grid and list views, narrow things down with advanced filters and see the matching count with active-filter chips, and let the sidebar point out the series that need attention. Cards now carry a cover fan, clearer progress, and a badge showing whether you already own the next book.",
    bodyUk:
      "Список серій оновлено: перемикайтеся між сіткою та списком, звужуйте добірку розширеними фільтрами й бачте кількість результатів із чипами активних фільтрів, а бічна панель підкаже серії, які потребують уваги. На картках тепер віяло обкладинок, зрозуміліший прогрес і позначка, чи наступна книга вже у вас.",
    category: "improvement",
    publishedAt: "2026-08-05T00:00:00.000Z",
    slug: "series-list-overhaul",
    titleEn: "A rebuilt series list",
    titleUk: "Оновлений список серій",
    version: null,
  },
  {
    bodyEn:
      "The dedications page got a rework: summary cards at the top, a compact list view next to the cards, and a new flow to add a dedication by picking the book it belongs to.",
    bodyUk:
      "Сторінку присвят перероблено: картки підсумків угорі, компактний вигляд списком поруч із картками та новий спосіб додати присвяту, обравши книгу, якій вона належить.",
    category: "improvement",
    publishedAt: "2026-08-05T00:00:01.000Z",
    slug: "dedications-revamp",
    titleEn: "Dedications, reworked",
    titleUk: "Присвяти, оновлено",
    version: null,
  },
  {
    bodyEn:
      "Your lists now open with summary cards: how many lists you keep, how many distinct books they hold, the average and largest list, and how many books sit in more than one list. The sidebar points out the lists that need attention, and sort labels now read the same way across lists and series.",
    bodyUk:
      "Списки тепер відкриваються картками підсумків: скільки у вас списків, скільки різних книг вони містять, середній і найбільший список, а також скільки книг потрапило одразу в кілька списків. Бічна панель підкаже списки, які потребують уваги, а підписи сортування тепер однакові для списків і серій.",
    category: "improvement",
    publishedAt: "2026-08-05T00:00:02.000Z",
    slug: "lists-summary-overview",
    titleEn: "Lists at a glance",
    titleUk: "Списки з першого погляду",
    version: null,
  },
  {
    bodyEn:
      "The whole app is rebuilt for small screens. Book cards sit two per row in the grid and turn into compact rows in list view, the toolbar folds into a single row with icon-only filters and a bottom-sheet sort picker, and the desktop sidebars step aside. The same pattern now covers the library, favorites, series, dedications, the reading queue, lists, loans, deliveries, quotes, notes, books to buy, publishers, genres and tags, and the home page.",
    bodyUk:
      "Увесь застосунок перебудовано під малі екрани. Картки книг стоять по дві в ряд у сітці й перетворюються на компактні рядки у вигляді списку, панель інструментів згортається в один рядок із фільтрами-іконками та вибором сортування знизу, а бічні панелі відступають. Той самий підхід тепер охоплює бібліотеку, обране, серії, присвяти, чергу читання, списки, позики, доставки, цитати, нотатки, книги до купівлі, видавництва, жанри й теги та головну сторінку.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:00.000Z",
    slug: "mobile-redesign",
    titleEn: "Book Nest on a phone",
    titleUk: "Book Nest на телефоні",
    version: null,
  },
  {
    bodyEn:
      "Statistics and the side blocks no longer trail the end of the page on a phone. Every list page now has an overview button that opens a full-screen panel with tabs: detailed stats, top genres and tags, recently added, and whatever else that page keeps in its sidebar. It closes with the button, Escape, a tap outside, or the system Back button.",
    bodyUk:
      "Статистика та бічні блоки більше не тягнуться в кінці сторінки на телефоні. Кожна сторінка зі списком тепер має кнопку огляду, яка відкриває повноекранну панель із вкладками: детальна статистика, топ жанрів і тегів, нещодавно додані та все інше, що сторінка тримає в бічній панелі. Панель закривається кнопкою, клавішею Escape, дотиком поза нею або системною кнопкою «Назад».",
    category: "feature",
    publishedAt: "2026-08-07T00:00:01.000Z",
    slug: "mobile-overview-panel",
    titleEn: "Page overview on mobile",
    titleUk: "Огляд сторінки на телефоні",
    version: null,
  },
  {
    bodyEn:
      "The book page reflows on small screens: statuses and the favorite and menu buttons move to their own row above the title, the title takes the full width, the cover shrinks, and the dedication and genres run underneath. Tags show four at a time with a chip that reveals the rest, and quick info and statuses sit under the header instead of in a sidebar.",
    bodyUk:
      "Сторінка книги перебудовується на малих екранах: статуси та кнопки обраного й меню переходять в окремий рядок над назвою, назва займає всю ширину, обкладинка зменшується, а присвята та жанри йдуть нижче. Теги показують по чотири з чипом, який розкриває решту, а швидка інформація та статуси стають під шапкою замість бічної панелі.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:02.000Z",
    slug: "book-page-mobile",
    titleEn: "The book page on a phone",
    titleUk: "Сторінка книги на телефоні",
    version: null,
  },
  {
    bodyEn:
      "Your lists page now works like the library: search, sort, a filter sheet for fill, description, size and attention, and every applied filter shown as a chip you can remove. Switch between grid and list view, and load more lists as you go instead of waiting for all of them. Filtering and counting now happen on the server, so the attention numbers cover your whole library rather than the part already loaded, and a book in the trash no longer keeps a list in the wrong size bucket.",
    bodyUk:
      "Сторінка списків тепер працює як бібліотека: пошук, сортування, панель фільтрів за наповненням, описом, розміром і увагою, а кожен застосований фільтр показано чипом, який можна зняти. Перемикайтеся між сіткою та списком і довантажуйте наступні списки замість очікування всіх одразу. Фільтрація та підрахунок тепер відбуваються на сервері, тож числа про увагу охоплюють усю бібліотеку, а не лише завантажену частину, а книга в кошику більше не тримає список у неправильному діапазоні розміру.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:03.000Z",
    slug: "lists-filters-view-mode",
    titleEn: "Filters and a list view for your lists",
    titleUk: "Фільтри та вигляд списком для ваших списків",
    version: null,
  },
  {
    bodyEn:
      'The buy list is now called the wishlist everywhere, and the ownership status reads "On the wishlist" so the label names the page it feeds. More importantly, the shop and price you enter when adding a book are finally saved where the wishlist reads them — until now they were written somewhere the page never looked, so the offer you typed simply never appeared. Shop and link now go together, and re-entering an offer for the same shop updates the price instead of failing.',
    bodyUk:
      "Список покупок тепер усюди називається списком бажань, а статус володіння читається як «У списку бажань», тож підпис називає сторінку, на яку веде. Головне ж інше: магазин і ціна, які ви вводите, додаючи книгу, нарешті зберігаються там, звідки їх читає список бажань — досі вони потрапляли туди, куди сторінка не дивиться, і введена пропозиція просто не з'являлася. Магазин і посилання тепер вводяться разом, а повторна пропозиція для того самого магазину оновлює ціну замість помилки.",
    category: "improvement",
    publishedAt: "2026-08-07T00:00:04.000Z",
    slug: "wishlist-store-links",
    titleEn: "The wishlist keeps where to buy",
    titleUk: "Список бажань запам'ятовує, де купити",
    version: null,
  },
  {
    bodyEn:
      "The wishlist now remembers the day a book landed on it, and four cards above the list turn that into a picture: how many books you want, how many arrived in the last month, how many fill a gap in a series you already own part of, how many continue one past your last part, and how many have been waiting longer than six months. Sorting by date follows the same rule, so a book you have owned for a year but only wanted since yesterday no longer pretends to be the oldest wish on the list.",
    bodyUk:
      "Список бажань тепер памʼятає день, коли книга до нього потрапила, а чотири картки над списком складають із цього картину: скільки книг ви хочете, скільки додано за останній місяць, скільки закривають пропуск у серії, частину якої ви вже маєте, скільки продовжують серію далі за вашу останню частину і скільки чекають довше за шість місяців. Сортування за датою тепер працює за тим самим правилом, тож книга, яка рік стоїть у бібліотеці, а в списку бажань лише з учора, більше не вдає найдавніше бажання.",
    category: "improvement",
    publishedAt: "2026-08-10T00:00:00.000Z",
    slug: "wishlist-entry-date-counts",
    titleEn: "The wishlist counts what you are waiting for",
    titleUk: "Список бажань рахує, чого ви чекаєте",
    version: null,
  },
  {
    bodyEn:
      "You can now set a goal to read a set number of books from one of your lists by a date you choose. The list itself shows a card with how far along you are, the goal page lists the books that count toward it, and progress follows what you actually read instead of waiting to be updated by hand. A goal can be edited, archived or deleted at any time, and since a list holds one open goal, archiving the current one frees the slot for the next.",
    bodyUk:
      "Тепер ви можете поставити ціль: прочитати певну кількість книг з одного зі своїх списків до обраної дати. На самому списку з'являється картка з тим, наскільки ви просунулися, а на сторінці цілі видно книги, які до неї зараховуються, і поступ рахується з того, що ви читаєте, а не з ручних позначок. Ціль можна змінити, заархівувати або видалити будь-коли, а оскільки список тримає одну відкриту ціль, архівування звільняє місце для наступної.",
    category: "feature",
    publishedAt: "2026-08-10T00:00:00.000Z",
    slug: "reading-goals",
    titleEn: "Reading goals",
    titleUk: "Цілі з читання",
    version: null,
  },
  {
    bodyEn:
      "The page of a single list now carries a sidebar with what the list is about, what you are currently reading from it, related lists and summary numbers. Quick tabs and advanced filters tell you how many books sit behind each value before you pick it, books can be dragged into the order you want, several books can be selected at once and handled together or removed in one go, a whole list can be duplicated, and every book row has a menu with the next sensible step for it.",
    bodyUk:
      "Сторінка окремого списку тепер має бічну панель: про що цей список, що ви зараз із нього читаєте, споріднені списки та підсумкові цифри. Швидкі вкладки й розширені фільтри показують, скільки книг стоїть за кожним значенням ще до вибору, книги можна перетягувати в потрібному порядку, обирати кілька одразу й виконувати дію для всіх обраних, зокрема прибирати їх зі списку, дублювати весь список, а меню біля кожної книги пропонує наступну доречну дію.",
    category: "improvement",
    publishedAt: "2026-08-10T00:00:01.000Z",
    slug: "list-details-overhaul",
    titleEn: "The list page, rebuilt",
    titleUk: "Оновлена сторінка списку",
    version: null,
  },
  {
    bodyEn:
      "Alphabetical lists now sort by Ukrainian rules, so І sits between З and Й, Є comes after Е, and Ґ right after Г. Before this, І and Є jumped to the top of the list ahead of А and Ґ fell to the very bottom after Я, which you could see in the library, the wishlist, series, publishers, lists, characters, tags, genres, loans and deliveries, including when sorting by author.",
    bodyUk:
      "Списки за абеткою тепер упорядковуються за українськими правилами: І стоїть між З і Й, Є після Е, а Ґ одразу після Г. Раніше І та Є опинялися на початку перед А, а Ґ у самому кінці після Я, і це було помітно в бібліотеці, списку бажань, серіях, видавництвах, списках, персонажах, тегах, жанрах, позиках і доставках, зокрема під час сортування за автором.",
    category: "fix",
    publishedAt: "2026-08-12T00:00:00.000Z",
    slug: "ukrainian-alphabet-sorting",
    titleEn: "Ukrainian alphabetical sorting",
    titleUk: "Сортування за українською абеткою",
    version: null,
  },
  {
    bodyEn:
      "A shipment now moves to its next status in one click, straight from the order card. The status is spelled out next to the badge, the shipment menu can send it back a step, and a parcel waiting at a pickup point can carry the date it is held until.",
    bodyUk:
      "Посилка тепер переходить до наступного статусу одним кліком просто з картки замовлення. Статус підписаний поруч зі значком, у меню посилки його можна повернути на крок назад, а посилці на відділенні можна вказати дату, до якої її зберігають.",
    category: "feature",
    publishedAt: "2026-08-17T00:00:00.000Z",
    slug: "shipment-status-one-click",
    titleEn: "One-click shipment status",
    titleUk: "Статус посилки одним кліком",
    version: null,
  },
];

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

async function seedChangelog(): Promise<void> {
  const prisma = createSeedClient();

  try {
    await seedEntries(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function seedEntries(prisma: PrismaClientInstance): Promise<void> {
  const slugs = CHANGELOG_ENTRIES.map((entry) => entry.slug);
  const existing = await prisma.changelogEntry.findMany({
    select: { slug: true },
    where: { slug: { in: slugs } },
  });
  const existingSlugs = new Set(existing.map((row) => row.slug));

  for (const entry of CHANGELOG_ENTRIES) {
    const publishedAt = parseISO(entry.publishedAt);
    await prisma.changelogEntry.upsert({
      create: {
        bodyEn: entry.bodyEn,
        bodyUk: entry.bodyUk,
        category: entry.category,
        publishedAt,
        slug: entry.slug,
        titleEn: entry.titleEn,
        titleUk: entry.titleUk,
        version: entry.version,
      },
      update: {
        bodyEn: entry.bodyEn,
        bodyUk: entry.bodyUk,
        category: entry.category,
        publishedAt,
        titleEn: entry.titleEn,
        titleUk: entry.titleUk,
        version: entry.version,
      },
      where: { slug: entry.slug },
    });
  }

  const created = CHANGELOG_ENTRIES.filter((entry) => !existingSlugs.has(entry.slug)).length;
  logger.info({ created, updated: CHANGELOG_ENTRIES.length - created }, "changelog entries seeded");
}

seedChangelog()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "changelog seed failed");
    process.exit(1);
  });
