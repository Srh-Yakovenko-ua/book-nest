import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { readingStatuses } from "@/lib/book-status";

import type { LibraryActions } from "../model/book-card-actions";
import type { LibraryBook } from "../model/library-book";
import type { LibrarySummaryCard } from "./library-summary-cards";

import { BooksLibraryView } from "./books-library-view";
import { LibrarySummarySidebar } from "./library-summary-sidebar";

const reading = readingStatuses.find((status) => status.value === "reading") ?? readingStatuses[0];
const finished =
  readingStatuses.find((status) => status.value === "finished") ?? readingStatuses[0];
const wantToRead =
  readingStatuses.find((status) => status.value === "want_to_read") ?? readingStatuses[0];

const books: LibraryBook[] = [
  {
    author: "Сара Дж. Маас",
    genres: [{ label: "Фентезі" }, { label: "Темне фентезі" }, { label: "Романтика" }],
    href: "/books/1/edit",
    id: "1",
    isFavorite: true,
    isInReadingQueue: false,
    ownershipStatus: "owned",
    pagesText: "768 стор.",
    progress: {
      ariaLabel: "Прогрес читання: 312 з 768",
      current: 312,
      total: 768,
      unit: "стор.",
    },
    rating: 4,
    ratingLabel: "Рейтинг 4 з 5",
    readingStatus: "reading",
    series: "Двір шипів і троянд",
    status: reading,
    title: "Двір срібного полум'я",
    year: 2021,
  },
  {
    author: "Лі Бардуго",
    genres: [{ label: "Фентезі" }],
    href: "/books/2/edit",
    id: "2",
    isFavorite: false,
    isInReadingQueue: true,
    ownershipStatus: "owned",
    pagesText: "496 стор.",
    rating: 4.5,
    readingStatus: "finished",
    status: finished,
    title: "Шістка воронів",
    year: 2015,
  },
  {
    author: "Медлін Міллер",
    genres: [{ label: "Історична проза" }],
    href: "/books/3/edit",
    id: "3",
    isFavorite: false,
    isInReadingQueue: false,
    ownershipStatus: "want_to_buy",
    pagesText: "352 стор.",
    readingStatus: "want_to_read",
    status: wantToRead,
    title: "Пісня Ахілла",
    year: 2011,
  },
];

const summaryCards: LibrarySummaryCard[] = [
  { icon: "library", label: "Усього книг", value: 128 },
  { icon: "book", label: "Читаю", value: 4 },
  { icon: "check-circle", label: "Прочитано", value: 86 },
  { icon: "heart", label: "Улюблених", value: 17 },
];

const sortOptions = [
  { label: "Нещодавно додані", value: "created_desc" as const },
  { label: "Давно додані", value: "created_asc" as const },
  { label: "Назва А–Я", value: "title_asc" as const },
  { label: "Найвищий рейтинг", value: "rating_desc" as const },
];

const noopActions: LibraryActions = {
  onAddTags: async () => {},
  onAddToList: async () => {},
  onAddToQueue: async () => {},
  onChangeOwnership: async () => {},
  onChangeReadingStatus: async () => {},
  onDelete: async () => {},
  onEdit: () => {},
  onRemoveFromQueue: async () => {},
  onSetFavorite: async () => {},
  onToggleFavorite: () => {},
};

const emptyState = {
  desc: "Додай першу книгу, щоб почати збирати свою читацьку колекцію.",
  illu: "empty-library",
  primary: { icon: "plus", label: "Додати книгу" },
  title: "Твоя бібліотека поки порожня",
} as const;

const errorState = {
  desc: "Спробуй оновити сторінку або повторити запит трохи пізніше.",
  illu: "error-generic",
  primary: { icon: "refresh", label: "Спробувати ще раз" },
  title: "Не вдалося завантажити бібліотеку",
} as const;

const noSearchResultsState = {
  desc: "Спробуй змінити пошуковий запит або очистити пошук.",
  illu: "empty-search",
  primary: { icon: "x", label: "Очистити пошук" },
  title: "Нічого не знайдено",
} as const;

const noFilteredResultsState = {
  desc: "Спробуй змінити фільтри або очистити їх, щоб побачити більше книг.",
  illu: "empty-search",
  primary: { icon: "x", label: "Очистити фільтри" },
  secondary: { icon: "refresh", label: "Очистити все" },
  title: "Немає книг за вибраними фільтрами",
} as const;

const viewLabels = {
  grid: "Сітка",
  label: "Вигляд",
  list: "Список",
};

const sidebar = (
  <LibrarySummarySidebar
    isLoading={false}
    recentlyAdded={[
      { author: "Холлі Блек", href: "/books/10/edit", id: "10", title: "Жорстокий принц" },
      {
        author: "Брендон Сандерсон",
        href: "/books/11/edit",
        id: "11",
        title: "Народжений туманом",
      },
    ]}
    topGenres={[
      { key: "thriller", name: "Трилер" },
      { key: "scifi", name: "Наукова фантастика" },
    ]}
    topTags={[{ id: "1", name: "slow burn" }]}
  />
);

