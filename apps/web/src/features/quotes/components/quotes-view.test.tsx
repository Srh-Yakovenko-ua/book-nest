import "@testing-library/jest-dom/vitest";

import type {
  PostFinishQuotesView,
  QuotesFacetsView,
  QuotesOverviewView,
  QuotesSummaryView,
  QuoteView,
} from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { createTranslator } from "next-intl";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { quoteKeys } from "../api/quote-keys";
import { QUOTES_PAGE_SIZE } from "../model/quotes-query";
import { makeQuote } from "../model/quotes.fixtures";
import { QuotesView } from "./quotes-view";

const SORT_LABEL = "Сортування цитат";

const translateQuotes = createTranslator({ locale: "uk", messages, namespace: "quotes" });

const viewport = mockIntersectionObserver();

type QuotesMockOptions = {
  facetsFor?: (url: string) => QuotesFacetsView;
  libraryStatus?: number;
  libraryTotal?: number;
  listHeldUntil?: (url: string) => Promise<void>;
  listStatus?: number;
  overview?: QuotesOverviewView;
  summary?: QuotesSummaryView;
  summaryStatus?: number;
};

const requestedUrls: string[] = [];

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

const FACETS: QuotesFacetsView = {
  authors: [
    { count: 8, id: "author-1", name: "Френк Герберт" },
    { count: 5, id: "author-2", name: "Марісса Маєр" },
  ],
  books: [
    { count: 8, id: "book-1", title: "Дюна" },
    { count: 5, id: "book-2", title: "Месія Дюни" },
  ],
  favoritesCount: 2,
  spoilerCount: 1,
  totalCount: 13,
  withCommentCount: 3,
  withoutCommentCount: 10,
  withoutSpoilerCount: 12,
};

const NARROWED_FACETS: QuotesFacetsView = {
  authors: [{ count: 8, id: "author-1", name: "Френк Герберт" }],
  books: [{ count: 8, id: "book-1", title: "Дюна" }],
  favoritesCount: 1,
  spoilerCount: 0,
  totalCount: 8,
  withCommentCount: 2,
  withoutCommentCount: 6,
  withoutSpoilerCount: 8,
};

const SUMMARY: QuotesSummaryView = {
  averageQuotesPerQuotedBook: 13 / 5,
  favoritesCount: 2,
  quotedBooksCount: 5,
  spoilerCount: 1,
  topAuthor: { leadersCount: 1, name: "Френк Герберт", quotesCount: 8 },
  topBook: { leadersCount: 1, quotesCount: 8, title: "Дюна" },
  totalCount: 13,
  withCommentCount: 3,
  withoutSpoilerCount: 12,
};

const EMPTY_SUMMARY: QuotesSummaryView = {
  averageQuotesPerQuotedBook: null,
  favoritesCount: 0,
  quotedBooksCount: 0,
  spoilerCount: 0,
  topAuthor: null,
  topBook: null,
  totalCount: 0,
  withCommentCount: 0,
  withoutSpoilerCount: 0,
};

const EMPTY_FACETS: QuotesFacetsView = {
  authors: [],
  books: [],
  favoritesCount: 0,
  spoilerCount: 0,
  totalCount: 0,
  withCommentCount: 0,
  withoutCommentCount: 0,
  withoutSpoilerCount: 0,
};

const EMPTY_OVERVIEW: QuotesOverviewView = { memoryQuote: null, postFinish: null };

const POST_FINISH: PostFinishQuotesView = {
  book: {
    cover: null,
    firstAuthorName: "Лорен Робертс",
    id: "book-9",
    title: "Безрозсудна",
  },
  favoritesCount: 4,
  finishedAt: "2026-09-04",
  quotesCount: 12,
  readingCycleId: "8f1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
  withCommentCount: 5,
};

afterEach(() => {
  vi.unstubAllGlobals();
  requestedUrls.length = 0;
  routerPush.mockClear();
});

