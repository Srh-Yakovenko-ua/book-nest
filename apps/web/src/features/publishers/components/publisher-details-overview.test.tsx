import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherOverview } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function desktopLayout() {
  return screen.getByTestId("publisher-overview-columns");
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

function overviewBlocks() {
  return within(stackedLayout());
}

function overviewRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/library-overview"));
}

function renderView(searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory searchParams={searchParams}>
      <PublisherDetailsView details={makePublisherDetail({ id: "publisher-1" })} />
    </NuqsTestingAdapter>,
  );
}

function stackedLayout() {
  return screen.getByTestId("publisher-overview-stacked");
}

function stubFetch(overview: () => Response) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/library-overview")) return Promise.resolve(overview());
    if (url.includes("/api/books")) {
      return Promise.resolve(
        jsonResponse({ items: [], page: 1, pagesCount: 1, pageSize: 20, totalCount: 0 }),
      );
    }
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
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

describe("PublisherDetailsView overview", () => {
  it("sends no overview request on a direct books tab load", async () => {
    renderView("?tab=books");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(overviewRequests()).toEqual([]);
  });

  it("renders the four blocks as h2 sections in the mobile DOM order", async () => {
    renderView();

    await screen.findAllByText("Месія Дюни");
    const headings = overviewBlocks()
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Остання додана книга", "Зараз читаю", "У списку бажань", "Серії"]);
    expect(overviewRequests()).toEqual(["/api/publishers/publisher-1/library-overview"]);
  });

  it("splits desktop columns into latest then series and reading then wishlist", async () => {
    renderView();

    await screen.findAllByText("Месія Дюни");
    const [left, right] = Array.from(desktopLayout().children, (column) =>
      within(column as HTMLElement).getAllByRole("heading", { level: 2 }),
    );
    expect(left?.map((heading) => heading.textContent)).toEqual(["Остання додана книга", "Серії"]);
    expect(right?.map((heading) => heading.textContent)).toEqual([
      "Зараз читаю",
      "У списку бажань",
    ]);
  });

  it("keeps exactly one layout in the accessibility tree per breakpoint", async () => {
    renderView();

    await screen.findAllByText("Месія Дюни");
    expect(stackedLayout()).toHaveClass("lg:hidden");
    expect(desktopLayout()).toHaveClass("hidden", "lg:grid");
  });

  it("links each row to its book or series details", async () => {
    renderView();

    await screen.findAllByText("Месія Дюни");
    const hrefs = overviewBlocks()
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/books/book-latest",
      "/books/book-reading",
      "/books/book-priced",
      "/books/book-unpriced",
      "/series/series-some",
      "/series/series-all",
      "/series/series-none",
    ]);
  });

  it("shows latest metadata, reading progress, prices and scoped series copy", async () => {
    renderView();

    await screen.findAllByText("Месія Дюни");
    expect(overviewBlocks().getByText("Хроніки Дюни · книга 2 з 6")).toBeInTheDocument();
    expect(overviewBlocks().getByText("Хочу прочитати")).toBeInTheDocument();
    expect(overviewBlocks().getByText("У списку бажань", { selector: "span" })).toBeInTheDocument();
    expect(overviewBlocks().getByText("Перечитую")).toBeInTheDocument();
    expect(overviewBlocks().getByText("120 з 400 стор.")).toBeInTheDocument();
    expect(overviewBlocks().getByText(/450/)).toBeInTheDocument();
    expect(overviewBlocks().getByText("Без ціни")).toBeInTheDocument();
    expect(overviewBlocks().getByText("4 книги · 3 прочитано")).toBeInTheDocument();
    expect(overviewBlocks().getByText("4 книги · усі прочитані")).toBeInTheDocument();
    expect(overviewBlocks().getByText("2 книги · ще не прочитано")).toBeInTheDocument();
    expect(overviewBlocks().getByText("Завершена")).toBeInTheDocument();
    expect(overviewBlocks().getByText("Ще виходить")).toBeInTheDocument();
    expect(overviewBlocks().getByText("Невідомо")).toBeInTheDocument();
    expect(screen.queryByText(/Серію прочитано/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Усі книги/ })).not.toBeInTheDocument();
  });

  it("hides empty blocks", async () => {
    stubFetch(() =>
      jsonResponse({ ...fullOverview(), activeReading: [], series: [], wishlist: [] }),
    );
    renderView();

    await screen.findAllByText("Месія Дюни");
    const headings = overviewBlocks()
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Остання додана книга"]);
  });

  it("shows a local error and refetches only the overview on retry", async () => {
    let calls = 0;
    stubFetch(() => {
      calls += 1;
      return calls === 1 ? jsonResponse({ message: "boom" }, 500) : jsonResponse(fullOverview());
    });
    renderView();

    expect(await screen.findByText("Не вдалося завантажити огляд")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    const requestsBeforeRetry = fetchMock.mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    await screen.findAllByText("Месія Дюни");
    expect(fetchMock.mock.calls.slice(requestsBeforeRetry).map(([input]) => String(input))).toEqual(
      ["/api/publishers/publisher-1/library-overview"],
    );
  });

  it("marks the overview region busy while loading", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    renderView();

    expect(screen.getByRole("region", { name: "Огляд видавництва" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows cached overview immediately when returning from books", async () => {
    renderView();
    await screen.findAllByText("Месія Дюни");

    await userEvent.click(screen.getByRole("tab", { name: "Книги" }));
    await waitFor(() => expect(screen.queryByText("Месія Дюни")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "Огляд" }));

    expect(screen.getAllByText("Месія Дюни").length).toBeGreaterThan(0);
  });
});
