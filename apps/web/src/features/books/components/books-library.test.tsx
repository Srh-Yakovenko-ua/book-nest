import "@testing-library/jest-dom/vitest";

import type { LibraryQuickCounts } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { BooksLibrary } from "./books-library";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/books",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const QUICK_AXES = ["status", "owner", "bookType", "isFavorite"] as const;

const library = messages.books.library;
const INVERTED_YEAR_RANGE = "?yearMin=2020&yearMax=2000";

const fetchMock = vi.fn();

function booksPage() {
  return { items: [makeBookView()], page: 1, pagesCount: 1, pageSize: 24, totalCount: 1 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function quickCounts(overrides: Partial<LibraryQuickCounts> = {}): LibraryQuickCounts {
  return {
    all: 7,
    borrowed: 1,
    favorites: 2,
    finished: 3,
    in_transit: 0,
    reading: 4,
    series: 5,
    solo: 2,
    want_to_buy: 0,
    want_to_read: 0,
    ...overrides,
  };
}

const OVERVIEW = {
  recentlyAdded: [],
  summary: {
    borrowed: 11,
    favorites: 12,
    finished: 13,
    inTransit: 14,
    reading: 15,
    series: 16,
    solo: 24,
    total: 40,
    wantToBuy: 17,
    wantToRead: 18,
  },
  topGenres: [],
  topTags: [],
};

function chip(name: string): HTMLElement {
  const match = screen
    .getAllByRole("radio")
    .find((radio) => radio.firstChild?.textContent === name);
  if (match === undefined) throw new Error(`No quick filter chip ${name}`);
  return match;
}

function listRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/books");
}

function mockApi(countsFor: (url: URL) => LibraryQuickCounts = () => quickCounts()) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/books/overview") return Promise.resolve(jsonResponse(OVERVIEW));
    if (url.pathname === "/api/books/quick-counts") {
      return Promise.resolve(jsonResponse(countsFor(url)));
    }
    if (url.pathname === "/api/books") {
      return Promise.resolve(jsonResponse(booksPage()));
    }
    return Promise.resolve(jsonResponse([]));
  });
}

function quickCountRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/books/quick-counts");
}

function renderLibrary(scope: "all" | "my", searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <BooksLibrary scope={scope} />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BooksLibrary quick filter counts", () => {
  it("shows the chip counts from quick-counts and keeps the summary cards on the overview", async () => {
    mockApi();
    renderLibrary("all");

    await waitFor(() => expect(within(chip("Усі")).getByText("7")).toBeInTheDocument());
    expect(within(chip("Читаю")).getByText("4")).toBeInTheDocument();
    expect(within(chip("У списку бажань")).getByText("0")).toBeInTheDocument();
    expect(chip("У списку бажань")).toBeEnabled();
    expect(screen.getAllByText("40").length).toBeGreaterThan(0);
    expect(screen.getAllByText("15").length).toBeGreaterThan(0);
    expect(quickCountRequests()[0]?.searchParams.get("scope")).toBe("all");
  });

  it("renders chips without numbers until the first counts arrive", async () => {
    mockApi();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/books/quick-counts") return new Promise<Response>(() => {});
      if (url.pathname === "/api/books/overview") return Promise.resolve(jsonResponse(OVERVIEW));
      if (url.pathname === "/api/books") return Promise.resolve(jsonResponse(booksPage()));
      return Promise.resolve(jsonResponse([]));
    });
    renderLibrary("all");

    await waitFor(() => expect(quickCountRequests()).not.toHaveLength(0));
    await screen.findByText(makeBookView().title);
    expect(chip("Усі")).toHaveTextContent(/^Усі$/);
    expect(chip("Читаю")).toHaveTextContent(/^Читаю$/);
  });

  it("sends the search to quick-counts and shows the counts it returns", async () => {
    mockApi((url) =>
      url.searchParams.get("q") === "дюна" ? quickCounts({ all: 2, reading: 1 }) : quickCounts(),
    );
    renderLibrary("all");
    await waitFor(() => expect(within(chip("Усі")).getByText("7")).toBeInTheDocument());

    await userEvent.type(screen.getByRole("textbox", { name: "Пошук книг" }), "дюна");

    await waitFor(() => expect(within(chip("Усі")).getByText("2")).toBeInTheDocument());
    expect(within(chip("Читаю")).getByText("1")).toBeInTheDocument();
    expect(quickCountRequests().at(-1)?.searchParams.get("q")).toBe("дюна");
  });

  it("never sends the selected quick filter to quick-counts", async () => {
    mockApi();
    renderLibrary("all", "?genre=fantasy");
    await waitFor(() => expect(within(chip("Усі")).getByText("7")).toBeInTheDocument());

    for (const name of ["Читаю", "Улюблені", "Позичені", "Частина серії"]) {
      await userEvent.click(chip(name));
      await waitFor(() => expect(chip(name)).toHaveAttribute("data-state", "on"));
    }

    const requests = quickCountRequests();
    expect(requests.length).toBeGreaterThan(0);
    for (const url of requests) {
      for (const axis of QUICK_AXES) expect(url.searchParams.has(axis)).toBe(false);
      expect(url.searchParams.getAll("genre")).toEqual(["fantasy"]);
    }
  });

  it("asks my-library counts for the physical library scope", async () => {
    mockApi();
    renderLibrary("my");

    await waitFor(() => expect(quickCountRequests()).not.toHaveLength(0));
    const [request] = quickCountRequests();
    expect(request?.searchParams.get("scope")).toBe("my");
    expect(request?.searchParams.has("owner")).toBe(false);
  });
});

