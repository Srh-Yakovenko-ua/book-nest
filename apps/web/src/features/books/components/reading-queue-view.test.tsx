import "@testing-library/jest-dom/vitest";

import type {
  OwnershipStatus,
  ReadingQueueItemView,
  ReadingQueueSummaryView,
  ReadingQueueVolumeSummaryView,
  SeriesOrderIssuesView,
} from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeSeriesView } from "../../series/model/series.fixtures";
import { makeQueueVolumeSummary } from "../model/queue-volume.fixtures";
import { makeBookView } from "./book-details.fixtures";
import { ReadingQueueView } from "./reading-queue-view";

function renderQueue(searchParams = "") {
  return renderWithProviders(
    <NuqsTestingAdapter searchParams={searchParams}>
      <ReadingQueueView />
    </NuqsTestingAdapter>,
  );
}

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.readingQueue;
const stats = messages.readingQueue.stats;
const filters = messages.books.library.filters;
const readingStatus = messages.books.readingStatus.options;
const volume = messages.readingQueue.volume;

const AVAILABLE_OWNERSHIP: OwnershipStatus[] = ["owned", "borrowed_from_someone"];

const genresFixture = [
  {
    groupKey: "fiction",
    groupName: "Художня література",
    id: "genre-fantasy",
    isDefault: true,
    key: "fantasy",
    name: "Фентезі",
  },
];

const emptyPage = { items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 };

function countOwnership(items: ReadingQueueItemView[], status: OwnershipStatus): number {
  return items.filter((item) => item.book.ownershipStatus === status).length;
}

function issuesView(seriesInQueueWithIssuesCount = 0): SeriesOrderIssuesView {
  return { items: [], queueVersion: "queue-v1", seriesInQueueWithIssuesCount, total: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mixedAvailabilityItems(): ReadingQueueItemView[] {
  return [
    queueItemWith(1, { id: "book-1", ownershipStatus: "owned", title: "Доступна" }),
    queueItemWith(2, { id: "book-2", ownershipStatus: "want_to_buy", title: "Ще не куплена" }),
    queueItemWith(3, {
      hasUnreadEarlierSeriesParts: true,
      id: "book-3",
      ownershipStatus: "owned",
      partNumber: 2,
      series: makeSeriesView(),
      title: "Друга частина",
    }),
  ];
}

function mockQueue(
  items: ReadingQueueItemView[],
  volume: ReadingQueueVolumeSummaryView = makeQueueVolumeSummary(),
) {
  mockQueueFetch(
    (url) => Promise.resolve(jsonResponse(serverQueueView(items, url))),
    items,
    volume,
  );
}

function mockQueueFetch(
  respond: (url: string) => Promise<Response>,
  items: ReadingQueueItemView[] = [],
  volume: ReadingQueueVolumeSummaryView = makeQueueVolumeSummary(),
) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/reading-queue/summary")) {
        return Promise.resolve(jsonResponse(summaryOf(items)));
      }
      if (url.includes("/api/reading-queue/volume-summary")) {
        return Promise.resolve(jsonResponse(volume));
      }
      if (url.includes("/api/reading-queue/series-order-issues")) {
        return Promise.resolve(jsonResponse(issuesView()));
      }
      if (url.includes("/api/reading-queue")) return respond(url);
      if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(genresFixture));
      if (url.includes("/recent")) return Promise.resolve(jsonResponse([]));
      if (
        url.includes("/api/tags") ||
        url.includes("/api/authors") ||
        url.includes("/api/publishers")
      ) {
        return Promise.resolve(jsonResponse(emptyPage));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    }),
  );
}

function queueItem(position: number, id: string, title: string): ReadingQueueItemView {
  return { book: makeBookView({ id, isInReadingQueue: true, title }), position };
}

function queueItemWith(
  position: number,
  overrides: Parameters<typeof makeBookView>[0],
): ReadingQueueItemView {
  return { book: makeBookView({ isInReadingQueue: true, ...overrides }), position };
}

function queueView(items: ReadingQueueItemView[]) {
  return {
    count: items.length,
    items,
    totalCount: items.length,
    totalPagesCount: items.reduce((sum, item) => sum + (item.book.pagesCount ?? 0), 0),
  };
}

function serverQueueView(items: ReadingQueueItemView[], url: string) {
  const params = new URL(url, "http://localhost").searchParams;
  const search = params.get("q")?.trim().toLowerCase() ?? "";
  const priorities = params.getAll("priority").flatMap((value) => value.split(","));
  const matching = items.filter((item) => {
    if (search !== "" && !item.book.title.toLowerCase().includes(search)) return false;
    if (priorities.length === 0) return true;
    return item.book.queuePriority !== null && priorities.includes(item.book.queuePriority);
  });
  return { ...queueView(matching), totalCount: items.length };
}