describe("QuotesView sorting", () => {
  it("starts the list over at the first page when the order changes", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    viewport.enterViewport();
    expect(await screen.findByText("Цитата 13")).toBeInTheDocument();
    expect(listUrls().some((url) => url.includes("pageNumber=2"))).toBe(true);

    requestedUrls.length = 0;
    await userEvent.click(screen.getByRole("combobox", { name: SORT_LABEL }));
    await userEvent.click(
      await screen.findByRole("option", { name: "За датою додавання: спочатку старі" }),
    );

    await waitFor(() => expect(events.at(-1)?.searchParams.get("sort")).toBe("oldest"));
    await waitFor(() => expect(listUrls().some((url) => url.includes("sort=oldest"))).toBe(true));

    const [firstRequestAfterSort] = listUrls();
    expect(firstRequestAfterSort).toContain("sort=oldest");
    expect(firstRequestAfterSort).toContain("pageNumber=1");
  });
});

describe("QuotesView legacy sort links", () => {
  it("still asks the API for the order an old link pinned", async () => {
    mockQuotes(quotes(3));

    renderQuotes("?sort=favorites_first");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(listUrl()).toContain("sort=favorites_first");
    expect(screen.getByRole("combobox", { name: SORT_LABEL })).toHaveTextContent(
      "Спочатку улюблені",
    );
    expect(screen.getByRole("button", { name: SORT_LABEL })).toHaveTextContent("Улюблені");
  });

  it("hands the link back to a visible order once one is picked", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(3));

    renderQuotes("?sort=with_spoiler_first", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: SORT_LABEL }));
    await userEvent.click(await screen.findByRole("option", { name: "За автором: А–Я" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("sort")).toBe("book_author"));
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: SORT_LABEL })).toHaveTextContent(
        "За автором: А–Я",
      );
    });

    await userEvent.click(screen.getByRole("combobox", { name: SORT_LABEL }));
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).not.toContain("Спочатку зі спойлерами");
  });
});

describe("QuotesView quick filters", () => {
  it("offers the five presets with their counts and says how many are shown", async () => {
    mockQuotes(quotes(13));

    renderQuotes();

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const group = screen.getByRole("radiogroup", { name: "Швидкі фільтри цитат" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((chip) => chip.textContent),
    ).toEqual(["Усі13", "Улюблені2", "З коментарем3", "Без спойлерів12", "Зі спойлерами1"]);
    expect(screen.getByText("Показано 13 із 13 цитат")).toBeInTheDocument();
  });

  it("counts the active preset against the dataset behind it", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?filter=favorites");

    expect(await screen.findByText("Показано 2 із 13 цитат")).toBeInTheDocument();
  });

  it("keeps a retired preset usable when an old link pinned it", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?filter=without_comment");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(listUrl()).toContain("filter=without_comment");
    const group = screen.getByRole("radiogroup", { name: "Швидкі фільтри цитат" });
    expect(within(group).getByRole("radio", { checked: true })).toHaveTextContent(
      "Без коментаря10",
    );
    expect(screen.getByText("Показано 10 із 13 цитат")).toBeInTheDocument();
  });

  it("dims the quotes but not the facet-driven counter while a preset loads", async () => {
    mockQuotes(quotes(13), {
      listHeldUntil: (url) =>
        url.includes("filter=favorites") ? new Promise<void>(() => {}) : Promise.resolve(),
    });
    renderQuotes();
    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await waitFor(() => expect(filterChipTexts()[0]).toBe("Усі13"));

    const presets = within(screen.getByRole("radiogroup", { name: "Швидкі фільтри цитат" }));
    await userEvent.click(presets.getByRole("radio", { name: /^Улюблені/ }));

    await waitFor(() => expect(regionBusyState(screen.getByText("Цитата 1"))).toBe("true"));
    expect(listUrls().at(-1)).toContain("filter=favorites");
    const counter = screen.getByText(translateQuotes("counter", { shown: 2, total: 13 }));
    expect(counter.closest('[aria-busy="true"]')).toBeNull();
  });
});

