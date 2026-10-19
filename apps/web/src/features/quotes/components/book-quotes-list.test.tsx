import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { BookQuotesListState } from "../model/book-quotes-list-state";

import { makeQuote, makeQuoteBookCover } from "../model/quotes.fixtures";
import { BookQuotesList } from "./book-quotes-list";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const COPY = {
  addQuote: "Додати цитату",
  clearSearch: "Очистити пошук",
  emptyBook: "У цій книзі ще немає цитат",
  emptyFilters: "За цим фільтром цитат немає",
  emptySearch: "Нічого не знайдено",
  error: "Не вдалося завантажити цитати",
  loading: "Завантаження цитат...",
  openBooks: "Перейти до книг",
  resetFilter: "Скинути фільтр",
  retry: "Повторити",
} as const;

const QUOTES = [
  makeQuote({
    book: { ...makeQuote().book, cover: makeQuoteBookCover() },
    id: "quote-1",
    text: "Страх — убивця розуму.",
  }),
  makeQuote({ id: "quote-2", text: "Спайс мусить текти." }),
];

async function findEmptyState(title: string): Promise<HTMLElement> {
  const container = (await screen.findByRole("heading", { name: title })).parentElement;
  if (container === null) throw new Error(`no empty state for ${title}`);
  return container;
}

function renderList(state: BookQuotesListState) {
  const actions = {
    onAddQuote: vi.fn(),
    onClearFilters: vi.fn(),
    onClearSearch: vi.fn(),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
  };
  renderWithProviders(<BookQuotesList state={state} {...actions} />);
  return actions;
}

describe("BookQuotesList ready", () => {
  it("lays the quotes out in one column, each item tagged with its quote id", () => {
    renderList({ kind: "ready", nextPage: "none", quotes: QUOTES });

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    expect(list.className).not.toMatch(/grid-cols-2/);
    expect(items.map((item) => item.getAttribute("data-quote-id"))).toEqual(["quote-1", "quote-2"]);
  });

  it("renders the embedded card without the book title, author or cover", () => {
    renderList({ kind: "ready", nextPage: "none", quotes: QUOTES });

    expect(screen.getByText("Страх — убивця розуму.")).toBeInTheDocument();
    expect(screen.queryByText("Дюна")).not.toBeInTheDocument();
    expect(screen.queryByText("Френк Герберт")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("says when every quote is shown", () => {
    renderList({ kind: "ready", nextPage: "none", quotes: QUOTES });

    expect(screen.getByText("Усі цитати показано")).toBeInTheDocument();
  });

  it("keeps the loaded cards and retries only the next page after it fails", async () => {
    const { onLoadMore } = renderList({ kind: "ready", nextPage: "error", quotes: QUOTES });

    expect(screen.getByRole("alert")).toHaveTextContent("Не вдалося завантажити ще цитати");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: COPY.retry })).not.toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: COPY.retry }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});

describe("BookQuotesList states", () => {
  it("shows its own skeleton while loading", () => {
    renderList({ kind: "loading" });

    expect(screen.getByRole("group", { name: COPY.loading })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("offers to add the first quote when the book has none, never to open the books", async () => {
    const { onAddQuote } = renderList({ kind: "empty", reason: "book" });

    const empty = await findEmptyState(COPY.emptyBook);
    expect(screen.queryByRole("button", { name: COPY.openBooks })).not.toBeInTheDocument();

    await userEvent.click(within(empty).getByRole("button", { name: COPY.addQuote }));

    expect(onAddQuote).toHaveBeenCalledOnce();
  });

  it("clears the search when the search finds nothing", async () => {
    const view = renderList({ kind: "empty", reason: "search" });

    const empty = await findEmptyState(COPY.emptySearch);
    await userEvent.click(within(empty).getByRole("button", { name: COPY.clearSearch }));

    expect(view.onClearSearch).toHaveBeenCalledOnce();
    expect(view.onClearFilters).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: COPY.openBooks })).not.toBeInTheDocument();
  });

  it("resets the filter when the filter matches nothing", async () => {
    const view = renderList({ kind: "empty", reason: "filters" });

    const empty = await findEmptyState(COPY.emptyFilters);
    expect(within(empty).queryByRole("button", { name: COPY.addQuote })).not.toBeInTheDocument();
    await userEvent.click(within(empty).getByRole("button", { name: COPY.resetFilter }));

    expect(view.onClearFilters).toHaveBeenCalledOnce();
    expect(view.onClearSearch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: COPY.openBooks })).not.toBeInTheDocument();
  });

  it("retries the first page after it fails", async () => {
    const { onRetry } = renderList({ kind: "error" });

    expect(screen.getByRole("alert")).toHaveTextContent(COPY.error);
    await userEvent.click(screen.getByRole("button", { name: COPY.retry }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