const meta = {
  args: {
    actions: noopActions,
    addBookLabel: "Додати книгу",
    allShownLabel: "Усі книги показано",
    books,
    counterLabel: "Показано 3 з 3 книг",
    coverViewLabel: "Переглянути обкладинку у повному розмірі",
    emptyState,
    errorState,
    hasActiveFilters: false,
    hasActiveSearch: false,
    hasNextPage: false,
    isError: false,
    isFetchingNextPage: false,
    isLoadMoreError: false,
    isPending: false,
    libraryTotal: 128,
    loadingLabel: "Завантаження книг…",
    loadMoreErrorLabel: "Не вдалося завантажити ще книги",
    loadMoreLabel: "Показати ще",
    noFilteredResultsState,
    noSearchResultsState,
    onAddBook: () => {},
    onClearAll: () => {},
    onClearFilters: () => {},
    onClearSearch: () => {},
    onLoadMore: () => {},
    onRetry: () => {},
    onSortChange: () => {},
    onViewChange: () => {},
    sidebar,
    sort: "created_desc",
    sortLabel: "Сортування",
    sortOptions,
    subtitle: "Усі твої книги в одному затишному просторі",
    summaryCards,
    summaryLoading: false,
    title: "Моя бібліотека",
    view: "grid",
    viewLabels,
  },
  component: BooksLibraryView,
  tags: ["ai-generated"],
  title: "Books/BooksLibraryView",
} satisfies Meta<typeof BooksLibraryView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("heading", { name: "Моя бібліотека" })).toBeVisible(),
    );
    await waitFor(() => expect(canvas.getByText("Двір срібного полум'я")).toBeVisible());
    await waitFor(() => expect(canvas.getByText("Показано 3 з 3 книг")).toBeVisible());
    await expect(canvas.getByText("Усього книг")).toBeVisible();
  },
};

export const ListView: Story = {
  args: { view: "list" },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "Двір срібного полум'я" });
    await waitFor(() => expect(link).toBeVisible());
    await expect(link).toHaveAttribute("href", "/books/1/edit");
  },
};

export const WithCardMenu: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Двір срібного полум'я")).toBeVisible());
    const triggers = canvas.getAllByRole("button", { name: "Дії" });
    await expect(triggers).toHaveLength(3);
    const [firstTrigger] = triggers;
    if (firstTrigger === undefined) throw new Error("expected a card menu trigger");
    await userEvent.click(firstTrigger);
    const menu = within(document.body);
    await waitFor(() => expect(menu.getByRole("menuitem", { name: "Видалити" })).toBeVisible());
  },
};

export const BulkSelection: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => expect(canvas.getByText("Двір срібного полум'я")).toBeVisible());
    const [firstCheckbox] = canvas.getAllByRole("checkbox");
    if (firstCheckbox === undefined) throw new Error("expected a selection checkbox");
    await userEvent.click(firstCheckbox);
    await waitFor(() => expect(canvas.getAllByText("Обрано 1 книгу").length).toBeGreaterThan(1));
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Додати до списку" })).toBeVisible(),
    );
  },
};

export const WithLoadMore: Story = {
  args: { counterLabel: "Показано 3 з 12 книг", hasNextPage: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Показати ще" })).toBeVisible();
  },
};

export const LoadMoreError: Story = {
  args: { counterLabel: "Показано 3 з 12 книг", hasNextPage: true, isLoadMoreError: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Не вдалося завантажити ще книги")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Показати ще" })).toBeVisible();
  },
};

export const Loading: Story = {
  args: { books: [], isPending: true, summaryLoading: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const Empty: Story = {
  args: { books: [], counterLabel: "Показано 0 з 0 книг", libraryTotal: 0 },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Твоя бібліотека поки порожня" }),
    ).toBeVisible();
  },
};

export const EmptyLibraryWithActiveSearch: Story = {
  args: { books: [], counterLabel: "Показано 0 з 0 книг", hasActiveSearch: true, libraryTotal: 0 },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Твоя бібліотека поки порожня" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("heading", { name: "Нічого не знайдено" })).toBeNull();
  },
};

export const NoSearchResults: Story = {
  args: { books: [], counterLabel: "Показано 0 з 0 книг", hasActiveSearch: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Нічого не знайдено" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Очистити пошук" })).toBeVisible();
  },
};

export const NoFilteredResults: Story = {
  args: { books: [], counterLabel: "Показано 0 з 0 книг", hasActiveFilters: true },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Немає книг за вибраними фільтрами" }),
    ).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Очистити фільтри" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Очистити все" })).toBeVisible();
  },
};

export const ErrorState: Story = {
  args: { books: [], isError: true },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Не вдалося завантажити бібліотеку" }),
    ).toBeVisible();
  },
};

function MockLink({
  children,
  className,
  href,
}: {
  children?: React.ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <a className={className} data-mock-link="true" href={href}>
      {children}
    </a>
  );
}

export const WithLinkComponent: Story = {
  args: { linkComponent: MockLink },
  play: async ({ canvas }) => {
    const link = canvas.getByRole("link", { name: "Двір срібного полум'я" });
    await waitFor(() => expect(link).toBeVisible());
    await expect(link).toHaveAttribute("data-mock-link", "true");
    await expect(link).toHaveAttribute("href", "/books/1/edit");
  },
};