describe("QuotesView advanced filters", () => {
  it("reads an old book deep link as a book filter and names it", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?bookId=book-1");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(listUrl()).toContain("book=book-1");
    expect(listUrl()).not.toContain("bookId=");
    expect(screen.getByRole("button", { name: /Фільтри/ })).toHaveTextContent("1");
    expect(
      within(screen.getByRole("group", { name: "Активні фільтри" })).getByText("Книга: Дюна"),
    ).toBeInTheDocument();
  });

  it("opens with the book of the deep link already picked", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?bookId=book-1");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: /^Книги / })).toHaveTextContent("Дюна");
    expect(within(sheet).getByRole("button", { name: "Прибрати Дюна" })).toBeInTheDocument();
  });

  it("asks for both books when two are picked", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("button", { name: /^Книги / }));
    await userEvent.click(await screen.findByRole("option", { name: /Дюна 8/ }));
    await userEvent.click(await screen.findByRole("option", { name: /Месія Дюни 5/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(within(sheet).getByRole("button", { name: "Застосувати" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBe("book-1,book-2"));
    await waitFor(() => expect(listUrls().some((url) => url.includes("book=book-1"))).toBe(true));
  });

  it("does not commit a draft that was never applied", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Фільтри/ }));
    const sheet = await screen.findByRole("dialog");
    await userEvent.click(within(sheet).getByRole("button", { name: /^Автори / }));
    await userEvent.click(await screen.findByRole("option", { name: /Френк Герберт 8/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(events.some((event) => event.searchParams.has("author"))).toBe(false);
  });

  it("drops one filter at a time from the active row", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("?author=author-1&book=book-1", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const active = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(active).getByText("Автор: Френк Герберт")).toBeInTheDocument();

    await userEvent.click(
      within(active).getByRole("button", { name: "Прибрати фільтр Книга: Дюна" }),
    );

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBeNull());
    expect(events.at(-1)?.searchParams.get("author")).toBe("author-1");
  });

  it("recounts the quick filters over the narrowed dataset", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?author=author-1&book=book-1&createdFrom=2026-01-01&createdTo=2026-08-31");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const facetsUrl = requestedUrls.find((url) => url.includes("/api/quotes/facets"));
    expect(facetsUrl).toContain("book=book-1");
    expect(facetsUrl).toContain("author=author-1");
    expect(facetsUrl).toContain("createdFrom=2026-01-01");
    expect(facetsUrl).toContain("createdTo=2026-08-31");
    expect(facetsUrl).not.toContain("filter=");
    expect(facetsUrl).not.toContain("pageNumber=");
  });

  it("names the date range in the active row", async () => {
    mockQuotes(quotes(13));

    renderQuotes("?createdFrom=2026-01-01&createdTo=2026-08-31");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    const active = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(active).getByText(/Додано/)).toBeInTheDocument();
    expect(listUrl()).toContain("createdFrom=2026-01-01");
  });

  it("clears every filter but leaves the order alone", async () => {
    const { events, onUrlUpdate } = trackUrl();
    mockQuotes(quotes(13));

    renderQuotes("?sort=oldest&book=book-1&filter=favorites&q=дюна", onUrlUpdate);

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Очистити все" }));

    await waitFor(() => expect(events.at(-1)?.searchParams.get("book")).toBeNull());
    const last = events.at(-1)?.searchParams;
    expect(last?.get("filter")).toBeNull();
    expect(last?.get("q")).toBeNull();
    expect(last?.get("sort")).toBe("oldest");
  });
});

