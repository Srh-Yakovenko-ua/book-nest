import "@testing-library/jest-dom/vitest";

import type { NoteView, QuoteView } from "@app/shared";
import type { ComponentProps } from "react";

import { QueryClient } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookNote } from "@/features/notes/model/notes.fixtures";
import { makeQuote } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { BookDetailsView } from "./book-details-view";
import { makeBookDetailsView } from "./book-details.fixtures";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type DetailsRender = {
  bookId?: string;
  search?: string;
};

type TabCounts = {
  notesCount?: number;
  quotesCount?: number;
};

const BOOK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const OTHER_BOOK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const LAYOUT = { cardHeight: 100, listTop: 200, resultsTop: 150 } as const;

const NOTES_COPY = { quickFilters: "Швидкі фільтри" } as const;

const TWENTY_NOTES = Array.from({ length: 20 }, (_, index) =>
  makeBookNote({ id: `note-${index + 1}`, text: `Нотатка номер ${index + 1}` }),
);

const TWENTY_QUOTES = Array.from({ length: 20 }, (_, index) =>
  makeQuote({ bookId: BOOK_ID, id: `quote-${index + 1}`, text: `Цитата номер ${index + 1}` }),
);

const NOTES_PATHS = {
  bookNotes: `/api/books/${BOOK_ID}/notes`,
  facets: "/api/notes/books/facets",
  list: "/api/notes/books",
} as const;

const QUOTES_PATHS = {
  bookQuotes: `/api/books/${BOOK_ID}/quotes`,
  facets: "/api/quotes/facets",
  list: "/api/quotes",
} as const;

const TABS = {
  characters: "Персонажі",
  history: "Повна історія читання",
  notes: "Нотатки",
  overview: "Огляд",
  quotes: "Цитати",
  timeline: /^Хронологія/,
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToList: (url: URL) => Promise<Response>;

let quotesOnPage: QuoteView[];

let visibleCharacters: number;

function cachingQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false, staleTime: Infinity } },
  });
}

function characterSummary(totalVisibleCharacters: number) {
  return {
    bookId: BOOK_ID,
    byImportance: { central: 0, episodic: 0, major: 0, mentioned: 0, supporting: 0 },
    favoritesCount: 0,
    povCount: 0,
    top: [],
    totalVisibleCharacters,
  };
}

function detailsView({ bookId = BOOK_ID, search = "?tab=notes" }: DetailsRender = {}) {
  return (
    <NuqsTestingAdapter hasMemory searchParams={search}>
      <BookDetailsView book={makeBookDetailsView({ id: bookId, notesCount: 20 })} />
    </NuqsTestingAdapter>
  );
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function layOutCardsInOneColumn(cardAttribute: "data-note-id" | "data-quote-id") {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (!this.hasAttribute(cardAttribute)) {
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

function listFilters(): (null | string)[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === NOTES_PATHS.list)
    .map((url) => url.searchParams.get("filter"));
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function notesPage(items: readonly NoteView[]): Promise<Response> {
  return json({ items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length });
}

function notesTab(): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(`^${TABS.notes}`) });
}

function quotesTab(): HTMLElement {
  return screen.getByRole("tab", { name: new RegExp(`^${TABS.quotes}`) });
}

function renderView({ notesCount = 0, quotesCount = 0 }: TabCounts = {}) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <BookDetailsView book={makeBookDetailsView({ id: BOOK_ID, notesCount, quotesCount })} />
    </NuqsTestingAdapter>,
  );
}

function requestedPaths(): string[] {
  return fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost").pathname);
}

async function scrollWindowTo(top: number) {
  window.scrollTo({ top });
  window.dispatchEvent(new Event("scroll"));
  await nextFrame();
}

