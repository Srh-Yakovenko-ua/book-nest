import "@testing-library/jest-dom/vitest";
import type {
  FavoriteSeriesContinuationItem,
  FavoriteSeriesContinuationsView,
  ReadingQueueView,
} from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { FavoriteSeriesContinuationsBlock } from "./favorite-series-continuations-block";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const sc = messages.favorites.seriesContinuations;
const actions = sc.actions;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let handleContinuations: () => Promise<Response>;

function continuationsGetCount(): number {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      String(input).includes("/api/series/favorite-continuations") &&
      (init?.method ?? "GET").toUpperCase() === "GET",
  ).length;
}

function continuationsView(
  items: FavoriteSeriesContinuationItem[],
): FavoriteSeriesContinuationsView {
  return { items, nextCursor: null, total: items.length };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makeItem(
  overrides: {
    favoriteBooksCount?: number;
    lastFavoriteAddedAt?: null | string;
    nextBook?: Partial<FavoriteSeriesContinuationItem["nextBook"]>;
    progress?: Partial<FavoriteSeriesContinuationItem["progress"]>;
    rankReason?: FavoriteSeriesContinuationItem["rankReason"];
    series?: Partial<FavoriteSeriesContinuationItem["series"]>;
  } = {},
): FavoriteSeriesContinuationItem {
  return {
    favoriteBooksCount: overrides.favoriteBooksCount ?? 2,
    lastFavoriteAddedAt: overrides.lastFavoriteAddedAt ?? null,
    nextBook: makeNextBook(overrides.nextBook),
    progress: { closedBooks: 1, finishedBooks: 1, totalBooks: 5, ...overrides.progress },
    rankReason: overrides.rankReason ?? "reading",
    series: {
      id: "series-1",
      status: "ongoing",
      title: "Серія Тестова",
      totalBooks: 5,
      ...overrides.series,
    },
  };
}

function makeItems(count: number): FavoriteSeriesContinuationItem[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    return makeItem({
      nextBook: { id: `book-${position}`, title: `Продовження ${position}` },
      series: { id: `series-${position}` },
    });
  });
}

function makeNextBook(
  overrides: Partial<FavoriteSeriesContinuationItem["nextBook"]> = {},
): FavoriteSeriesContinuationItem["nextBook"] {
  return {
    authors: [{ id: "author-1", name: "Автор Тестовий" }],
    cover: null,
    favoriteAddedAt: null,
    id: "book-1",
    isFavorite: true,
    ownershipStatus: "owned",
    queue: null,
    readingProgress: null,
    readingStatus: "reading",
    seriesPosition: 2,
    title: "Наступна книга серії",
    ...overrides,
  };
}

function readingQueueView(): ReadingQueueView {
  return {
    count: 1,
    items: [{ book: makeBookView({ id: "queued-book" }), position: 1 }],
    totalCount: 1,
    totalPagesCount: 0,
  };
}

function wasPosted(substring: string): boolean {
  return fetchMock.mock.calls.some(
    ([input, init]) => String(input).includes(substring) && init?.method === "POST",
  );
}