describe("QuotesView overview cards", () => {
  it("keeps the four cards steady while the quick-filter counts follow the filters", async () => {
    mockQuotes(quotes(13), {
      facetsFor: (url) => (url.includes("book=book-1") ? NARROWED_FACETS : FACETS),
    });

    renderQuotes("?book=book-1");

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await waitFor(() => expect(filterChipTexts()[0]).toBe("Усі8"));

    const cardsWithFilter = summaryCardTexts();
    expect(cardsWithFilter).toHaveLength(4);

    await userEvent.click(
      within(screen.getByRole("group", { name: "Активні фільтри" })).getByRole("button", {
        name: "Прибрати фільтр Книга: Дюна",
      }),
    );

    await waitFor(() => expect(filterChipTexts()[0]).toBe("Усі13"));
    expect(summaryCardTexts()).toEqual(cardsWithFilter);
    expect(requestedUrls.filter((url) => url.includes("/api/quotes/summary"))).toHaveLength(1);
  });

  it("keeps the mobile overview reachable when the summary request fails", async () => {
    stubMobileViewport();
    mockQuotes(quotes(13), {
      overview: { memoryQuote: makeQuote(), postFinish: null },
      summaryStatus: 500,
    });

    renderQuotes();

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    expect(await screen.findByText(messages.common.summaryError.title)).toBeInTheDocument();
    const trigger = await screen.findByRole("button", { name: "Огляд цитат" });

    await waitFor(() =>
      expect(trigger.parentElement?.querySelectorAll('[data-slot="card"]')).toHaveLength(0),
    );
    expect(summaryCardTexts()).toHaveLength(0);

    await userEvent.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: "Огляд цитат" });

    expect(
      await within(drawer).findByRole("heading", {
        level: 2,
        name: messages.quotes.sidebar.rediscovery.title,
      }),
    ).toBeVisible();
    expect(
      within(drawer).queryByRole("heading", { name: messages.quotes.summary.mobile.title }),
    ).not.toBeInTheDocument();
  });

  it("keeps the loaded summary numbers when a summary refetch fails", async () => {
    mockQuotes(quotes(3));
    const { queryClient } = renderQuotes();
    await waitFor(() => expect(summaryCardTexts().join(" ")).toContain("Дюна"));
    const loadedCards = summaryCardTexts();

    mockQuotes(quotes(3), { summaryStatus: 500 });
    await act(() => queryClient.refetchQueries({ queryKey: quoteKeys.summary }));

    expect(requestedUrls.filter((url) => url.includes("/api/quotes/summary"))).toHaveLength(2);
    expect(summaryCardTexts()).toEqual(loadedCards);
    expect(screen.queryByText(messages.common.summaryError.title)).not.toBeInTheDocument();
  });
});

describe("QuotesView refetch failure", () => {
  it("keeps the loaded quotes and shows the refresh banner when a refetch fails", async () => {
    mockQuotes(quotes(3));
    const { queryClient } = renderQuotes();
    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();

    mockQuotes(quotes(3), { listStatus: 500 });
    await act(() => queryClient.invalidateQueries({ queryKey: quoteKeys.root }));

    expect(await screen.findByText(messages.common.refetchError)).toBeInTheDocument();
    expect(screen.getByText("Цитата 1")).toBeInTheDocument();
    expect(screen.queryByText(messages.quotes.error.load)).not.toBeInTheDocument();
  });
});

describe("QuotesView first-load retry", () => {
  it("moves keyboard focus to the quotes list while the retry request is pending", async () => {
    const retryName = messages.quotes.actions.retry;
    mockQuotes(quotes(3), { listStatus: 500 });
    renderQuotes();
    (await screen.findByRole("button", { name: retryName })).focus();

    mockQuotes(quotes(3), { listHeldUntil: () => new Promise<void>(() => undefined) });
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: retryName })).not.toBeInTheDocument(),
    );

    expect(screen.getByRole("region", { name: messages.quotes.listLabel })).toHaveFocus();
  });
});

describe("QuotesView overview blocks", () => {
  it("shows the rediscovery block above the post-finish block", async () => {
    mockQuotes(quotes(3), { overview: { memoryQuote: makeQuote(), postFinish: POST_FINISH } });

    renderQuotes();

    expect(
      await sidebar().findByRole("heading", { level: 2, name: "Згадати цитату" }),
    ).toBeVisible();
    expect(sidebarHeadings()).toEqual(["Згадати цитату", "Після завершення"]);
  });

  it("leaves the sidebar empty when the overview holds nothing", async () => {
    mockQuotes(quotes(3), { overview: EMPTY_OVERVIEW });

    renderQuotes();

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await waitFor(() => expect(overviewUrls()).toHaveLength(1));
    expect(sidebar().queryByRole("heading", { name: "Згадати цитату" })).not.toBeInTheDocument();
    expect(sidebar().queryByRole("heading", { name: "Після завершення" })).not.toBeInTheDocument();
    expect(sidebarElement().childElementCount).toBe(0);
  });

  it("asks for the overview once for both blocks that read it", async () => {
    mockQuotes(quotes(3), { overview: { memoryQuote: makeQuote(), postFinish: POST_FINISH } });

    renderQuotes();

    expect(
      await sidebar().findByRole("heading", { level: 2, name: "Після завершення" }),
    ).toBeVisible();
    expect(sidebar().getByRole("heading", { level: 2, name: "Згадати цитату" })).toBeVisible();
    expect(overviewUrls()).toHaveLength(1);
  });
});

