import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeWishlistBook } from "../model/books-to-buy.fixtures";
import { BooksToBuyContent } from "./books-to-buy-content";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const emptyTitle = messages.booksToBuy.empty.title;

type ContentProps = Parameters<typeof BooksToBuyContent>[0];

function renderContent(overrides: Partial<ContentProps> = {}) {
  const props: ContentProps = {
    books: [makeWishlistBook()],
    hasAnyBooks: true,
    isError: false,
    isPending: false,
    isRefreshing: false,
    libraryPresence: { kind: "ready", total: 3 },
    onAddBook: vi.fn(),
    onClearFilters: vi.fn(),
    onOpenLibrary: vi.fn(),
    onRetry: vi.fn(),
    retryButtonRef: null,
    ...overrides,
  };
  return renderWithProviders(<BooksToBuyContent {...props} />);
}

describe("BooksToBuyContent", () => {
  it("lists every wishlist book in the given order", () => {
    renderContent({
      books: [
        makeWishlistBook({ id: "alpha", title: "Альфа" }),
        makeWishlistBook({ id: "beta", title: "Бета" }),
      ],
    });

    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["Альфа", "Бета"]);
  });

  it("renders wishlist books as horizontal rows in list view", () => {
    renderContent({ view: "list" });

    expect(document.querySelector("[data-slot=book-row]")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=book-card]")).not.toBeInTheDocument();
    expect(screen.getByText("Клуб Сімейного Дозвілля")).toBeInTheDocument();
  });

  it("shows a busy skeleton while the wishlist is loading", () => {
    renderContent({ books: [], isPending: true });

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(screen.queryByText(emptyTitle)).not.toBeInTheDocument();
  });

  it("announces an error and retries on demand", async () => {
    const onRetry = vi.fn();
    renderContent({ books: [], isError: true, onRetry });

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("invites the reader to add a first book when the wishlist is empty", async () => {
    const onAddBook = vi.fn();
    renderContent({
      books: [],
      hasAnyBooks: false,
      libraryPresence: { kind: "ready", total: 0 },
      onAddBook,
    });

    expect(screen.getByText(emptyTitle)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));

    expect(onAddBook).toHaveBeenCalledOnce();
  });

  it("offers the library from the empty wishlist state", async () => {
    const onOpenLibrary = vi.fn();
    renderContent({
      books: [],
      hasAnyBooks: false,
      libraryPresence: { kind: "ready", total: 3 },
      onOpenLibrary,
    });

    await userEvent.click(screen.getByRole("button", { name: "Перейти до всіх книг" }));

    expect(onOpenLibrary).toHaveBeenCalledOnce();
  });

  it("drops the library path from the empty wishlist when the account has no books", () => {
    renderContent({ books: [], hasAnyBooks: false, libraryPresence: { kind: "ready", total: 0 } });

    expect(screen.getByText(emptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Перейти до всіх книг" })).not.toBeInTheDocument();
  });

  it("holds the empty wishlist invitation until the library check answers", () => {
    renderContent({ books: [], hasAnyBooks: false, libraryPresence: { kind: "pending" } });

    expect(screen.queryByText(emptyTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Додати книгу" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retries the library check from the empty wishlist when it fails", async () => {
    const retry = vi.fn();
    renderContent({ books: [], hasAnyBooks: false, libraryPresence: { kind: "error", retry } });

    const alert = screen.getByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText(emptyTitle)).not.toBeInTheDocument();
  });

  it("distinguishes filtered-out results from an empty wishlist", () => {
    renderContent({ books: [], hasAnyBooks: true });

    expect(screen.getByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.queryByText(emptyTitle)).not.toBeInTheDocument();
  });

  it("clears the filters when nothing matches them", async () => {
    const onClearFilters = vi.fn();
    renderContent({ books: [], hasAnyBooks: true, onClearFilters });

    await userEvent.click(screen.getByRole("button", { name: "Очистити фільтри" }));

    expect(onClearFilters).toHaveBeenCalledOnce();
  });
});