describe("BooksLibrary summary error", () => {
  it("shows the summary error card instead of zero counts when the overview fails to load", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/books/overview") {
        return Promise.resolve(jsonResponse({ message: "boom" }, 500));
      }
      if (url.pathname === "/api/books/quick-counts") {
        return Promise.resolve(jsonResponse(quickCounts()));
      }
      if (url.pathname === "/api/books") return Promise.resolve(jsonResponse(booksPage()));
      return Promise.resolve(jsonResponse([]));
    });
    renderLibrary("all");

    const { summary, summaryError } = library;
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(summaryError.title);
    expect(within(alert).getByRole("button", { name: summaryError.retry })).toBeInTheDocument();
    expect(screen.queryByText(summary.total)).not.toBeInTheDocument();
  });
});

describe("BooksLibrary inverted range", () => {
  it("asks to fix an inverted year range instead of loading the list", async () => {
    mockApi();
    renderLibrary("all", INVERTED_YEAR_RANGE);

    const { invalidRange } = library;
    expect(await screen.findByRole("heading", { name: invalidRange.title })).toBeInTheDocument();
    expect(
      screen.getByText(invalidRange.description.replace("{ranges}", invalidRange.ranges.year)),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скинути діапазон" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("40").length).toBeGreaterThan(0));
    expect(screen.queryByText(library.loading)).not.toBeInTheDocument();
    expect(listRequests()).toHaveLength(0);
  });

  it("drops the inverted year range from the url and loads the list after the reset", async () => {
    mockApi();
    const urlUpdates: URLSearchParams[] = [];
    renderLibrary("all", INVERTED_YEAR_RANGE, (event) => {
      urlUpdates.push(event.searchParams);
    });

    await userEvent.click(await screen.findByRole("button", { name: "Скинути діапазон" }));

    expect(await screen.findByText(makeBookView().title)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: library.resultsTitle })).toHaveFocus();
    expect(urlUpdates.at(-1)?.has("yearMin")).toBe(false);
    expect(urlUpdates.at(-1)?.has("yearMax")).toBe(false);
    const [request] = listRequests();
    expect(request?.searchParams.has("yearMin")).toBe(false);
    expect(request?.searchParams.has("yearMax")).toBe(false);
  });
});