describe("QuotesView overview blocks on a phone", () => {
  it("leaves the hidden sidebar out of the overview request", async () => {
    stubMobileViewport();
    mockQuotes(quotes(3), { overview: { memoryQuote: makeQuote(), postFinish: POST_FINISH } });

    renderQuotes();

    expect(await screen.findByText("Цитата 1")).toBeInTheDocument();
    await waitFor(() => expect(listUrls().length).toBeGreaterThan(0));
    expect(overviewUrls()).toHaveLength(0);
    expect(sidebar().queryByRole("heading", { name: "Згадати цитату" })).not.toBeInTheDocument();
  });

  it("keeps the full view of the rediscovered quote once the drawer is gone", async () => {
    stubMobileViewport();
    mockQuotes(quotes(3), { overview: { memoryQuote: makeQuote(), postFinish: null } });

    renderQuotes();

    await userEvent.click(await screen.findByRole("button", { name: "Огляд цитат" }));
    const drawer = await screen.findByRole("dialog", { name: "Огляд цитат" });
    await userEvent.click(
      await within(drawer).findByRole("button", { name: "Переглянути повністю" }),
    );

    expect(drawer).toHaveAttribute("data-state", "closed");
    await finishExitAnimation(drawer);
    expect(drawer.isConnected).toBe(false);

    const fullView = await screen.findByRole("dialog", { name: "Дюна" });
    expect(within(fullView).getByText("Страх — убивця розуму.")).toBeVisible();
  });
});

describe("QuotesView empty base", () => {
  const copy = messages.quotes;

  async function waitForEmptyBaseChrome() {
    await waitFor(() =>
      expect(screen.queryByRole("complementary", { name: "Огляд цитат" })).not.toBeInTheDocument(),
    );
  }

  it("offers only to add the first book when the library has no books", async () => {
    mockEmptyBase({ libraryTotal: 0 });
    renderQuotes();

    expect(
      await screen.findByRole("heading", { name: copy.empty.noBooks.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.empty.secondary })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: messages.books.firstBook.cta }));

    expect(routerPush).toHaveBeenCalledWith("/books/new");
  });

  it("hides the stats, toolbar, sidebar and header action while there are no quotes", async () => {
    mockEmptyBase({ libraryTotal: 0 });
    renderQuotes();

    expect(
      await screen.findByRole("heading", { name: copy.empty.noBooks.title }),
    ).toBeInTheDocument();
    await waitForEmptyBaseChrome();

    expect(summaryCardTexts()).toHaveLength(0);
    expect(
      screen.queryByRole("textbox", { name: copy.toolbar.searchLabel }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: SORT_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByText(/Показано 0 із 0/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.actions.add })).not.toBeInTheDocument();
  });

  it("opens the quote dialog from the empty state when the library has books", async () => {
    mockEmptyBase({ libraryTotal: 3 });
    renderQuotes();

    expect(await screen.findByRole("heading", { name: copy.empty.title })).toBeInTheDocument();
    await waitForEmptyBaseChrome();
    await userEvent.click(await screen.findByRole("button", { name: copy.actions.add }));

    const dialog = await screen.findByRole("dialog", { name: copy.dialog.addTitle });
    expect(
      within(dialog).getByRole("textbox", { name: copy.dialog.bookPicker.search }),
    ).toBeInTheDocument();
  });

  it("keeps the toolbar so a search that found nothing can be changed", async () => {
    mockEmptyBase();
    renderQuotes("?q=дюна");

    expect(await screen.findByRole("heading", { name: copy.noResults.title })).toBeInTheDocument();
    await waitForEmptyBaseChrome();

    expect(screen.getByRole("textbox", { name: copy.toolbar.searchLabel })).toHaveValue("дюна");
  });

  it("shows the error state when the library check fails and retries that check", async () => {
    mockEmptyBase({ libraryStatus: 500 });
    renderQuotes();

    expect(await screen.findByRole("heading", { name: copy.error.load })).toBeInTheDocument();

    mockEmptyBase({ libraryTotal: 0 });
    await userEvent.click(screen.getByRole("button", { name: copy.actions.retry }));

    expect(
      await screen.findByRole("heading", { name: copy.empty.noBooks.title }),
    ).toBeInTheDocument();
  });
});

