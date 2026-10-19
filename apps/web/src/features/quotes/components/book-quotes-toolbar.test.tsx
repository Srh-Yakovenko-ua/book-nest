import "@testing-library/jest-dom/vitest";

import type { QuotesFacetsView } from "@app/shared";
import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { BookQuotesTabState } from "../model/book-quotes-tab-query";

import { BookQuotesToolbar } from "./book-quotes-toolbar";

const FACETS: QuotesFacetsView = {
  authors: [{ count: 9, id: "author-1", name: "Френк Герберт" }],
  books: [{ count: 9, id: "book-1", title: "Дюна" }],
  favoritesCount: 3,
  spoilerCount: 2,
  totalCount: 9,
  withCommentCount: 4,
  withoutCommentCount: 5,
  withoutSpoilerCount: 7,
};

const DEFAULT_STATE: BookQuotesTabState = { quoteFilter: "all", quoteQ: "", quoteSort: "page" };

const COPY = {
  quickFilters: "Швидкі фільтри цитат",
  search: "Пошук у цитатах цієї книги",
  sort: "Сортування цитат",
} as const;

type ToolbarOptions = Partial<
  Pick<ComponentProps<typeof BookQuotesToolbar>, "facets" | "facetsPending">
> & { state?: BookQuotesTabState };

function quickFilters() {
  return within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
}

function renderToolbar({ state = DEFAULT_STATE, ...props }: ToolbarOptions = {}) {
  const query = {
    clearSearch: vi.fn(),
    setFilter: vi.fn(),
    setSearch: vi.fn(),
    setSort: vi.fn(),
    state,
  };
  const onAddQuote = vi.fn();
  renderWithProviders(
    <BookQuotesToolbar
      facets={FACETS}
      facetsPending={false}
      onAddQuote={onAddQuote}
      query={query}
      {...props}
    />,
  );
  return { onAddQuote, query };
}

describe("BookQuotesToolbar", () => {
  it("keeps the toolbar compact, without the archive-only controls", () => {
    renderToolbar();

    expect(screen.getByRole("textbox", { name: COPY.search })).toBeVisible();
    expect(screen.getByRole("textbox", { name: COPY.search })).toHaveAttribute(
      "placeholder",
      "Пошук за текстом, коментарем, розділом або сторінкою…",
    );
    expect(screen.queryByRole("radiogroup", { name: "Вигляд" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Фільтри/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Книга")).not.toBeInTheDocument();
    expect(screen.queryByText("Френк Герберт")).not.toBeInTheDocument();
  });

  it("asks for a new quote", async () => {
    const { onAddQuote } = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "Додати цитату" }));

    expect(onAddQuote).toHaveBeenCalledOnce();
  });

  it("shows the five quick filters with the counts from the facets", async () => {
    const { query } = renderToolbar();

    expect(quickFilters().getAllByRole("radio")).toHaveLength(5);
    expect(quickFilters().getByRole("radio", { name: "Усі 9" })).toBeChecked();
    expect(quickFilters().getByRole("radio", { name: "Улюблені 3" })).toBeInTheDocument();
    expect(quickFilters().getByRole("radio", { name: "З коментарем 4" })).toBeInTheDocument();
    expect(quickFilters().getByRole("radio", { name: "Без спойлерів 7" })).toBeInTheDocument();
    expect(quickFilters().getByRole("radio", { name: "Зі спойлерами 2" })).toBeInTheDocument();

    await userEvent.click(quickFilters().getByRole("radio", { name: "З коментарем 4" }));

    expect(query.setFilter).toHaveBeenCalledWith("with_comment");
  });

  it("marks the chip counts as pending while the facets load", () => {
    renderToolbar({ facets: undefined, facetsPending: true });

    const chips = quickFilters().getAllByRole("radio");
    expect(chips).toHaveLength(5);
    for (const chip of chips) {
      expect(chip.querySelector("[data-slot='chip-count-pending']")).toBeInTheDocument();
    }
  });

  it("offers exactly the page, newest and oldest sorts", async () => {
    const { query } = renderToolbar();

    await userEvent.click(screen.getByRole("combobox", { name: COPY.sort }));
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "За сторінкою: від меншої",
      "За датою додавання: спочатку нові",
      "За датою додавання: спочатку старі",
    ]);
    await userEvent.click(
      screen.getByRole("option", { name: "За датою додавання: спочатку нові" }),
    );

    expect(query.setSort).toHaveBeenCalledWith("newest");
  });

  it("offers the same three sorts in the mobile sheet", async () => {
    const { query } = renderToolbar();

    const trigger = screen.getByRole("button", { name: COPY.sort });
    expect(trigger).toHaveTextContent("Сторінка ↑");
    await userEvent.click(trigger);
    const sheet = await screen.findByRole("dialog", { name: "Сортування" });
    const radios = within(sheet).getAllByRole("radio");

    expect(radios).toHaveLength(3);
    expect(within(sheet).queryByText("Назва: А–Я")).not.toBeInTheDocument();
    expect(within(sheet).queryByText("Автор: А–Я")).not.toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole("radio", { name: "Спочатку старі" }));

    await waitFor(() => expect(query.setSort).toHaveBeenCalledWith("oldest"));
  });

  it("commits a one-character search", async () => {
    const { query } = renderToolbar();

    await userEvent.type(screen.getByRole("textbox", { name: COPY.search }), "7");

    await waitFor(() => expect(query.setSearch).toHaveBeenCalledWith("7"));
  });

  it("clears the search without touching the filter or the sort", async () => {
    const { query } = renderToolbar({
      state: { quoteFilter: "favorites", quoteQ: "страх", quoteSort: "newest" },
    });

    await userEvent.click(screen.getByRole("button", { name: "Очистити пошук" }));

    expect(query.clearSearch).toHaveBeenCalledOnce();
    expect(query.setSearch).not.toHaveBeenCalled();
    expect(query.setFilter).not.toHaveBeenCalled();
    expect(query.setSort).not.toHaveBeenCalled();
  });
});
