import type { UiIconName } from "@/components/icons";

export type EmptyStateAction = {
  icon: UiIconName;
  label: string;
};

export type EmptyStateChip = {
  icon: UiIconName;
  label: string;
};

export type EmptyStateEntry = {
  chips?: readonly EmptyStateChip[];
  desc: string;
  footer?: string;
  illu: EmptyStateIllustration;
  illuSize?: EmptyStateIllustrationSize;
  num?: string;
  offlineCards?: readonly EmptyStateOfflineCard[];
  primary?: EmptyStateAction;
  quicklinks?: readonly EmptyStateAction[];
  report?: string;
  retry?: readonly EmptyStateAction[];
  secondary?: EmptyStateAction;
  syncNote?: string;
  tip?: string;
  title: string;
};

export type EmptyStateIllustration =
  | "empty-all-books"
  | "empty-authors"
  | "empty-borrowed"
  | "empty-delivery"
  | "empty-favorites"
  | "empty-library"
  | "empty-lists"
  | "empty-notes"
  | "empty-publishers"
  | "empty-purchases"
  | "empty-queue"
  | "empty-quotes"
  | "empty-search"
  | "empty-series"
  | "empty-tags"
  | "error-404"
  | "error-generic"
  | "error-offline";

export type EmptyStateIllustrationSize = "lg" | "md" | "sm";

export type EmptyStateOfflineCard = {
  icon: UiIconName;
  sub: string;
  title: string;
};

