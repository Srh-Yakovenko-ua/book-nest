import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { expect, userEvent, waitFor, within } from "storybook/test";

import { readingStatuses } from "@/lib/book-status";

import type { LibraryBook } from "./books-library-view";

import { BooksLibraryView } from "./books-library-view";

const reading = readingStatuses.find((status) => status.value === "reading") ?? readingStatuses[0];
const finished =
  readingStatuses.find((status) => status.value === "finished") ?? readingStatuses[0];
const wantToRead =
  readingStatuses.find((status) => status.value === "want_to_read") ?? readingStatuses[0];

const books: LibraryBook[] = [
  {
    author: "Сара Дж. Маас",
    genre: { label: "Фентезі" },
    href: "/books/1/edit",
    id: "1",
    progress: { current: 312, total: 768 },
    rating: 4,
    series: "Двір шипів і троянд",
    status: reading,
    title: "Двір срібного полум'я",
  },
  {
    author: "Лі Бардуго",
    genre: { label: "Фентезі" },
    href: "/books/2/edit",
    id: "2",
    rating: 4.5,
    status: finished,
    title: "Шістка воронів",
  },
  {
    author: "Медлін Міллер",
    genre: { label: "Історична проза" },
    href: "/books/3/edit",
    id: "3",
    status: wantToRead,
    title: "Пісня Ахілла",
  },
];

const sortLabels = {
  label: "Сортування",
  newest: "Спочатку нові",
  oldest: "Спочатку старі",
};

const deleteLabels = {
  cancel: "Скасувати",
  confirm: "Видалити",
  deleting: "Видалення…",
  description: (title: string) =>
    `Книга «${title}» буде видалена назавжди. Цю дію не можна скасувати.`,
  title: "Видалити книгу?",
};

const menuLabels = {
  delete: "Видалити",
  menu: "Дії",
};

const meta = {
  args: {
    addBookLabel: "Додати книгу",
    books,
    count: "3 книги",
    deleteLabels,
    hasNextPage: false,
    isDeleting: false,
    isError: false,
    isFetchingNextPage: false,
    isPending: false,
    loadingLabel: "Завантаження книг…",
    loadMoreLabel: "Показати ще",
    menuLabels,
    onAddBook: () => {},
    onDeleteBook: () => {},
    onLoadMore: () => {},
    onRetry: () => {},
    onSortChange: () => {},
    sortDirection: "desc",
    sortLabels,
    title: "Моя бібліотека",
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
    await waitFor(() => expect(canvas.getByText("3 книги", { selector: "p" })).toBeVisible());
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

export const WithLoadMore: Story = {
  args: { hasNextPage: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Показати ще" })).toBeVisible();
  },
};

export const Loading: Story = {
  args: { books: [], isPending: true },
  play: async ({ canvasElement }) => {
    const skeletons = canvasElement.querySelectorAll('[data-slot="skeleton"]');
    await expect(skeletons.length).toBeGreaterThan(0);
  },
};

export const Empty: Story = {
  args: { books: [], count: "0 книг" },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Твоя бібліотека поки порожня" }),
    ).toBeVisible();
  },
};

export const ErrorState: Story = {
  args: { books: [], isError: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { name: "Щось пішло не так" })).toBeVisible();
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
