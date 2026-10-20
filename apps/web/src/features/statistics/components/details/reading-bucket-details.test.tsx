import type {
  Nullable,
  ReadingStatisticsActivityPage,
  ReadingStatisticsBucket,
  ReadingStatisticsCompletedReadsPage,
} from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { completedReadFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingBucketDetails } from "./reading-bucket-details";

const text = messages.statistics.details;

const MARCH: ReadingStatisticsBucket = {
  completedReads: 2,
  drilldown: {
    filters: { finishedFrom: "2026-03-01", finishedTo: "2026-03-31" },
    kind: "completed_reads_subset",
    period: { from: "2026-01-01", to: "2026-03-31" },
  },
  end: "2026-03-31",
  pagesRead: 90,
  start: "2026-03-01",
  uniqueBooksCompleted: 1,
};

const MARCH_LAST_YEAR: ReadingStatisticsBucket = {
  ...MARCH,
  drilldown: {
    filters: { finishedFrom: "2025-03-01", finishedTo: "2025-03-31" },
    kind: "completed_reads_subset",
    period: { from: "2025-01-01", to: "2025-03-31" },
  },
  end: "2025-03-31",
  start: "2025-03-01",
};

const READS_PAGES: ReadingStatisticsCompletedReadsPage[] = [
  {
    items: [completedReadFixture({ finishedAt: "2026-03-20", rating: 9 })],
    nextCursor: "page-2",
    range: { from: MARCH.start, to: MARCH.end },
    totalCount: 2,
  },
  {
    items: [
      completedReadFixture({
        book: {
          bookId: statisticsIds.bookId,
          bookState: "soft_deleted",
          coverThumbUrl: null,
          title: "Чарівник Земномор'я",
        },
        drilldown: {
          bookId: statisticsIds.bookId,
          kind: "reading_cycle",
          readingCycleId: statisticsIds.secondCycleId,
        },
        finishedAt: "2026-03-02",
        rating: null,
        readingCycleId: statisticsIds.secondCycleId,
      }),
    ],
    nextCursor: null,
    range: { from: MARCH.start, to: MARCH.end },
    totalCount: 2,
  },
];

const ACTIVITY_SECOND_PAGE_ITEMS: ReadingStatisticsActivityPage["items"] = [
  {
    book: {
      bookId: statisticsIds.secondBookId,
      bookState: "active",
      coverThumbUrl: null,
      title: "Гробниці Атуану",
    },
    date: "2026-03-01",
    pagesRead: 25,
  },
  {
    book: {
      bookId: statisticsIds.bookId,
      bookState: "active",
      coverThumbUrl: null,
      title: "Чарівник Земномор'я",
    },
    date: "2026-03-01",
    pagesRead: 15,
  },
];

function activityPage(
  overrides: Partial<ReadingStatisticsActivityPage> = {},
): ReadingStatisticsActivityPage {
  return {
    activeDays: 2,
    booksCount: 1,
    historyQuality: "exact",
    items: [
      {
        book: {
          bookId: statisticsIds.bookId,
          bookState: "active",
          coverThumbUrl: null,
          title: "Чарівник Земномор'я",
        },
        date: "2026-03-15",
        pagesRead: 60,
      },
      {
        book: {
          bookId: statisticsIds.bookId,
          bookState: "active",
          coverThumbUrl: null,
          title: "Чарівник Земномор'я",
        },
        date: "2026-03-02",
        pagesRead: 30,
      },
    ],
    nextCursor: null,
    pagesRead: 90,
    range: { from: MARCH.start, to: MARCH.end },
    reliableFrom: "2026-01-01",
    ...overrides,
  };
}

let activityResponse: (url: URL) => Response = () => jsonResponse(activityPage());

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/statistics/completed-reads") {
    const page = url.searchParams.get("cursor") === "page-2" ? READS_PAGES[1] : READS_PAGES[0];
    return Promise.resolve(jsonResponse(page));
  }
  if (url.pathname === "/api/statistics/reading-activity") {
    return Promise.resolve(activityResponse(url));
  }
  if (url.pathname === "/api/genres") return Promise.resolve(jsonResponse([]));
  return Promise.reject(new Error(`unexpected fetch ${url.pathname}`));
});