beforeEach(() => {
  respondToList = () => notesPage([]);
  quotesOnPage = [];
  visibleCharacters = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === NOTES_PATHS.list) return respondToList(url);
    if (url.pathname === QUOTES_PATHS.list) {
      return json({
        items: quotesOnPage,
        page: 1,
        pagesCount: quotesOnPage.length === 0 ? 0 : 1,
        pageSize: 20,
        totalCount: quotesOnPage.length,
      });
    }
    if (url.pathname === `/api/books/${BOOK_ID}/character-summary`) {
      return json(characterSummary(visibleCharacters));
    }
    return json({ message: "not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  window.scrollTo({ top: 0 });
});

describe("BookDetailsView tabs", () => {
  it("puts notes right after the overview and quotes right after notes", () => {
    renderView();

    const tabs = screen.getAllByRole("tab");

    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveTextContent(TABS.overview);
    expect(tabs[1]).toHaveTextContent(TABS.notes);
    expect(tabs[2]).toHaveTextContent(TABS.quotes);
    expect(tabs[3]).toHaveTextContent(TABS.history);
    expect(tabs[4]).toHaveTextContent(TABS.characters);
    expect(tabs[5]).toHaveTextContent(TABS.timeline);
  });

  it("shows no notes badge for a book without notes", () => {
    renderView({ notesCount: 0 });

    expect(notesTab()).toHaveTextContent(new RegExp(`^${TABS.notes}$`));
  });

  it("shows no quotes badge for a book without quotes", () => {
    renderView({ quotesCount: 0 });

    expect(quotesTab()).toHaveTextContent(new RegExp(`^${TABS.quotes}$`));
    expect(screen.getByRole("tab", { name: TABS.quotes })).toBe(quotesTab());
  });

  it("shows the book quotes count on the quotes tab", () => {
    renderView({ quotesCount: 11 });

    expect(within(quotesTab()).getByText("11")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`^${TABS.quotes}\\s*, 11$`) })).toBe(
      quotesTab(),
    );
  });

  it("shows the book notes count on the notes tab", () => {
    renderView({ notesCount: 11 });

    expect(within(notesTab()).getByText("11")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: new RegExp(`^${TABS.notes}\\s*, 11$`) })).toBe(
      notesTab(),
    );
  });

  it("separates the characters count from the label for screen readers", async () => {
    visibleCharacters = 3;

    renderView();

    expect(
      await screen.findByRole("tab", { name: new RegExp(`^${TABS.characters}\\s*, 3$`) }),
    ).toHaveTextContent(new RegExp(`^${TABS.characters}, 3$`));
  });
});

describe("BookDetailsView overview", () => {
  it("drops the notes block and asks nothing about notes until the notes tab opens", async () => {
    renderView({ notesCount: 11 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByText("Мої нотатки")).not.toBeInTheDocument();
    expect(requestedPaths()).not.toContain(NOTES_PATHS.list);
    expect(requestedPaths()).not.toContain(NOTES_PATHS.facets);
    expect(requestedPaths()).not.toContain(NOTES_PATHS.bookNotes);

    await userEvent.click(notesTab());

    await waitFor(() => expect(requestedPaths()).toContain(NOTES_PATHS.list));
    expect(requestedPaths()).toContain(NOTES_PATHS.facets);
    expect(requestedPaths()).not.toContain(NOTES_PATHS.bookNotes);
  });

  it("drops the quotes block and asks nothing about quotes until the quotes tab opens", async () => {
    renderView({ quotesCount: 11 });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.queryByText("Цитати з книги")).not.toBeInTheDocument();
    expect(within(quotesTab()).getByText("11")).toBeInTheDocument();
    expect(requestedPaths().filter((path) => path.startsWith("/api/quotes"))).toEqual([]);
    expect(requestedPaths()).not.toContain(QUOTES_PATHS.list);
    expect(requestedPaths()).not.toContain(QUOTES_PATHS.facets);
    expect(requestedPaths()).not.toContain(QUOTES_PATHS.bookQuotes);

    await userEvent.click(quotesTab());

    await waitFor(() => expect(requestedPaths()).toContain(QUOTES_PATHS.list));
    expect(requestedPaths()).toContain(QUOTES_PATHS.facets);
    expect(requestedPaths()).not.toContain(QUOTES_PATHS.bookQuotes);
  });
});

describe("BookDetailsView notes URL", () => {
  it("opens the notes tab on the favourites chip straight from the URL", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);

    renderWithProviders(detailsView({ search: "?tab=notes&noteFilter=favorite" }));

    const chips = within(await screen.findByRole("radiogroup", { name: NOTES_COPY.quickFilters }));
    expect(chips.getByRole("radio", { name: /^Улюблені/ })).toBeChecked();
    expect(notesTab()).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(listFilters()).toEqual(["favorite"]));
  });
});

