import "@testing-library/jest-dom/vitest";

import type { BookView, FavoritesSummaryView, LibraryQuickCounts } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { FavoritesView } from "./favorites-view";

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/favorites",
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToBookUpdate: () => Response;
let respondToBulkDelete: () => Response;
let favoriteBooks: BookView[];
let libraryTotal: number;
let respondToOverview: () => Response;

const library = messages.books.library;

const QUICK_COUNTS: LibraryQuickCounts = {
  all: 6,
  borrowed: 0,
  favorites: 6,
  finished: 2,
  in_transit: 0,
  reading: 3,
  series: 4,
  solo: 2,
  want_to_buy: 0,
  want_to_read: 1,
};

const FAVORITES_SUMMARY: FavoritesSummaryView = {
  averageRating: null,
  finished: 21,
  reading: 22,
  series: 23,
  solo: 24,
  topGenres: [],
  topTags: [],
  total: 47,
  unrated: 0,
  wantToRead: 25,
};

const EMPTY_FAVORITES_SUMMARY: FavoritesSummaryView = {
  averageRating: null,
  finished: 0,
  reading: 0,
  series: 0,
  solo: 0,
  topGenres: [],
  topTags: [],
  total: 0,
  unrated: 0,
  wantToRead: 0,
};

function chip(name: string): HTMLElement {
  const match = screen
    .getAllByRole("radio")
    .find((radio) => radio.firstChild?.textContent === name);
  if (match === undefined) throw new Error(`No quick filter chip ${name}`);
  return match;
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

function mockApi(favoritesSummary: () => Response = () => jsonResponse(FAVORITES_SUMMARY)) {
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") return Promise.resolve(respondToBookUpdate());
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/books/bulk/delete") return Promise.resolve(respondToBulkDelete());
    if (init?.method === "DELETE" && url.pathname.startsWith("/api/reading-queue/")) {
      return Promise.resolve(
        jsonResponse({ count: 0, items: [], totalCount: 0, totalPagesCount: 0 }),
      );
    }
    if (url.pathname === "/api/books/quick-counts")
      return Promise.resolve(jsonResponse(QUICK_COUNTS));
    if (url.pathname === "/api/books/favorites-summary") {
      return Promise.resolve(favoritesSummary());
    }
    if (url.pathname === "/api/books/overview") return Promise.resolve(respondToOverview());
    if (url.pathname === "/api/books") {
      return Promise.resolve(
        jsonResponse({
          items: favoriteBooks,
          page: 1,
          pagesCount: 1,
          pageSize: 24,
          totalCount: favoriteBooks.length,
        }),
      );
    }
    return Promise.resolve(jsonResponse([]));
  });
}

function mutatingRequests(): string[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method !== undefined && init.method !== "GET")
    .map(
      ([input, init]) => `${init.method} ${new URL(String(input), "http://localhost").pathname}`,
    );
}

function quickCountRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/books/quick-counts");
}

function renderFavorites(searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams={searchParams}>
      <FavoritesView />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  respondToBookUpdate = () => jsonResponse(makeBookView({ isFavorite: false }));
  respondToBulkDelete = () => jsonResponse({ message: "unexpected bulk delete" }, 500);
  favoriteBooks = [makeBookView({ isFavorite: true })];
  libraryTotal = 3;
  respondToOverview = () => jsonResponse(libraryOverview(libraryTotal));
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FavoritesView quick filter counts", () => {
  it("counts the chips over the favorite books and keeps the summary cards on the summary", async () => {
    mockApi();
    renderFavorites();

    await waitFor(() => expect(within(chip("Усі")).getByText("6")).toBeInTheDocument());
    expect(within(chip("Читаю")).getByText("3")).toBeInTheDocument();
    expect(screen.getAllByText("47").length).toBeGreaterThan(0);
    expect(screen.getAllByText("22").length).toBeGreaterThan(0);

    const [request] = quickCountRequests();
    expect(request?.searchParams.get("scope")).toBe("favorites");
    expect(request?.searchParams.has("isFavorite")).toBe(false);
  });

  it("keeps the selected chip out of the quick-counts request", async () => {
    mockApi();
    renderFavorites();
    await waitFor(() => expect(within(chip("Усі")).getByText("6")).toBeInTheDocument());

    await userEvent.click(chip("Прочитано"));
    await waitFor(() => expect(chip("Прочитано")).toHaveAttribute("data-state", "on"));

    for (const url of quickCountRequests()) {
      expect(url.searchParams.has("status")).toBe(false);
      expect(url.searchParams.get("scope")).toBe("favorites");
    }
  });
});

describe("FavoritesView summary error", () => {
  it("shows the summary error card instead of zero counts when the favorites summary fails to load", async () => {
    mockApi(() => jsonResponse({ message: "boom" }, 500));
    renderFavorites();

    const { summaryError } = messages.common;
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(summaryError.title);
    expect(within(alert).getByRole("button", { name: summaryError.retry })).toBeInTheDocument();
    expect(screen.queryByText(messages.favorites.summary.total)).not.toBeInTheDocument();
  });
});