function withContinuations(items: FavoriteSeriesContinuationItem[]) {
  handleContinuations = () => Promise.resolve(jsonResponse(continuationsView(items)));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  handleContinuations = () => Promise.resolve(jsonResponse(continuationsView([])));
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/series/favorite-continuations")) return handleContinuations();
    if (url.includes("/ownership/want-to-buy")) {
      return Promise.resolve(jsonResponse(makeBookView()));
    }
    if (url.includes("/api/reading-queue")) {
      return Promise.resolve(jsonResponse(readingQueueView()));
    }
    return Promise.resolve(jsonResponse({}));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FavoriteSeriesContinuationsBlock", () => {
  it("shows the loading skeleton while the continuations request is pending", () => {
    handleContinuations = () => new Promise<Response>(() => {});
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(document.querySelector("[aria-busy]")).not.toBeNull();
  });

  it("shows an error and retries loading the continuations", async () => {
    handleContinuations = () => Promise.resolve(jsonResponse(continuationsView([]), 500));
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText(sc.error)).toBeInTheDocument();
    const callsBeforeRetry = continuationsGetCount();

    withContinuations([makeItem({ nextBook: { title: "Відновлена книга" } })]);
    await userEvent.click(screen.getByRole("button", { name: sc.retry }));

    expect(await screen.findByText("Відновлена книга")).toBeInTheDocument();
    await waitFor(() => expect(continuationsGetCount()).toBeGreaterThan(callsBeforeRetry));
  });

  it("shows the empty state when there are no continuations", async () => {
    withContinuations([]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText(sc.empty)).toBeInTheDocument();
  });

  it("renders every continuation up to the sidebar limit", async () => {
    withContinuations([
      makeItem({ nextBook: { id: "b1", title: "Перша наступна" }, series: { id: "s1" } }),
      makeItem({ nextBook: { id: "b2", title: "Друга наступна" }, series: { id: "s2" } }),
      makeItem({ nextBook: { id: "b3", title: "Третя наступна" }, series: { id: "s3" } }),
    ]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText("Перша наступна")).toBeInTheDocument();
    expect(screen.getByText("Друга наступна")).toBeInTheDocument();
    expect(screen.getByText("Третя наступна")).toBeInTheDocument();
  });

  it("links to the book to continue reading", async () => {
    withContinuations([makeItem({ nextBook: { id: "book-42" }, rankReason: "reading" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const link = await screen.findByRole("link", { name: actions.continueReading });
    expect(link).toHaveAttribute("href", "/books/book-42");
  });

  it("links to the book to resume reading for paused items", async () => {
    withContinuations([makeItem({ nextBook: { id: "book-7" }, rankReason: "paused" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const link = await screen.findByRole("link", { name: actions.resumeReading });
    expect(link).toHaveAttribute("href", "/books/book-7");
  });

  it("offers an add-to-queue button when the next book is available and unqueued", async () => {
    withContinuations([makeItem({ nextBook: { queue: null }, rankReason: "available" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByRole("button", { name: actions.addToQueue })).toBeInTheDocument();
  });

  it("shows the queue position and a link to the queue when the next book is already queued", async () => {
    withContinuations([
      makeItem({
        nextBook: { queue: { position: 4, priority: "normal" } },
        rankReason: "available",
      }),
    ]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const link = await screen.findByRole("link", { name: actions.openQueue });
    expect(link).toHaveAttribute("href", "/reading-queue");
    expect(screen.queryByRole("button", { name: actions.addToQueue })).not.toBeInTheDocument();
  });

  it("links to the loan for lent items", async () => {
    withContinuations([makeItem({ rankReason: "lent" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const link = await screen.findByRole("link", { name: actions.openLoan });
    expect(link).toHaveAttribute("href", "/loans");
  });

  it("links to the delivery order without a purchase button for in_transit items", async () => {
    withContinuations([makeItem({ rankReason: "in_transit" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const link = await screen.findByRole("link", { name: actions.openOrder });
    expect(link).toHaveAttribute("href", "/delivery/in-transit");
    expect(screen.queryByRole("button", { name: actions.addToWishlist })).not.toBeInTheDocument();
  });

  it("links to the wishlist without a want-to-buy button for want_to_buy items", async () => {
    withContinuations([makeItem({ rankReason: "want_to_buy" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const link = await screen.findByRole("link", { name: actions.openWishlist });
    expect(link).toHaveAttribute("href", "/books-to-buy");
    expect(screen.queryByRole("button", { name: actions.addToWishlist })).not.toBeInTheDocument();
  });

  it("offers an add-to-wishlist button for not_owned items", async () => {
    withContinuations([makeItem({ rankReason: "not_owned" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByRole("button", { name: actions.addToWishlist })).toBeInTheDocument();
  });

  it("adds an available book to the queue and refetches the continuations", async () => {
    withContinuations([
      makeItem({ nextBook: { id: "book-99", queue: null }, rankReason: "available" }),
    ]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const button = await screen.findByRole("button", { name: actions.addToQueue });
    const callsBefore = continuationsGetCount();

    await userEvent.click(button);

    await waitFor(() => expect(wasPosted("/api/reading-queue")).toBe(true));
    await waitFor(() => expect(continuationsGetCount()).toBeGreaterThan(callsBefore));
  });

  it("marks a not_owned book as wanted and refetches the continuations", async () => {
    withContinuations([makeItem({ nextBook: { id: "book-77" }, rankReason: "not_owned" })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const button = await screen.findByRole("button", { name: actions.addToWishlist });
    const callsBefore = continuationsGetCount();

    await userEvent.click(button);

    await waitFor(() => expect(wasPosted("/books/book-77/ownership/want-to-buy")).toBe(true));
    await waitFor(() => expect(continuationsGetCount()).toBeGreaterThan(callsBefore));
  });

  it("links the title to the book and the series name to the series", async () => {
    withContinuations([
      makeItem({
        nextBook: { id: "book-55", queue: null, title: "Книга з посиланням" },
        rankReason: "available",
        series: { id: "series-55", title: "Серія з посиланням" },
      }),
    ]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const titleLink = await screen.findByRole("link", { name: "Книга з посиланням" });
    expect(titleLink).toHaveAttribute("href", "/books/book-55");

    const seriesLink = screen.getByRole("link", { name: /Відкрити серію/ });
    expect(seriesLink).toHaveAttribute("href", "/series/series-55");
  });

  it("renders the series position without the book prefix", async () => {
    withContinuations([makeItem({ nextBook: { seriesPosition: 2 }, series: { totalBooks: 3 } })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText(/2 із 3/)).toBeInTheDocument();
    expect(screen.queryByText(/книга 2 із 3/)).not.toBeInTheDocument();
  });

  it("renders whole-series progress with a progress bar", async () => {
    withContinuations([
      makeItem({ progress: { closedBooks: 1, finishedBooks: 1, totalBooks: 3 } }),
    ]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText("У серії прочитано 1 із 3 книг")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders the title initial when the next book has no cover", async () => {
    withContinuations([makeItem({ nextBook: { cover: null, title: "Дюна" } })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText("Д")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("clamps a very long next-book title", async () => {
    const longTitle = "Дуже довга назва книги серії про пригоди героя ".repeat(6).trim();
    withContinuations([makeItem({ nextBook: { title: longTitle } })]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    const title = await screen.findByText(longTitle);
    expect(title).toHaveClass("line-clamp-2");
  });

  it("hides the toggle button and the count chip when there are three or fewer items", async () => {
    withContinuations([
      makeItem({ nextBook: { id: "b1", title: "Перша наступна" }, series: { id: "s1" } }),
      makeItem({ nextBook: { id: "b2", title: "Друга наступна" }, series: { id: "s2" } }),
      makeItem({ nextBook: { id: "b3", title: "Третя наступна" }, series: { id: "s3" } }),
    ]);
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText("Перша наступна")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: sc.showAll })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/пропозиц/)).not.toBeInTheDocument();
  });

  it("collapses to three rows and exposes the toggle and count chip when there are more", async () => {
    withContinuations(makeItems(5));
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    expect(await screen.findByText("Продовження 1")).toBeInTheDocument();
    expect(screen.getByText("Продовження 2")).toBeInTheDocument();
    expect(screen.getByText("Продовження 3")).toBeInTheDocument();
    expect(screen.queryByText("Продовження 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Продовження 5")).not.toBeInTheDocument();

    const countChip = screen.getByLabelText(/5\s+пропозиц/);
    expect(countChip).toBeInTheDocument();
    expect(countChip).toHaveTextContent("5");

    const toggle = screen.getByRole("button", { name: sc.showAll });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    const list = document.querySelector("ul");
    expect(list).not.toBeNull();
    expect(toggle).toHaveAttribute("aria-controls", list?.id ?? "");
  });

  it("reveals all rows on expand without refetching and collapses back", async () => {
    withContinuations(makeItems(5));
    renderWithProviders(<FavoriteSeriesContinuationsBlock />);

    await screen.findByText("Продовження 1");
    const callsBeforeExpand = continuationsGetCount();

    await userEvent.click(screen.getByRole("button", { name: sc.showAll }));

    expect(await screen.findByText("Продовження 4")).toBeInTheDocument();
    expect(screen.getByText("Продовження 5")).toBeInTheDocument();

    const collapseToggle = screen.getByRole("button", { name: sc.collapse });
    expect(collapseToggle).toHaveAttribute("aria-expanded", "true");
    expect(continuationsGetCount()).toBe(callsBeforeExpand);

    await userEvent.click(collapseToggle);

    expect(screen.queryByText("Продовження 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Продовження 5")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: sc.showAll })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