beforeEach(() => {
  activityResponse = () => jsonResponse(activityPage());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function pagedActivity(cursorAfterSecondPage: Nullable<string>): (url: URL) => Response {
  return (url) =>
    jsonResponse(
      url.searchParams.get("cursor") === "activity-2"
        ? activityPage({ items: ACTIVITY_SECOND_PAGE_ITEMS, nextCursor: cursorAfterSecondPage })
        : activityPage({ nextCursor: "activity-2" }),
    );
}

function readingEntry(title: string): HTMLElement {
  const entry = screen
    .getAllByRole("listitem")
    .find(
      (item) =>
        within(item).queryAllByRole("listitem").length === 0 &&
        within(item).queryByText(title) !== null,
    );
  if (entry === undefined) throw new Error(`no reading entry for ${title}`);
  return entry;
}

function requestedRanges(pathname: string): string[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === pathname)
    .map((url) => `${url.searchParams.get("from") ?? ""}..${url.searchParams.get("to") ?? ""}`);
}

describe("ReadingBucketDetails", () => {
  it("lists the exact cycles of the bucket, rereads and trashed books included, page by page", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={null}
        metric="reads"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("2 завершені читання")).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveFocus();
    expect(screen.queryByText(text.day.deletedBook)).toBeNull();

    await user.click(screen.getByRole("button", { name: text.bucket.loadMore }));

    expect(await screen.findByText(text.day.deletedBook)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Деталі читання/ })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: text.bucket.loadMore })).toBeNull();
    expect(requestedRanges("/api/statistics/completed-reads")).toEqual([
      "2026-03-01..2026-03-31",
      "2026-03-01..2026-03-31",
    ]);
  });

  it("opens the comparison bucket's own interval, not the current one", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={MARCH_LAST_YEAR}
        metric="pages"
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("60 сторінок");

    await user.click(screen.getByRole("radio", { name: messages.statistics.dynamics.comparison }));

    await waitFor(() =>
      expect(requestedRanges("/api/statistics/reading-activity")).toEqual([
        "2026-03-01..2026-03-31",
        "2025-03-01..2025-03-31",
      ]),
    );
  });

  it("shows the recorded pages per day for a bucket with no finished book", async () => {
    renderWithProviders(
      <ReadingBucketDetails
        bucket={{ ...MARCH, completedReads: 0 }}
        comparisonBucket={null}
        metric="pages"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("60 сторінок")).toBeInTheDocument();
    expect(screen.getByText("30 сторінок")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();
    expect(screen.queryByText(/повний облік/)).toBeNull();
  });

  it("moves keyboard focus to the first reading of the day page that just arrived", async () => {
    activityResponse = pagedActivity("activity-3");
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={null}
        metric="pages"
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("60 сторінок");

    screen.getByRole("button", { name: text.bucket.loadMore }).focus();
    await user.keyboard("{Enter}");

    await screen.findByText("Гробниці Атуану");
    await waitFor(() => expect(readingEntry("Гробниці Атуану")).toHaveFocus());
  });

  it("keeps keyboard focus off the page body when the last day page removes the load-more button", async () => {
    activityResponse = pagedActivity(null);
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={null}
        metric="pages"
        onClose={vi.fn()}
      />,
    );
    await screen.findByText("60 сторінок");

    screen.getByRole("button", { name: text.bucket.loadMore }).focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Гробниці Атуану");

    expect(screen.queryByRole("button", { name: text.bucket.loadMore })).toBeNull();
    expect(document.body).not.toHaveFocus();
  });

  it("marks observed-only history as a minimum and never claims nothing was read", async () => {
    activityResponse = () =>
      jsonResponse(
        activityPage({
          activeDays: 0,
          booksCount: 0,
          historyQuality: "legacy_observed_only",
          items: [],
          pagesRead: 0,
          reliableFrom: "2026-03-10",
        }),
      );
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={null}
        metric="pages"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText(text.bucket.pagesEmptyObservedOnly)).toBeInTheDocument();
    expect(screen.getAllByText("≥ 0")).toHaveLength(3);
    expect(screen.getByText(/10 березня 2026/)).toBeInTheDocument();
  });

  it("offers a retry when the details fail to load", async () => {
    const user = userEvent.setup();
    activityResponse = () => jsonResponse({ message: "boom" }, 500);
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={null}
        metric="pages"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText(text.bucket.error)).toBeInTheDocument();
    activityResponse = () => jsonResponse(activityPage());
    await user.click(screen.getByRole("button", { name: text.bucket.retry }));

    expect(await screen.findByText("60 сторінок")).toBeInTheDocument();
  });

  it("fails closed for a subset that is not a plain date range", async () => {
    renderWithProviders(
      <ReadingBucketDetails
        bucket={{
          ...MARCH,
          drilldown: {
            filters: { genre: "fantasy" },
            kind: "completed_reads_subset",
            period: { from: "2026-01-01", to: "2026-03-31" },
          },
        }}
        comparisonBucket={null}
        metric="reads"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText(text.bucket.unsupported)).toBeInTheDocument();
    expect(requestedRanges("/api/statistics/completed-reads")).toHaveLength(0);
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <ReadingBucketDetails
        bucket={MARCH}
        comparisonBucket={null}
        metric="pages"
        onClose={onClose}
      />,
    );
    await screen.findByText("60 сторінок");

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