describe("FavoritesView inverted range", () => {
  it("asks to fix an inverted year range instead of showing the loading state", async () => {
    mockApi();
    renderFavorites("?yearMin=2020&yearMax=2000");

    const { invalidRange } = library;
    expect(await screen.findByRole("heading", { name: invalidRange.title })).toBeInTheDocument();
    expect(
      screen.getByText(invalidRange.description.replace("{ranges}", invalidRange.ranges.year)),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скинути діапазон" })).toBeInTheDocument();
    expect(screen.queryByText(library.loading)).not.toBeInTheDocument();
  });
});

describe("FavoritesView unfavorite undo", () => {
  it("shows only the error toast when unfavoriting fails", async () => {
    respondToBookUpdate = () => jsonResponse({ message: "boom" }, 500);
    mockApi();
    renderFavorites();

    await userEvent.click(await screen.findByRole("button", { name: library.actions.unfavorite }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(library.toast.error));
    expect(toast).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("offers the undo toast once unfavoriting succeeds", async () => {
    mockApi();
    renderFavorites();

    await userEvent.click(await screen.findByRole("button", { name: library.actions.unfavorite }));

    const { remove } = messages.favorites;
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        remove.toast,
        expect.objectContaining({ action: expect.objectContaining({ label: remove.undo }) }),
      ),
    );
  });
});

describe("FavoritesView bulk delete", () => {
  it("counts the books the server deleted, not the books selected, in the success toast", async () => {
    favoriteBooks = [
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Останнє бажання" },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Меч призначення" },
      { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", title: "Кров ельфів" },
    ].map((book) => makeBookView({ ...book, isFavorite: true }));
    respondToBulkDelete = () => jsonResponse({ affected: 2 });
    mockApi();
    renderFavorites();

    const { bulk } = library;
    await userEvent.click(await screen.findByRole("button", { name: bulk.enterSelection }));
    for (const book of favoriteBooks) {
      const name = bulk.selectBook.replace("{title}", book.title);
      await userEvent.click(await screen.findByRole("checkbox", { name }));
    }
    const bulkBar = screen.getByRole("region", { name: bulk.regionLabel });
    await userEvent.click(within(bulkBar).getByRole("button", { name: bulk.delete }));
    const confirmation = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(confirmation).getByRole("button", { name: messages.books.deleteConfirm.confirm }),
    );

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 книги видалено"));
    const deleteRequest = fetchMock.mock.calls.find(([input]) =>
      String(input).includes("/api/books/bulk/delete"),
    );
    expect(JSON.parse(String(deleteRequest?.[1]?.body))).toEqual({
      bookIds: favoriteBooks.map((book) => book.id),
    });
  });
});

describe("FavoritesView remove from queue", () => {
  it("takes a queued favorite out of the queue through the queue endpoint", async () => {
    const queuedBookId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    favoriteBooks = [
      makeBookView({
        id: queuedBookId,
        isFavorite: true,
        isInReadingQueue: true,
        readingStatus: "want_to_read",
      }),
    ];
    mockApi();
    renderFavorites();

    await userEvent.click(await screen.findByRole("button", { name: library.menu }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: library.actions.removeFromQueue }),
    );

    await waitFor(() =>
      expect(mutatingRequests()).toEqual([`DELETE /api/reading-queue/${queuedBookId}`]),
    );
  });
});

describe("FavoritesView empty base", () => {
  const { empty } = messages.favorites;

  function mockEmptyFavorites(total: number) {
    favoriteBooks = [];
    libraryTotal = total;
    mockApi(() => jsonResponse(EMPTY_FAVORITES_SUMMARY));
  }

  it("opens the create form from the empty favorites of an account without books", async () => {
    mockEmptyFavorites(0);
    renderFavorites();
    await screen.findByRole("heading", { name: empty.noBooks.title });

    await userEvent.click(screen.getByRole("button", { name: messages.books.firstBook.cta }));

    expect(routerPush).toHaveBeenCalledWith("/books/new");
  });

  it("hides the summary cards while there are no favorites", async () => {
    mockEmptyFavorites(0);
    renderFavorites();
    await screen.findByRole("heading", { name: empty.noBooks.title });

    expect(screen.queryByText(messages.favorites.summary.total)).not.toBeInTheDocument();
  });

  it("leads to all books when the library has books but none is a favorite", async () => {
    mockEmptyFavorites(4);
    renderFavorites();
    await screen.findByRole("heading", { name: empty.title });

    await userEvent.click(screen.getByRole("button", { name: empty.cta }));

    expect(routerPush).toHaveBeenCalledWith("/books");
  });

  it("explains how the heart adds a book to favorites when the library has books", async () => {
    mockEmptyFavorites(4);
    renderFavorites();
    await screen.findByRole("heading", { name: empty.title });

    expect(screen.getByText(empty.description)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: messages.books.firstBook.cta }),
    ).not.toBeInTheDocument();
  });

  it("shows the retryable error instead of the empty favorites when the library check fails", async () => {
    mockEmptyFavorites(4);
    respondToOverview = () => jsonResponse({ message: "boom" }, 500);
    renderFavorites();

    const alert = await screen.findByRole("alert");

    expect(within(alert).getByText(library.error.title)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: library.error.retry })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: empty.title })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: empty.noBooks.title })).not.toBeInTheDocument();
  });

  it("asks for the library again from the failed check and shows the empty favorites once it answers", async () => {
    let overviewRequests = 0;
    mockEmptyFavorites(4);
    respondToOverview = () => {
      overviewRequests += 1;
      return overviewRequests === 1
        ? jsonResponse({ message: "boom" }, 500)
        : jsonResponse(libraryOverview(libraryTotal));
    };
    renderFavorites();

    const alert = await screen.findByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: library.error.retry }));

    expect(await screen.findByRole("heading", { name: empty.title })).toBeInTheDocument();
    expect(overviewRequests).toBe(2);
  });
});
