import "@testing-library/jest-dom/vitest";

import type { BookView, QuotesFacetsView, QuoteView } from "@app/shared";
import type { UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookTabScrollMemory } from "@/hooks/use-book-tab-scroll-anchor";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { createBookTabScrollMemory } from "@/hooks/use-book-tab-scroll-anchor";
import {
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { makeQuote, makeQuoteBookCover } from "../model/quotes.fixtures";
import { BookQuotesTab } from "./book-quotes-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type ListReply = (url: URL) => Promise<Response>;

type PageMeta = { page: number; pagesCount: number; totalCount: number };

type TabRender = {
  book?: BookView;
  memory?: BookTabScrollMemory;
  onUrlUpdate?: (event: UrlUpdateEvent) => void;
  queryClient?: QueryClient;
  search?: string;
};

const BOOK: BookView = makeBookView({
  authors: [{ id: "author-1", name: "Френк Герберт" }],
  id: "book-1",
  title: "Дюна",
});

const OTHER_BOOK: BookView = makeBookView({ id: "book-2", title: "Месія Дюни" });

const FORTY_ONE_QUOTES = numberedQuotes(41);

const LAYOUT = { cardHeight: 100, listTop: 200, resultsTop: 150 } as const;

const NETWORK_LATENCY_MS = 10;

const FACETS: QuotesFacetsView = {
  authors: [],
  books: [],
  favoritesCount: 1,
  spoilerCount: 1,
  totalCount: 9,
  withCommentCount: 0,
  withoutCommentCount: 9,
  withoutSpoilerCount: 8,
};

const QUOTE_TEXT = "Страх — убивця розуму.";

const SPOILER_TEXT = "Пол стає імператором.";

const COPY = {
  addQuote: "Додати цитату",
  clearSearch: "Очистити пошук",
  emptyBook: "У цій книзі ще немає цитат",
  emptyFilters: "За цим фільтром цитат немає",
  emptySearch: "Нічого не знайдено",
  error: "Не вдалося завантажити цитати",
  loading: "Завантаження цитат...",
  nextPageError: "Не вдалося завантажити ще цитати",
  quickFilters: "Швидкі фільтри цитат",
  resetFilter: "Скинути фільтр",
  retry: "Повторити",
  search: "Пошук у цитатах цієї книги",
  spoilerGate: "Ця цитата містить спойлер",
  tabHeading: "Цитати",
} as const;

const PATHS = { facets: "/api/quotes/facets", list: "/api/quotes" } as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const viewport = mockIntersectionObserver();

let respondToList: ListReply;

function cachingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: Infinity } },
  });
}

async function findEmptyState(title: string): Promise<HTMLElement> {
  const container = (await screen.findByRole("heading", { name: title })).parentElement;
  if (container === null) throw new Error(`no empty state for ${title}`);
  return container;
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function lastRequest(pathname: string): URLSearchParams {
  const request = requests(pathname).at(-1);
  if (request === undefined) throw new Error(`no request to ${pathname}`);
  return request.searchParams;
}

function lastUrl(events: UrlUpdateEvent[]): URLSearchParams {
  const event = events.at(-1);
  if (event === undefined) throw new Error("no url update");
  return event.searchParams;
}

function layOutQuotesInOneColumn() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (!this.hasAttribute("data-quote-id")) {
      return new DOMRect(0, LAYOUT.resultsTop - window.scrollY, 600, 0);
    }
    const row = Array.from(this.parentElement?.children ?? []).indexOf(this);
    return new DOMRect(
      0,
      LAYOUT.listTop + row * LAYOUT.cardHeight - window.scrollY,
      600,
      LAYOUT.cardHeight,
    );
  });
}