function statCard(label: string): HTMLElement {
  const found = screen.getByText(label).closest('[data-slot="stat-card"]');
  if (found === null) throw new Error(`Stat card not found: ${label}`);
  return found as HTMLElement;
}

function summaryOf(items: ReadingQueueItemView[]): ReadingQueueSummaryView {
  const available = items.filter((item) => AVAILABLE_OWNERSHIP.includes(item.book.ownershipStatus));
  const availableNow = available.filter((item) => item.book.hasUnreadEarlierSeriesParts !== true);
  const seriesBooks = items.filter((item) => item.book.series !== null);
  const seriesIds = new Set(
    items.flatMap((item) => (item.book.series === null ? [] : [item.book.series.id])),
  );

  return {
    availableNowCount: availableNow.length,
    blockedBySeriesOrderCount: available.length - availableNow.length,
    seriesBooksCount: seriesBooks.length,
    seriesInQueueCount: seriesIds.size,
    standaloneBooksCount: items.length - seriesBooks.length,
    totalCount: items.length,
    unavailableByOwnership: {
      inTransit: countOwnership(items, "in_transit"),
      lentToSomeone: countOwnership(items, "lent_to_someone"),
      none: countOwnership(items, "none"),
      wantToBuy: countOwnership(items, "want_to_buy"),
    },
    unavailableCount: items.length - available.length,
  };
}