export const EMPTY_STATES = {
  authors: {
    desc: "Автори зʼявляться тут автоматично, щойно ти додаси книги до бібліотеки.",
    illu: "empty-authors",
    primary: { icon: "plus", label: "Додати книгу" },
    title: "Список авторів поки порожній",
  },
  borrowed: {
    desc: "Додай сюди книги, що мандрують між друзями: ті, які ти комусь даєш почитати, і ті, що читаєш із чужої полиці. Так завжди памʼятатимеш, де чия книга й коли її повертати.",
    footer: "Книги люблять мандрувати ♡",
    illu: "empty-borrowed",
    primary: { icon: "plus", label: "Додати книгу" },
    secondary: { icon: "book", label: "Перейти в бібліотеку" },
    title: "Поки що жодної позиченої книги",
  },
  delivery: {
    desc: "Коли позначиш книгу як замовлену, вона зʼявиться тут — разом зі статусом доставки.",
    footer: "Найкращі історії ще попереду ♡",
    illu: "empty-delivery",
    primary: { icon: "plus", label: "Додати книгу" },
    secondary: { icon: "cart", label: "Перейти в покупки" },
    title: "У тебе поки немає книг у дорозі",
  },
  error_404: {
    desc: "Схоже, ця сторінка загубилася між стелажами твоєї бібліотеки. Та не хвилюйся — знайдемо дорогу назад.",
    illu: "error-404",
    num: "404",
    quicklinks: [
      { icon: "home", label: "Головна" },
      { icon: "book", label: "Бібліотека" },
      { icon: "list", label: "Черга" },
      { icon: "search", label: "Пошук книг" },
    ],
    report: "Повідомити про помилку",
    title: "Сторінку не знайдено",
  },
  error_generic: {
    desc: "Не вдалося завантажити дані. Спробуй оновити сторінку — а якщо не допоможе, ми вже розбираємося.",
    illu: "error-generic",
    primary: { icon: "refresh", label: "Спробувати ще раз" },
    secondary: { icon: "home", label: "На головну" },
    title: "Щось пішло не так",
  },
  favorites: {
    desc: "Познач книги сердечком — і вони зберуться тут, щоб завжди бути поруч.",
    illu: "empty-favorites",
    primary: { icon: "book", label: "Перейти в бібліотеку" },
    title: "У тебе ще немає улюблених",
  },
  library: {
    desc: "Додай свою першу книгу, щоб почати збирати особисту колекцію та відстежувати читацький шлях.",
    illu: "empty-library",
    primary: { icon: "plus", label: "Додати книгу" },
    tip: "Порада: додавай книги, які зараз читаєш або плануєш прочитати — так найлегше тримати свій прогрес під рукою.",
    title: "Твоя бібліотека поки порожня",
  },
  lists: {
    chips: [
      { icon: "list", label: "Хочу прочитати влітку" },
      { icon: "list", label: "Темне фентезі" },
      { icon: "list", label: "Улюблені автори" },
    ],
    desc: "Створи свій перший список, щоб збирати книги за настроєм, темами чи власними підбірками.",
    illu: "empty-lists",
    primary: { icon: "plus", label: "Створити список" },
    title: "У тебе ще немає власних списків",
  },
  notes: {
    desc: "Занотовуй думки, ідеї та враження під час читання — усі нотатки зберігатимуться тут.",
    illu: "empty-notes",
    primary: { icon: "plus", label: "Створити нотатку" },
    title: "Поки що жодної нотатки",
  },
  offline: {
    desc: "Схоже, зʼєднання з інтернетом відсутнє. Деякі функції можуть бути недоступні, але застосунком можна користуватися й офлайн.",
    illu: "error-offline",
    offlineCards: [
      { icon: "book", sub: "Переглянь збережені книги", title: "Моя бібліотека" },
      { icon: "note", sub: "Доступ до твоїх нотаток", title: "Нотатки" },
      { icon: "quote", sub: "Збережені цитати", title: "Цитати" },
      { icon: "list", sub: "Твої списки й підбірки", title: "Списки" },
    ],
    retry: [
      { icon: "refresh", label: "Спробувати ще раз" },
      { icon: "book", label: "Офлайн-режим" },
      { icon: "help-circle", label: "Перевірити статус" },
    ],
    syncNote: "Ми автоматично синхронізуємо твої дані, щойно зʼявиться зʼєднання.",
    tip: "Порада: можеш додавати книги, нотатки та цитати офлайн — ми збережемо все й синхронізуємо пізніше.",
    title: "Ти офлайн",
  },
  publishers: {
    desc: "Видавництва зберуться тут із книг твоєї бібліотеки — нічого додавати вручну не треба.",
    illu: "empty-publishers",
    primary: { icon: "plus", label: "Додати книгу" },
    title: "Видавництв поки немає",
  },
  purchases: {
    chips: [
      { icon: "store", label: "Порівняй ціни в магазинах" },
      { icon: "wallet", label: "Відстеж актуальні ціни" },
      { icon: "link", label: "Збери посилання на книги" },
    ],
    desc: "Додай книги, які хочеш придбати, щоб зберігати посилання на магазини, ціни та плани покупок в одному місці.",
    illu: "empty-purchases",
    primary: { icon: "plus", label: "Додати книгу" },
    secondary: { icon: "book", label: "Перейти в бібліотеку" },
    title: "У тебе ще немає книг до покупки",
  },
  queue: {
    desc: "Додай книги, які плануєш прочитати найближчим часом — і вони шикуватимуться тут у зручному порядку.",
    illu: "empty-queue",
    primary: { icon: "plus", label: "Додати книгу" },
    secondary: { icon: "book", label: "Перейти в бібліотеку" },
    title: "Черга читання порожня",
  },
  quotes: {
    desc: "Зберігай улюблені уривки й цитати з книг, щоб завжди мати їх під рукою.",
    illu: "empty-quotes",
    primary: { icon: "plus", label: "Додати цитату" },
    title: "Тут ще немає цитат",
  },
  search: {
    desc: "Спробуй змінити запит або скинути фільтри — можливо, книга чекає під іншою назвою.",
    illu: "empty-search",
    primary: { icon: "x", label: "Скинути фільтри" },
    title: "Нічого не знайдено",
  },
  series: {
    desc: "Додавай книжкові серії, щоб бачити свій прогрес і не пропустити жодного тому.",
    illu: "empty-series",
    primary: { icon: "plus", label: "Додати книгу" },
    title: "Поки що жодної серії",
  },
  tags: {
    desc: "Додавай книгам жанри й теги, щоб швидко знаходити потрібне та фільтрувати колекцію.",
    illu: "empty-tags",
    primary: { icon: "plus", label: "Додати книгу" },
    title: "Поки що жодного жанру чи тегу",
  },
} as const satisfies Record<string, EmptyStateEntry>;

export type EmptyStateKey = keyof typeof EMPTY_STATES;

export const EMPTY_STATE_ORDER = [
  "library",
  "queue",
  "notes",
  "quotes",
  "favorites",
  "series",
  "purchases",
  "delivery",
  "borrowed",
  "lists",
  "authors",
  "publishers",
  "tags",
  "search",
  "error_404",
  "offline",
  "error_generic",
] as const satisfies readonly EmptyStateKey[];