describe("BookDetailsView notes scroll position", () => {
  it("brings the reader back to the same note after a trip to another tab", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);
    layOutCardsInOneColumn("data-note-id");

    renderWithProviders(detailsView(), { queryClient: cachingQueryClient() });
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(1030);

    await userEvent.click(screen.getByRole("tab", { name: TABS.overview }));
    expect(screen.queryByText("Нотатка номер 20")).not.toBeInTheDocument();
    await scrollWindowTo(541);
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(notesTab());

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 1030 });
  });

  it("does not bring back the position of book A after the reader visits book B", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);
    layOutCardsInOneColumn("data-note-id");

    const { rerender } = renderWithProviders(detailsView(), {
      queryClient: cachingQueryClient(),
    });
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(1030);
    await userEvent.click(screen.getByRole("tab", { name: TABS.overview }));

    rerender(detailsView({ bookId: OTHER_BOOK_ID }));
    expect(screen.getByRole("tab", { name: TABS.overview })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    rerender(detailsView({ bookId: BOOK_ID }));
    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(notesTab());

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("BookDetailsView quotes scroll position", () => {
  it("brings the reader back to the same quote after a trip to another tab", async () => {
    quotesOnPage = TWENTY_QUOTES;
    layOutCardsInOneColumn("data-quote-id");

    renderWithProviders(detailsView({ search: "?tab=quotes" }), {
      queryClient: cachingQueryClient(),
    });
    await screen.findByText("Цитата номер 20");
    await scrollWindowTo(1030);

    await userEvent.click(screen.getByRole("tab", { name: TABS.history }));
    expect(screen.queryByText("Цитата номер 20")).not.toBeInTheDocument();
    await scrollWindowTo(541);
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(quotesTab());

    expect(await screen.findByText("Цитата номер 20")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 1030 });
  });

  it("does not bring back the position of book A after the reader visits book B", async () => {
    quotesOnPage = TWENTY_QUOTES;
    layOutCardsInOneColumn("data-quote-id");

    const { rerender } = renderWithProviders(detailsView({ search: "?tab=quotes" }), {
      queryClient: cachingQueryClient(),
    });
    await screen.findByText("Цитата номер 20");
    await scrollWindowTo(1030);
    await userEvent.click(screen.getByRole("tab", { name: TABS.overview }));

    rerender(detailsView({ bookId: OTHER_BOOK_ID, search: "?tab=quotes" }));
    expect(screen.getByRole("tab", { name: TABS.overview })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    rerender(detailsView({ bookId: BOOK_ID, search: "?tab=quotes" }));
    window.scrollTo({ top: 0 });
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(quotesTab());

    expect(await screen.findByText("Цитата номер 20")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps the notes and quotes positions apart", async () => {
    respondToList = () => notesPage(TWENTY_NOTES);
    quotesOnPage = TWENTY_QUOTES;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const row = Array.from(this.parentElement?.children ?? []).indexOf(this);
      const isCard = this.hasAttribute("data-note-id") || this.hasAttribute("data-quote-id");
      return isCard
        ? new DOMRect(0, LAYOUT.listTop + row * LAYOUT.cardHeight - window.scrollY, 600, 100)
        : new DOMRect(0, LAYOUT.resultsTop - window.scrollY, 600, 0);
    });

    renderWithProviders(detailsView({ search: "?tab=quotes" }), {
      queryClient: cachingQueryClient(),
    });
    await screen.findByText("Цитата номер 20");
    await scrollWindowTo(1030);
    await userEvent.click(notesTab());
    await screen.findByText("Нотатка номер 20");
    await scrollWindowTo(530);
    await userEvent.click(quotesTab());
    await screen.findByText("Цитата номер 20");
    await scrollWindowTo(0);
    const scrollTo = vi.spyOn(window, "scrollTo");

    await userEvent.click(notesTab());

    expect(await screen.findByText("Нотатка номер 20")).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", top: 530 });
  });
});
