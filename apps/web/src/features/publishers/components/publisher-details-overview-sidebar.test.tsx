import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherOverview } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makePublisherDetail } from "../model/publisher.fixtures";
import { PublisherDetailsView } from "./publisher-details-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    className,
    href,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchMock = vi.fn();

const author = { id: "author-1", name: "Френк Герберт" };

function booksOverview() {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: 0,
      series: 0,
      solo: 1,
      total: 1,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function booksPage() {
  const items = [makeBookView()];
  return { items, page: 1, pagesCount: 1, pageSize: 20, totalCount: items.length };
}

function emptyOverview(): LibraryPublisherOverview {
  return { activeReading: [], latestBook: null, series: [], wishlist: [] };
}

function fullOverview(): LibraryPublisherOverview {
  return {
    activeReading: [
      {
        authors: [author],
        cover: null,
        id: "book-reading",
        progress: { currentPage: 120, pagesCount: 400 },
        readingStatus: "rereading",
        title: "Дюна",
      },
    ],
    latestBook: {
      authors: [author],
      cover: null,
      createdAt: "2026-05-04T10:00:00.000Z",
      formats: ["paper"],
      id: "book-latest",
      ownershipStatus: "want_to_buy",
      readingStatus: "want_to_read",
      series: { id: "series-1", name: "Хроніки Дюни", partNumber: 2, totalBooks: 6 },
      title: "Месія Дюни",
    },
    series: [
      { booksCount: 4, id: "series-some", name: "Серія А", readCount: 3, status: "completed" },
      { booksCount: 4, id: "series-all", name: "Серія Б", readCount: 4, status: "ongoing" },
      { booksCount: 2, id: "series-none", name: "Серія В", readCount: 0, status: "unknown" },
    ],
    wishlist: [
      {
        authors: [author],
        bestOffer: { currency: "UAH", price: 450 },
        cover: null,
        id: "book-priced",
        title: "Діти Дюни",
      },
      {
        authors: [author],
        bestOffer: null,
        cover: null,
        id: "book-unpriced",
        title: "Бог-імператор Дюни",
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function overviewRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/library-overview"));
}

function renderView() {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <PublisherDetailsView details={makePublisherDetail({ id: "publisher-1" })} />
    </NuqsTestingAdapter>,
  );
}

function sidebar() {
  return within(screen.getByRole("complementary", { name: "Огляд видавництва" }));
}

function stubFetch(overview: () => Response) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/library-overview")) return Promise.resolve(overview());
    if (url.includes("/api/books/overview")) return Promise.resolve(jsonResponse(booksOverview()));
    if (url.includes("/api/books")) return Promise.resolve(jsonResponse(booksPage()));
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function stubNarrowViewport() {
  vi.stubGlobal("matchMedia", (media: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media,
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  stubFetch(() => jsonResponse(fullOverview()));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PublisherDetailsView overview sidebar", () => {
  it("loads the overview once beside the catalog, with no tab to opt into", async () => {
    renderView();

    await screen.findByText("Месія Дюни");
    expect(overviewRequests()).toEqual(["/api/publishers/publisher-1/library-overview"]);
  });

  it("renders the four compact cards in reading, series, wishlist, latest order", async () => {
    renderView();

    await screen.findByText("Месія Дюни");
    const headings = sidebar()
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Зараз читаю", "Серії", "У списку бажань", "Остання додана книга"]);
  });

  it("links each row to its book or series details", async () => {
    renderView();

    await screen.findByText("Месія Дюни");
    const hrefs = sidebar()
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/books/book-reading",
      "/series/series-some",
      "/series/series-all",
      "/series/series-none",
      "/books/book-priced",
      "/books/book-unpriced",
      "/books/book-latest",
    ]);
  });

  it("shows reading progress, series copy, prices and the latest book metadata", async () => {
    renderView();

    await screen.findByText("Месія Дюни");
    expect(sidebar().getByText("120 з 400 стор.")).toBeInTheDocument();
    expect(sidebar().getByText("4 книги · 3 прочитано")).toBeInTheDocument();
    expect(sidebar().getByText("4 книги · усі прочитані")).toBeInTheDocument();
    expect(sidebar().getByText("2 книги · ще не прочитано")).toBeInTheDocument();
    expect(sidebar().getByText("Завершена")).toBeInTheDocument();
    expect(sidebar().getByText("Ще виходить")).toBeInTheDocument();
    expect(sidebar().getByText("Невідомо")).toBeInTheDocument();
    expect(sidebar().getByText(/450/)).toBeInTheDocument();
    expect(sidebar().getByText("Без ціни")).toBeInTheDocument();
    expect(
      sidebar().getByText("У списку бажань", { selector: "span[data-slot=badge]" }),
    ).toBeInTheDocument();
    expect(sidebar().getByText(/^Додано/)).toBeInTheDocument();
  });

  it("hides a section without data", async () => {
    stubFetch(() =>
      jsonResponse({ ...fullOverview(), activeReading: [], series: [], wishlist: [] }),
    );
    renderView();

    await screen.findByText("Месія Дюни");
    const headings = sidebar()
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Остання додана книга"]);
  });

  it("leaves no empty column or mobile trigger when every section is empty", async () => {
    stubFetch(() => jsonResponse(emptyOverview()));
    renderView();

    await waitFor(() => expect(overviewRequests()).not.toHaveLength(0));
    await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Огляд видавництва" })).not.toBeInTheDocument();
  });

  it("marks the sidebar busy while the overview loads", () => {
    stubFetch(() => jsonResponse(fullOverview()));
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    renderView();

    expect(screen.getByRole("complementary", { name: "Огляд видавництва" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("keeps the catalog and refetches only the overview after an overview error", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return calls === 1 ? jsonResponse({ message: "boom" }, 500) : jsonResponse(fullOverview());
    });
    renderView();

    expect(await screen.findByText("Не вдалося завантажити огляд")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Назва книги, автор або серія")).toBeInTheDocument();
    const requestsBeforeRetry = fetchMock.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    await screen.findByText("Месія Дюни");
    expect(fetchMock.mock.calls.slice(requestsBeforeRetry).map(([input]) => String(input))).toEqual(
      ["/api/publishers/publisher-1/library-overview"],
    );
  });

  it("offers the same insights behind a phone trigger", async () => {
    stubNarrowViewport();
    renderView();

    await screen.findByText("Месія Дюни");
    await userEvent.click(screen.getByRole("button", { name: "Огляд видавництва" }));

    const panel = within(await screen.findByRole("dialog", { name: "Огляд видавництва" }));
    expect(panel.getByRole("heading", { level: 2, name: "Зараз читаю" })).toBeVisible();
    expect(panel.getByRole("heading", { level: 2, name: "Остання додана книга" })).toBeVisible();
    expect(panel.getAllByRole("link")[0]).toHaveAttribute("href", "/books/book-reading");
    expect(overviewRequests()).toHaveLength(1);
  });
});
