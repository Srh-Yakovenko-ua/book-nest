import "@testing-library/jest-dom/vitest";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { PublisherBooksTab } from "./publisher-books-tab";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-fixed",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const PUBLISHER_ID = "11111111-1111-4111-8111-111111111111";

const fetchMock = vi.fn();

function booksPage(items: BookView[]) {
  return { items, page: 1, pagesCount: 1, pageSize: 24, totalCount: items.length };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function mockApi({ books, total }: { books: BookView[]; total: number }) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/books/overview")
      return Promise.resolve(jsonResponse(overview(total)));
    if (url.pathname === "/api/books/quick-counts") {
      return Promise.resolve(jsonResponse(quickCounts(total)));
    }
    if (url.pathname === "/api/books/facets") {
      return Promise.resolve(jsonResponse({ authors: [], genres: [] }));
    }
    if (url.pathname === "/api/books") return Promise.resolve(jsonResponse(booksPage(books)));
    return Promise.resolve(jsonResponse([]));
  });
}

function overview(total: number) {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: 0,
      series: 0,
      solo: total,
      total,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function quickCounts(total: number) {
  return {
    all: total,
    borrowed: 0,
    favorites: 0,
    finished: 0,
    in_transit: 0,
    reading: 0,
    series: 0,
    solo: total,
    want_to_buy: 0,
    want_to_read: 0,
  };
}

function renderTab(searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={searchParams}>
      <PublisherBooksTab onAddBook={vi.fn()} publisherId={PUBLISHER_ID} />
    </NuqsTestingAdapter>,
  );
}

function requests(pathname: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === pathname);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PublisherBooksTab", () => {
  it("scopes the list to the fixed publisher and never forwards publisherPresence", async () => {
    mockApi({ books: [makeBookView()], total: 1 });
    renderTab("?publisher=other&publisherPresence=missing&q=дюна");

    await waitFor(() => expect(requests("/api/books")).not.toHaveLength(0));
    for (const url of requests("/api/books")) {
      expect(url.searchParams.getAll("publisher")).toEqual([PUBLISHER_ID]);
      expect(url.searchParams.get("searchPublisher")).toBe("false");
      expect(url.searchParams.has("publisherPresence")).toBe(false);
    }
  });

  it("scopes the quick-filter counts to the fixed publisher", async () => {
    mockApi({ books: [makeBookView()], total: 1 });
    renderTab("?publisher=other&q=дюна");

    await waitFor(() => expect(requests("/api/books/quick-counts")).not.toHaveLength(0));
    const [request] = requests("/api/books/quick-counts");
    expect(request?.searchParams.getAll("publisher")).toEqual([PUBLISHER_ID]);
    expect(request?.searchParams.get("searchPublisher")).toBe("false");
    expect(request?.searchParams.get("q")).toBe("дюна");
    expect(request?.searchParams.get("scope")).toBe("all");
  });

  it("keeps the library total on the overview scoped to the fixed publisher", async () => {
    mockApi({ books: [makeBookView()], total: 1 });
    renderTab();

    await waitFor(() => expect(requests("/api/books/overview")).not.toHaveLength(0));
    expect(requests("/api/books/overview")[0]?.searchParams.get("publisher")).toBe(PUBLISHER_ID);
  });

  it("renders the canonical archive without a heading level one or the publisher line", async () => {
    const book = makeBookView();
    mockApi({ books: [book], total: 1 });
    renderTab();

    expect(await screen.findByText(book.title)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText("Клуб Сімейного Дозвілля")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Назва книги, автор або серія")).toBeInTheDocument();
  });

  it("hides the publisher section and scopes the facets in Advanced Filters", async () => {
    mockApi({ books: [makeBookView()], total: 1 });
    renderTab();

    await userEvent.click(await screen.findByRole("button", { name: /Фільтри/ }));
    const sheet = await screen.findByRole("dialog");

    expect(within(sheet).queryByText("Видавництво")).not.toBeInTheDocument();
    expect(within(sheet).getByText("Статус читання")).toBeInTheDocument();
    await waitFor(() => expect(requests("/api/books/facets")).not.toHaveLength(0));
    expect(requests("/api/books/facets")[0]?.searchParams.get("publisher")).toBe(PUBLISHER_ID);
  });

  it("shows the publisher empty state when the publisher has no books", async () => {
    mockApi({ books: [], total: 0 });
    renderTab();

    expect(await screen.findByText("Ще немає книг цього видавництва")).toBeInTheDocument();
  });

  it("offers to clear filters when filters leave no books", async () => {
    mockApi({ books: [], total: 3 });
    renderTab("?status=finished");

    expect(await screen.findByText("Немає книг за вибраними фільтрами")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Очистити фільтри" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Очистити все" }).length).toBeGreaterThan(0);
  });
});