function filterChipTexts(): string[] {
  return within(screen.getByRole("radiogroup", { name: "Швидкі фільтри цитат" }))
    .getAllByRole("radio")
    .map((chip) => chip.textContent ?? "");
}

async function finishExitAnimation(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new AnimationEvent("animationend", { animationName: "" }));
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function libraryOverview(total: number) {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: 0,
      series: 0,
      solo: 0,
      total,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function listUrl(): string {
  const [found] = listUrls();
  if (found === undefined) throw new Error("the quotes list was never requested");
  return found;
}

function listUrls(): string[] {
  return requestedUrls.filter((url) => pathnameOf(url) === "/api/quotes");
}

function mockEmptyBase(options: QuotesMockOptions = {}) {
  mockQuotes([], { facetsFor: () => EMPTY_FACETS, summary: EMPTY_SUMMARY, ...options });
}

function mockQuotes(items: QuoteView[], options: QuotesMockOptions = {}) {
  const {
    facetsFor = () => FACETS,
    libraryStatus = 200,
    libraryTotal = 5,
    listHeldUntil = () => Promise.resolve(),
    listStatus = 200,
    overview = EMPTY_OVERVIEW,
    summary = SUMMARY,
    summaryStatus = 200,
  } = options;

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      if (url.includes("/api/quotes/summary")) {
        return Promise.resolve(jsonResponse(summaryStatus === 200 ? summary : {}, summaryStatus));
      }
      if (url.includes("/api/quotes/overview")) return Promise.resolve(jsonResponse(overview));
      if (url.includes("/api/quotes/facets")) return Promise.resolve(jsonResponse(facetsFor(url)));
      if (url.includes("/api/quotes")) {
        return listHeldUntil(url).then(() =>
          listStatus === 200 ? jsonResponse(quotesPage(items, url)) : jsonResponse({}, listStatus),
        );
      }
      if (pathnameOf(url) === "/api/books/overview") {
        return Promise.resolve(
          jsonResponse(libraryStatus === 200 ? libraryOverview(libraryTotal) : {}, libraryStatus),
        );
      }
      if (url.includes("/api/books")) {
        return Promise.resolve(
          jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function overviewUrls(): string[] {
  return requestedUrls.filter((url) => pathnameOf(url) === "/api/quotes/overview");
}

function pathnameOf(url: string): string {
  return new URL(url, "http://localhost").pathname;
}

function quoteItem(index: number): QuoteView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Дж. Р. Р. Толкін",
      id: `book-${index}`,
      title: `Книга ${index}`,
    },
    bookId: `book-${index}`,
    chapter: null,
    comment: null,
    createdAt: "2026-01-05T10:00:00.000Z",
    id: `quote-${index}`,
    isFavorite: false,
    isSpoiler: false,
    page: index,
    text: `Цитата ${index}`,
    updatedAt: "2026-01-05T10:00:00.000Z",
  };
}

function quotes(count: number): QuoteView[] {
  return Array.from({ length: count }, (_, index) => quoteItem(index + 1));
}

function quotesPage(items: QuoteView[], url: string) {
  const params = new URL(url, "http://localhost").searchParams;
  const pageSize = Number(params.get("pageSize") ?? QUOTES_PAGE_SIZE);
  const page = Number(params.get("pageNumber") ?? 1);

  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    pagesCount: Math.ceil(items.length / pageSize),
    pageSize,
    totalCount: items.length,
  };
}

function regionBusyState(element: HTMLElement) {
  return element.closest("[aria-busy]")?.getAttribute("aria-busy");
}

function renderQuotes(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <QuotesView />
    </NuqsTestingAdapter>,
  );
}

function sidebar() {
  return within(sidebarElement());
}

function sidebarElement(): HTMLElement {
  return screen.getByRole("complementary", { name: "Огляд цитат" });
}

function sidebarHeadings(): string[] {
  return sidebar()
    .getAllByRole("heading", { level: 2 })
    .map((heading) => (heading.textContent ?? "").trim());
}

function stubMobileViewport() {
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: vi.fn(),
    matches: false,
    removeEventListener: vi.fn(),
  }));
}

function summaryCardTexts(): string[] {
  return [...document.querySelectorAll('[data-slot="stat-card"]')].map(
    (card) => card.textContent ?? "",
  );
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}