function listPageNumbers(): number[] {
  return requests(PATHS.list).map(pageNumberOf);
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function numberedQuotes(count: number): QuoteView[] {
  return Array.from({ length: count }, (_, index) =>
    makeQuote({ id: `quote-${index + 1}`, text: `Цитата номер ${index + 1}` }),
  );
}

function pagedReply(quotes: readonly QuoteView[]): ListReply {
  return (url) => {
    const page = pageNumberOf(url);
    return withNetworkLatency(
      json(
        quotesPage(quotes.slice((page - 1) * 20, page * 20), {
          page,
          pagesCount: Math.ceil(quotes.length / 20),
          totalCount: quotes.length,
        }),
      ),
    );
  };
}

function pageNumberOf(url: URL): number {
  return Number(url.searchParams.get("pageNumber") ?? 1);
}

function pending(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

function quotesPage(items: QuoteView[], meta: Partial<PageMeta> = {}) {
  return {
    items,
    page: meta.page ?? 1,
    pagesCount: meta.pagesCount ?? (items.length === 0 ? 0 : 1),
    pageSize: 20,
    totalCount: meta.totalCount ?? items.length,
  };
}

function renderTab({ queryClient, ...options }: TabRender = {}) {
  return renderWithProviders(tab(options), { queryClient });
}

function requests(pathname: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === pathname);
}

function resultsStatus(): HTMLElement {
  const status = screen
    .getAllByRole("status")
    .find((element) => element.getAttribute("aria-live") === "polite" && element.tagName === "P");
  if (status === undefined) throw new Error("no results status");
  return status;
}

async function scrollWindowTo(top: number) {
  window.scrollTo({ top });
  window.dispatchEvent(new Event("scroll"));
  await nextFrame();
}

function sentinelStatus(): HTMLElement | undefined {
  return screen.queryAllByRole("status").find((element) => element.hasAttribute("aria-busy"));
}

function tab({
  book = BOOK,
  memory = createBookTabScrollMemory(),
  onUrlUpdate,
  search = "",
}: Omit<TabRender, "queryClient"> = {}) {
  return (
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={search}>
      <BookQuotesTab book={book} key={book.id} scrollMemory={memory} />
    </NuqsTestingAdapter>
  );
}

function withNetworkLatency(reply: Promise<Response>): Promise<Response> {
  return new Promise((resolve) => setTimeout(() => resolve(reply), NETWORK_LATENCY_MS));
}

beforeEach(() => {
  respondToList = () => json(quotesPage([makeQuote({ text: QUOTE_TEXT })]));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === PATHS.facets) return json(FACETS);
    if (method === "GET" && url.pathname === PATHS.list) return respondToList(url);
    if (method === "GET" && url.pathname === "/api/books/book-1/chapters") {
      return json({ chapters: [] });
    }
    if (method === "GET" && url.pathname === "/api/books/book-1") {
      return json({ ...BOOK, notesCount: 0, quotesCount: 1 });
    }
    return Promise.reject(new Error(`unexpected ${method} ${url.pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.scrollTo({ top: 0 });
});

describe("BookQuotesTab cards", () => {
  it("renders embedded cards without repeating the book title, author or cover", async () => {
    respondToList = () =>
      json(
        quotesPage([
          makeQuote({
            book: { ...makeQuote().book, cover: makeQuoteBookCover() },
            text: QUOTE_TEXT,
          }),
        ]),
      );

    renderTab();

    const card = (await screen.findByText(QUOTE_TEXT)).closest("article");
    if (card === null) throw new Error("no card");

    expect(within(card).queryByText(BOOK.title)).not.toBeInTheDocument();
    expect(within(card).queryByText("Френк Герберт")).not.toBeInTheDocument();
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
    expect(card.querySelector("img")).toBeNull();
  });

  it("keeps a spoiler quote's text out of the DOM behind the gate", async () => {
    respondToList = () => json(quotesPage([makeQuote({ isSpoiler: true, text: SPOILER_TEXT })]));

    renderTab();

    expect(await screen.findByText(COPY.spoilerGate)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(SPOILER_TEXT);
  });

  it("keeps the spoiler gated when the tab search matches the spoiler quote", async () => {
    respondToList = (url) =>
      json(
        quotesPage(
          url.searchParams.get("q") === "імператор"
            ? [makeQuote({ isSpoiler: true, text: SPOILER_TEXT })]
            : [],
        ),
      );

    renderTab({ search: "?quoteQ=імператор" });

    expect(await screen.findByText(COPY.spoilerGate)).toBeInTheDocument();
    expect(lastRequest(PATHS.list).get("q")).toBe("імператор");
    expect(document.body).not.toHaveTextContent(SPOILER_TEXT);
  });
});

describe("BookQuotesTab requests", () => {
  it("asks for this book's quotes only, 20 per page, in page order", async () => {
    renderTab();

    await screen.findByText(QUOTE_TEXT);

    expect(Object.fromEntries(lastRequest(PATHS.list))).toEqual({
      book: BOOK.id,
      filter: "all",
      pageNumber: "1",
      pageSize: "20",
      searchIn: "quotes",
      sort: "page",
    });
    expect(Object.fromEntries(lastRequest(PATHS.facets))).toEqual({
      book: BOOK.id,
      searchIn: "quotes",
    });
  });

  it("searches the quote fields only, inside this book", async () => {
    renderTab();

    await userEvent.type(await screen.findByRole("textbox", { name: COPY.search }), "страх");

    await waitFor(() => expect(lastRequest(PATHS.list).get("q")).toBe("страх"));
    expect(lastRequest(PATHS.list).get("searchIn")).toBe("quotes");
    expect(lastRequest(PATHS.list).getAll("book")).toEqual([BOOK.id]);
    expect(lastRequest(PATHS.facets).get("q")).toBe("страх");
    expect(lastRequest(PATHS.facets).get("searchIn")).toBe("quotes");
  });
});

describe("BookQuotesTab announcements", () => {
  it("titles the quotes list for screen readers", async () => {
    renderTab();

    await screen.findByText(QUOTE_TEXT);

    expect(screen.getByRole("heading", { level: 2, name: COPY.tabHeading })).toBeInTheDocument();
  });

  it("announces the server total of the current criteria", async () => {
    respondToList = () => json(quotesPage([makeQuote({ text: QUOTE_TEXT })], { totalCount: 9 }));

    renderTab();

    await screen.findByText(QUOTE_TEXT);
    expect(resultsStatus()).toHaveTextContent("Знайдено 9 цитат");
  });
});

describe("BookQuotesTab states", () => {
  it("shows the skeleton, never the empty state, before the first page arrives", () => {
    respondToList = pending;

    renderTab();

    expect(screen.getByRole("group", { name: COPY.loading })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: COPY.emptyBook })).not.toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent(COPY.loading);
  });

  it("hides the toolbar and offers to add the first quote of this book", async () => {
    respondToList = () => json(quotesPage([]));

    renderTab();

    const empty = await findEmptyState(COPY.emptyBook);
    expect(screen.queryByRole("textbox", { name: COPY.search })).not.toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent(COPY.emptyBook);

    await userEvent.click(within(empty).getByRole("button", { name: COPY.addQuote }));

    const dialog = await screen.findByRole("dialog", { name: COPY.addQuote });
    expect(within(dialog).getByRole("group", { name: "Книга" })).toHaveTextContent(BOOK.title);
  });

  it("clears only the search when a search finds nothing", async () => {
    const events: UrlUpdateEvent[] = [];
    respondToList = () => json(quotesPage([]));

    renderTab({
      onUrlUpdate: (event) => events.push(event),
      search: "?quoteQ=дракон&quoteSort=newest",
    });

    const empty = await findEmptyState(COPY.emptySearch);
    expect(resultsStatus()).toHaveTextContent(COPY.emptySearch);
    await userEvent.click(within(empty).getByRole("button", { name: COPY.clearSearch }));

    await waitFor(() => expect(lastUrl(events).get("quoteQ")).toBeNull());
    expect(lastUrl(events).get("quoteSort")).toBe("newest");
  });

  it("resets only the filter when the filter matches nothing", async () => {
    const events: UrlUpdateEvent[] = [];
    respondToList = () => json(quotesPage([]));

    renderTab({
      onUrlUpdate: (event) => events.push(event),
      search: "?quoteFilter=with_comment&quoteSort=newest",
    });

    const empty = await findEmptyState(COPY.emptyFilters);
    expect(within(empty).queryByRole("button", { name: COPY.addQuote })).not.toBeInTheDocument();
    expect(resultsStatus()).toHaveTextContent(COPY.emptyFilters);
    await userEvent.click(within(empty).getByRole("button", { name: COPY.resetFilter }));

    await waitFor(() => expect(lastUrl(events).get("quoteFilter")).toBeNull());
    expect(lastUrl(events).get("quoteSort")).toBe("newest");
  });

  it("retries the first page after it fails", async () => {
    respondToList = () => json({ message: "boom" }, 500);

    renderTab();

    expect(await screen.findByText(COPY.error)).toBeInTheDocument();
    respondToList = () => json(quotesPage([makeQuote({ text: QUOTE_TEXT })]));

    await userEvent.click(screen.getByRole("button", { name: COPY.retry }));

    expect(await screen.findByText(QUOTE_TEXT)).toBeInTheDocument();
  });
});

describe("BookQuotesTab add quote", () => {
  it("opens the add dialog from the toolbar with this book preselected", async () => {
    renderTab();

    await screen.findByText(QUOTE_TEXT);
    await userEvent.click(screen.getByRole("button", { name: COPY.addQuote }));

    const dialog = await screen.findByRole("dialog", { name: COPY.addQuote });
    expect(within(dialog).getByRole("group", { name: "Книга" })).toHaveTextContent(BOOK.title);
    expect(within(dialog).queryByRole("combobox", { name: /Книга/ })).not.toBeInTheDocument();
  });
});

describe("BookQuotesTab endless scroll", () => {
  it.each([
    [0, [1]],
    [1, [1]],
    [19, [1]],
    [20, [1]],
    [21, [1, 2]],
    [40, [1, 2]],
    [41, [1, 2, 3]],
  ])("loads %i quotes in pages %j of 20", async (count, pages) => {
    const quotes = numberedQuotes(count);
    respondToList = pagedReply(quotes);

    const findLastShown = (shown: number) =>
      shown === 0
        ? screen.findByRole("heading", { name: COPY.emptyBook })
        : screen.findByText(`Цитата номер ${shown}`);

    renderTab();

    expect(await findLastShown(Math.min(count, 20))).toBeInTheDocument();
    viewport.enterViewport();

    expect(await findLastShown(count)).toBeInTheDocument();
    await waitFor(() => expect(sentinelStatus()).toBeUndefined());
    viewport.enterViewport();

    expect(listPageNumbers()).toEqual(pages);
    expect(requests(PATHS.list).every((url) => url.searchParams.get("pageSize") === "20")).toBe(
      true,
    );
    expect(screen.queryAllByRole("article")).toHaveLength(count);
  });

  it("asks for the next page only while the sentinel is in view and no page is pending", async () => {
    respondToList = pagedReply(FORTY_ONE_QUOTES);

    renderTab();

    expect(await screen.findByText("Цитата номер 20")).toBeInTheDocument();
    expect(sentinelStatus()).toHaveAttribute("aria-live", "polite");
    expect(listPageNumbers()).toEqual([1]);

    viewport.enterViewport();
    viewport.enterViewport();

    expect(await screen.findByText("Цитата номер 41")).toBeInTheDocument();
    expect(listPageNumbers()).toEqual([1, 2, 3]);
  });

  it("keeps every loaded page however many pages arrive", async () => {
    const quotes = numberedQuotes(11);
    respondToList = (url) => {
      const page = pageNumberOf(url);
      return withNetworkLatency(
        json(quotesPage(quotes.slice(page - 1, page), { page, pagesCount: 11, totalCount: 11 })),
      );
    };

    renderTab();

    await screen.findByText("Цитата номер 1");
    viewport.enterViewport();

    await waitFor(() => expect(listPageNumbers()).toHaveLength(11), { timeout: 5000 });
    expect(await screen.findByText("Цитата номер 11")).toBeInTheDocument();
    expect(listPageNumbers()).toEqual(Array.from({ length: 11 }, (_, index) => index + 1));
    expect(screen.getAllByRole("article")).toHaveLength(11);
    expect(screen.getByText("Цитата номер 1")).toBeInTheDocument();
  });

  it("does not move focus when the observer appends a page", async () => {
    respondToList = pagedReply(FORTY_ONE_QUOTES);

    renderTab();

    await screen.findByText("Цитата номер 20");
    const addButton = screen.getByRole("button", { name: COPY.addQuote });
    addButton.focus();

    viewport.enterViewport();

    expect(await screen.findByText("Цитата номер 41")).toBeInTheDocument();
    expect(addButton).toHaveFocus();
  });

  it("keeps the loaded cards when the next page fails and retries only that page, once", async () => {
    let failSecondPage = true;
    respondToList = (url) => {
      const page = pageNumberOf(url);
      if (page === 2 && failSecondPage) {
        failSecondPage = false;
        return json({ message: "boom" }, 500);
      }
      return json(
        quotesPage([makeQuote({ id: `quote-${page}`, text: `Сторінка ${page}` })], {
          page,
          pagesCount: 2,
          totalCount: 2,
        }),
      );
    };

    renderTab();

    await screen.findByText("Сторінка 1");
    viewport.enterViewport();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(COPY.nextPageError);
    expect(screen.getByText("Сторінка 1")).toBeInTheDocument();
    expect(listPageNumbers()).toEqual([1, 2]);
    expect(within(alert).getByRole("button", { name: COPY.retry })).not.toHaveFocus();

    await userEvent.click(within(alert).getByRole("button", { name: COPY.retry }));

    expect(await screen.findByText("Сторінка 2")).toBeInTheDocument();
    expect(screen.getByText("Сторінка 1")).toBeInTheDocument();
    expect(listPageNumbers()).toEqual([1, 2, 2]);
  });

  it("asks for a failed first page once, not twice", async () => {
    respondToList = () => json({ message: "boom" }, 500);

    renderTab();

    expect(await screen.findByText(COPY.error)).toBeInTheDocument();
    expect(listPageNumbers()).toEqual([1]);
  });
});

describe("BookQuotesTab cache", () => {
  it("shows the cached cards at once when the tab is opened again while it refetches", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: 0 } },
    });
    const { rerender } = renderTab({ queryClient });

    await screen.findByText(QUOTE_TEXT);
    rerender(<NuqsTestingAdapter hasMemory>{null}</NuqsTestingAdapter>);
    expect(screen.queryByText(QUOTE_TEXT)).not.toBeInTheDocument();

    respondToList = pending;
    rerender(tab());

    expect(screen.getByText(QUOTE_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: COPY.loading })).not.toBeInTheDocument();
    await waitFor(() => expect(listPageNumbers()).toEqual([1, 1]));
  });

  it("shows the skeleton instead of the previous cards while new criteria load", async () => {
    respondToList = (url) =>
      url.searchParams.get("filter") === "favorites"
        ? pending()
        : json(quotesPage([makeQuote({ text: "Звичайна цитата" })]));

    renderTab();

    await screen.findByText("Звичайна цитата");
    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Улюблені/ }));

    expect(await screen.findByRole("group", { name: COPY.loading })).toBeInTheDocument();
    expect(screen.queryByText("Звичайна цитата")).not.toBeInTheDocument();
  });

  it("never renders the previous book's cards for another book", async () => {
    respondToList = (url) =>
      url.searchParams.get("book") === OTHER_BOOK.id
        ? pending()
        : json(quotesPage([makeQuote({ text: "Цитата першої книги" })]));

    const { rerender } = renderTab();

    await screen.findByText("Цитата першої книги");
    rerender(tab({ book: OTHER_BOOK }));

    expect(screen.queryByText("Цитата першої книги")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: COPY.loading })).toBeInTheDocument();
  });

  it("drops a late answer for the previous book after another book opens", async () => {
    let answerFirstBook: () => void = () => undefined;
    respondToList = (url) => {
      if (url.searchParams.get("book") === OTHER_BOOK.id) {
        return json(
          quotesPage([makeQuote({ bookId: OTHER_BOOK.id, text: "Цитата другої книги" })]),
        );
      }
      return new Promise<Response>((resolve) => {
        answerFirstBook = () =>
          void json(quotesPage([makeQuote({ text: "Запізніла цитата" })])).then(resolve);
      });
    };

    const { rerender } = renderTab();
    rerender(tab({ book: OTHER_BOOK }));
    expect(await screen.findByText("Цитата другої книги")).toBeInTheDocument();

    await act(async () => answerFirstBook());

    expect(screen.queryByText("Запізніла цитата")).not.toBeInTheDocument();
    expect(screen.getByText("Цитата другої книги")).toBeInTheDocument();
  });
});

describe("BookQuotesTab URL criteria", () => {
  it("opens on the favorites chip straight from a deep link", async () => {
    renderTab({ search: "?tab=quotes&quoteFilter=favorites" });

    const chips = within(await screen.findByRole("radiogroup", { name: COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Улюблені/ })).toBeChecked();
    expect(lastRequest(PATHS.list).get("filter")).toBe("favorites");
  });

  it("follows the browser back and forward through the quote search and sort", async () => {
    const { rerender } = renderTab({ search: "?quoteQ=страх&quoteSort=newest" });
    await screen.findByText(QUOTE_TEXT);

    rerender(tab({ search: "?quoteSort=oldest" }));

    await waitFor(() => expect(lastRequest(PATHS.list).get("sort")).toBe("oldest"));
    expect(lastRequest(PATHS.list).get("q")).toBeNull();
    expect(screen.getByRole("textbox", { name: COPY.search })).toHaveValue("");

    rerender(tab({ search: "?quoteQ=страх&quoteSort=newest" }));

    await waitFor(() => expect(lastRequest(PATHS.list).get("sort")).toBe("newest"));
    expect(lastRequest(PATHS.list).get("q")).toBe("страх");
    expect(screen.getByRole("textbox", { name: COPY.search })).toHaveValue("страх");
  });

  it("opens another book on the default criteria when its URL carries no quote params", async () => {
    const { rerender } = renderTab({
      search: "?quoteQ=страх&quoteFilter=favorites&quoteSort=newest",
    });
    await screen.findByText(QUOTE_TEXT);

    rerender(tab({ book: OTHER_BOOK, search: "" }));

    await waitFor(() => expect(lastRequest(PATHS.list).get("book")).toBe(OTHER_BOOK.id));
    expect(lastRequest(PATHS.list).get("filter")).toBe("all");
    expect(lastRequest(PATHS.list).get("sort")).toBe("page");
    expect(lastRequest(PATHS.list).get("q")).toBeNull();
    const chips = within(await screen.findByRole("radiogroup", { name: COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Усі/ })).toBeChecked();
    expect(screen.getByRole("textbox", { name: COPY.search })).toHaveValue("");
  });

  it("lets the quote params on another book's URL win over the defaults", async () => {
    const { rerender } = renderTab({ search: "?quoteFilter=favorites" });
    await screen.findByText(QUOTE_TEXT);

    rerender(tab({ book: OTHER_BOOK, search: "?quoteFilter=with_spoiler&quoteSort=oldest" }));

    await waitFor(() => expect(lastRequest(PATHS.list).get("book")).toBe(OTHER_BOOK.id));
    expect(lastRequest(PATHS.list).get("filter")).toBe("with_spoiler");
    expect(lastRequest(PATHS.list).get("sort")).toBe("oldest");
    const chips = within(await screen.findByRole("radiogroup", { name: COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Зі спойлерами/ })).toBeChecked();
  });

  it("neither reads nor writes the global archive keys", async () => {
    const events: UrlUpdateEvent[] = [];
    const archiveKeys = {
      author: "author-9",
      book: "book-9",
      bookId: "book-9",
      createdFrom: "2026-01-01",
      createdTo: "2026-02-01",
      filter: "favorites",
      q: "глобальний",
      sort: "oldest",
      view: "list",
    } as const;
    renderTab({
      onUrlUpdate: (event) => events.push(event),
      search: `?${new URLSearchParams(archiveKeys).toString()}`,
    });
    await screen.findByText(QUOTE_TEXT);

    expect(Object.fromEntries(lastRequest(PATHS.list))).toEqual({
      book: BOOK.id,
      filter: "all",
      pageNumber: "1",
      pageSize: "20",
      searchIn: "quotes",
      sort: "page",
    });
    expect(screen.getByRole("textbox", { name: COPY.search })).toHaveValue("");

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^З коментарем/ }));

    await waitFor(() => expect(lastUrl(events).get("quoteFilter")).toBe("with_comment"));
    expect(Object.fromEntries(lastUrl(events))).toEqual({
      ...archiveKeys,
      quoteFilter: "with_comment",
    });
  });
});

describe("BookQuotesTab scroll position", () => {
  it("returns to the quote captured on leaving, not to where a later scroll clamped the page", async () => {
    const memory = createBookTabScrollMemory();
    respondToList = pagedReply(FORTY_ONE_QUOTES);
    layOutQuotesInOneColumn();

    const { rerender } = renderTab({ memory, queryClient: cachingQueryClient() });
    await screen.findByText("Цитата номер 20");
    viewport.enterViewport();
    await screen.findByText("Цитата номер 41");
    await scrollWindowTo(2530);
    expect(memory.anchorRef.current).toBeNull();

    memory.capture();
    await scrollWindowTo(541);
    expect(memory.anchorRef.current).toMatchObject({
      bookId: BOOK.id,
      cardId: "quote-24",
      offset: -30,
      scrollY: 2530,
    });

    rerender(<NuqsTestingAdapter hasMemory>{null}</NuqsTestingAdapter>);
    const scrollTo = vi.spyOn(window, "scrollTo");
    rerender(tab({ memory }));

    expect(screen.getAllByRole("article")).toHaveLength(41);
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 2530 });
    expect(window.scrollY).toBe(2530);
    expect(memory.anchorRef.current).toBeNull();
  });

  it("keeps its own position when the criteria in the URL changed while the tab was away", async () => {
    const memory = createBookTabScrollMemory();
    const queryClient = cachingQueryClient();
    respondToList = pagedReply(FORTY_ONE_QUOTES);
    layOutQuotesInOneColumn();

    const view = renderTab({ memory, queryClient });
    await screen.findByText("Цитата номер 20");
    await scrollWindowTo(1030);
    memory.capture();
    expect(memory.anchorRef.current?.cardId).toBe("quote-9");
    view.unmount();

    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");
    renderTab({ memory, queryClient, search: "?quoteSort=newest" });

    expect(await screen.findByText("Цитата номер 20")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("brings the results start into view and restarts at page 1 when the criteria change below it", async () => {
    respondToList = pagedReply(FORTY_ONE_QUOTES);
    layOutQuotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    renderTab();
    await screen.findByText("Цитата номер 20");
    viewport.enterViewport();
    await screen.findByText("Цитата номер 41");
    await scrollWindowTo(2530);
    const scrollTo = vi.spyOn(window, "scrollTo");

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Улюблені/ }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start" }));
    await waitFor(() =>
      expect(
        requests(PATHS.list).some((url) => url.searchParams.get("filter") === "favorites"),
      ).toBe(true),
    );
    const favoritesPages = requests(PATHS.list)
      .filter((url) => url.searchParams.get("filter") === "favorites")
      .map(pageNumberOf);
    expect(favoritesPages[0]).toBe(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("leaves the scroll alone when the criteria change while the results start is in view", async () => {
    layOutQuotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    renderTab();
    await screen.findByText(QUOTE_TEXT);

    const chips = within(screen.getByRole("radiogroup", { name: COPY.quickFilters }));
    await userEvent.click(chips.getByRole("radio", { name: /^Улюблені/ }));

    await waitFor(() => expect(lastRequest(PATHS.list).get("filter")).toBe("favorites"));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps the reader in place when an edit moves a card or a delete removes one", async () => {
    let pageQuotes = FORTY_ONE_QUOTES.slice(0, 20);
    respondToList = () => json(quotesPage(pageQuotes));
    layOutQuotesInOneColumn();
    const scrollIntoView = vi
      .spyOn(Element.prototype, "scrollIntoView")
      .mockImplementation(() => undefined);

    const { queryClient } = renderTab();
    await screen.findByText("Цитата номер 20");
    await scrollWindowTo(1030);
    const scrollTo = vi.spyOn(window, "scrollTo");

    const edited = makeQuote({ id: "quote-9", text: "Цитата номер 9, змінена" });
    pageQuotes = [
      edited,
      ...pageQuotes.filter((quote) => quote.id !== "quote-9" && quote.id !== "quote-10"),
    ];
    await act(() => queryClient.invalidateQueries());

    await waitFor(() => expect(screen.queryByText("Цитата номер 10")).not.toBeInTheDocument());
    expect(screen.getAllByRole("article")[0]).toHaveTextContent(edited.text);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(1030);
  });
});