function twoPriorityItems(): ReadingQueueItemView[] {
  return [
    queueItemWith(1, { id: "book-1", queuePriority: "high", title: "Пріоритетна" }),
    queueItemWith(2, { id: "book-2", queuePriority: "low", title: "Звичайна" }),
  ];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReadingQueueView", () => {
  it("shows a busy skeleton while the queue is loading", () => {
    mockQueueFetch(() => new Promise<Response>(() => {}));

    renderQueue();

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(screen.queryByText(copy.empty.title)).not.toBeInTheDocument();
  });

  it("shows an error state with a retry action when the queue fails to load", async () => {
    mockQueueFetch(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));

    renderQueue();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.error.title);
    expect(screen.getByRole("button", { name: copy.error.retry })).toBeInTheDocument();
  });

  it("shows the empty-queue state when the queue has no books", async () => {
    mockQueue([]);

    renderQueue();

    expect(await screen.findByText(copy.empty.title)).toBeInTheDocument();
    expect(screen.queryByText(copy.noSearchResults.title)).not.toBeInTheDocument();
  });

  it("lists the queued books with their positions", async () => {
    mockQueue([queueItem(1, "book-1", "Перша книга"), queueItem(2, "book-2", "Друга книга")]);

    renderQueue();

    expect(await screen.findByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("Друга книга")).toBeInTheDocument();
  });

  it("shows the no-results state instead of the list when a search matches nothing", async () => {
    mockQueue([queueItem(1, "book-1", "Перша книга"), queueItem(2, "book-2", "Друга книга")]);

    renderQueue("?q=zzzzzz");

    expect(await screen.findByText(copy.noSearchResults.title)).toBeInTheDocument();
    expect(screen.queryByText("#2")).not.toBeInTheDocument();
    expect(screen.queryByText(copy.empty.title)).not.toBeInTheDocument();
  });

  it("hands the search to the endpoint instead of narrowing in the browser", async () => {
    mockQueue([queueItem(1, "book-1", "Перша книга")]);

    renderQueue("?q=перша");
    await screen.findByText("#1");

    const requested = vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input))
      .filter((url) => url.includes("/api/reading-queue?"));
    expect(requested.some((url) => url.includes("q=%D0%BF%D0%B5%D1%80%D1%88%D0%B0"))).toBe(true);
  });

  it("surfaces the reading-now badge after starting a book that stays in the queue", async () => {
    const queuedBook = makeBookView({
      id: "book-1",
      isInReadingQueue: true,
      readingStatus: "not_started",
      title: "Перша книга",
    });
    const startedBook = makeBookView({
      id: "book-1",
      isInReadingQueue: true,
      readingStatus: "reading",
      title: "Перша книга",
    });

    let started = false;

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(genresFixture));
        if (url.includes("/start-reading") && method === "POST") {
          started = true;
          return Promise.resolve(jsonResponse(queueView([{ book: startedBook, position: 1 }])));
        }
        if (url.includes("/api/reading-queue/summary")) {
          return Promise.resolve(jsonResponse(summaryOf([{ book: queuedBook, position: 1 }])));
        }
        if (url.includes("/api/reading-queue/series-order-issues")) {
          return Promise.resolve(jsonResponse(issuesView()));
        }
        if (url.includes("/api/reading-queue")) {
          const book = started ? startedBook : queuedBook;
          return Promise.resolve(jsonResponse(queueView([{ book, position: 1 }])));
        }
        return Promise.reject(new Error(`unexpected ${method} ${url}`));
      }),
    );

    renderQueue();

    const article = await screen.findByRole("article");
    expect(within(article).queryByText(copy.item.readingNow)).not.toBeInTheDocument();

    await userEvent.click(within(article).getByRole("button", { name: copy.item.startReading }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: copy.start.removeLabel }));
    await userEvent.click(within(dialog).getByRole("button", { name: copy.start.confirm }));

    expect(await screen.findByText(copy.item.readingNow)).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getByText("Перша книга")).toBeInTheDocument();
  });

  it("narrows the queue to matching books when a priority filter is applied", async () => {
    mockQueue(twoPriorityItems());

    renderQueue("?priority=high");

    expect(await screen.findByText("Пріоритетна")).toBeInTheDocument();
    expect(screen.queryByText("Звичайна")).not.toBeInTheDocument();
  });

  it("restores the full queue once the priority filter leaves the url", async () => {
    mockQueue(twoPriorityItems());

    renderQueue();

    expect(await screen.findByText("Звичайна")).toBeInTheDocument();
    expect(screen.getByText("Пріоритетна")).toBeInTheDocument();
  });

  it("omits reading statuses that cannot appear in the queue", async () => {
    mockQueue(twoPriorityItems());

    renderQueue();
    await screen.findByText("Пріоритетна");

    await userEvent.click(screen.getByRole("button", { name: filters.trigger }));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("button", { name: readingStatus.not_started }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: readingStatus.reading }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: readingStatus.finished }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: readingStatus.rereading }),
    ).not.toBeInTheDocument();
  });

  it("keeps the drag handle live while the queue carries no filter", async () => {
    mockQueue(twoPriorityItems());

    renderQueue();
    await screen.findByText("Пріоритетна");

    expect(screen.getByText(copy.toolbar.dragHint)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: copy.item.reorderAria.replace("{title}", "Пріоритетна"),
      }),
    ).toBeEnabled();
  });

  it("disables the drag handle and shows an info hint while filtering", async () => {
    mockQueue(twoPriorityItems());

    renderQueue("?priority=high");
    await screen.findByText("Пріоритетна");

    expect(await screen.findByText(copy.toolbar.dragDisabledHint)).toBeInTheDocument();
    expect(screen.queryByText(copy.toolbar.dragHint)).not.toBeInTheDocument();

    const handle = screen.getByRole("button", {
      name: copy.item.reorderAria.replace("{title}", "Пріоритетна"),
    });
    expect(handle).toBeDisabled();
  });

  it("shows the aggregated queue metrics above the list", async () => {
    mockQueue(mixedAvailabilityItems());

    renderQueue();
    await screen.findByText("Доступна");
    expect(await screen.findByText(stats.availableNow.label)).toBeInTheDocument();

    expect(statCard(stats.total.label)).toHaveTextContent(/3\s*книги/);
    expect(statCard(stats.availableNow.label)).toHaveTextContent(/1\s*книга/);
    expect(statCard(stats.unavailable.label)).toHaveTextContent(/1\s*книга/);
  });

  it("leaves the queue unfiltered and draggable while the metrics are shown", async () => {
    mockQueue(mixedAvailabilityItems());

    renderQueue();
    expect(await screen.findByText(stats.unavailable.label)).toBeInTheDocument();

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByText(copy.toolbar.dragHint)).toBeInTheDocument();
    expect(screen.queryByText(copy.toolbar.dragDisabledHint)).not.toBeInTheDocument();
  });

  it("renders the volume block in the sidebar and in the main column with distinct heading ids", async () => {
    mockQueue(
      mixedAvailabilityItems(),
      makeQueueVolumeSummary({
        coverage: { calculatedBooks: 3, ratio: 1, totalBooks: 3 },
        estimate: {
          daysMax: null,
          daysMin: null,
          daysUntilForecast: 19,
          reasonUnavailable: "insufficient_history",
        },
        pages: { invalidBooks: 0, knownRemaining: 900, missingBooks: 0 },
        queueBooksCount: 3,
      }),
    );

    renderQueue();

    const headings = await screen.findAllByRole("heading", { name: volume.title });
    expect(headings).toHaveLength(2);

    const [sidebarId, mainId] = headings.map((heading) => heading.id);
    expect(sidebarId).not.toBe(mainId);
  });
});
