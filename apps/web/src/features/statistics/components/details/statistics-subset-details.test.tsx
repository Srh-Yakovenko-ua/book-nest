import type {
  ReadingStatisticsCompletedReadsSubsetPage,
  ReadingStatisticsSubsetFilter,
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
import { StatisticsDetailSurface } from "./statistics-detail-surface";
import { StatisticsSubsetDetails } from "./statistics-subset-details";

const text = messages.statistics.details;

const SUBSET_PATH = "/api/statistics/completed-reads/subset";

const THIRD_CYCLE_ID = "99999999-9999-4999-8999-999999999999";

const PUBLISHER_FILTER: ReadingStatisticsSubsetFilter = {
  field: "publisherId",
  value: statisticsIds.publisherId,
};

const FIRST_QUARTER = { from: "2026-01-01", to: "2026-03-31" };

const FIRST_PAGE: ReadingStatisticsCompletedReadsSubsetPage = {
  items: [
    completedReadFixture({ finishedAt: "2026-03-14", rating: 9 }),
    completedReadFixture({
      book: {
        bookId: statisticsIds.secondBookId,
        bookState: "soft_deleted",
        coverThumbUrl: null,
        title: "Гробниці Атуану",
      },
      finishedAt: "2026-03-02",
      rating: null,
      readingCycleId: statisticsIds.secondCycleId,
    }),
  ],
  nextCursor: "page-2",
  totalCount: 3,
};

const SECOND_PAGE: ReadingStatisticsCompletedReadsSubsetPage = {
  items: [
    completedReadFixture({
      book: {
        bookId: statisticsIds.bookId,
        bookState: "active",
        coverThumbUrl: null,
        title: "Найдальший берег",
      },
      finishedAt: "2026-01-20",
      rating: 8,
      readingCycleId: THIRD_CYCLE_ID,
    }),
  ],
  nextCursor: null,
  totalCount: 3,
};

let firstPageResponse: () => Promise<Response> = () => Promise.resolve(jsonResponse(FIRST_PAGE));

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname !== SUBSET_PATH) {
    return Promise.reject(new Error(`unexpected fetch ${url.pathname}`));
  }
  return url.searchParams.get("cursor") === "page-2"
    ? Promise.resolve(jsonResponse(SECOND_PAGE))
    : firstPageResponse();
});

beforeEach(() => {
  firstPageResponse = () => Promise.resolve(jsonResponse(FIRST_PAGE));
  vi.stubGlobal("innerWidth", 1280);
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

function readTrigger(title: string): HTMLElement {
  return screen.getByRole("button", { name: text.completedRead.open.replace("{title}", title) });
}

function renderSubset() {
  return renderWithProviders(
    <StatisticsSubsetDetails filter={PUBLISHER_FILTER} period={FIRST_QUARTER} />,
  );
}

function subsetRequests(): Record<string, string>[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === SUBSET_PATH)
    .map((url) => Object.fromEntries(url.searchParams));
}

describe("StatisticsSubsetDetails", () => {
  it("counts the whole subset rather than the reads on the first page", async () => {
    renderSubset();

    expect(await screen.findByText("3 завершення")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows each read's finish date and its rating only when it has one", async () => {
    renderSubset();
    await screen.findByText("3 завершення");

    const rated = readTrigger("Чарівник Земномор'я");
    expect(within(rated).getByText("14 бер.")).toBeInTheDocument();
    expect(within(rated).getByRole("img", { name: "9/10" })).toBeInTheDocument();
    const unrated = readTrigger("Гробниці Атуану");
    expect(within(unrated).getByText("2 бер.")).toBeInTheDocument();
    expect(within(unrated).queryByRole("img")).not.toBeInTheDocument();
  });

  it("notes the read whose book was moved to trash and only that one", async () => {
    renderSubset();
    await screen.findByText("3 завершення");

    const trashed = readTrigger("Гробниці Атуану");
    expect(within(trashed).getByText(text.day.deletedBook)).toBeInTheDocument();
    expect(screen.getAllByText(text.day.deletedBook)).toHaveLength(1);
  });

  it("loads the next page by its cursor and appends it below the first", async () => {
    const user = userEvent.setup();
    renderSubset();

    await user.click(await screen.findByRole("button", { name: text.bucket.loadMore }));

    expect(await screen.findByText("Найдальший берег")).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent("Найдальший берег");
    expect(screen.queryByRole("button", { name: text.bucket.loadMore })).not.toBeInTheDocument();
    expect(subsetRequests()).toEqual([
      {
        limit: "20",
        periodFrom: "2026-01-01",
        periodTo: "2026-03-31",
        publisherId: statisticsIds.publisherId,
      },
      {
        cursor: "page-2",
        limit: "20",
        periodFrom: "2026-01-01",
        periodTo: "2026-03-31",
        publisherId: statisticsIds.publisherId,
      },
    ]);
  });

  it("offers a retry when the subset fails to load", async () => {
    const user = userEvent.setup();
    firstPageResponse = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderSubset();

    expect(await screen.findByText(text.subset.error)).toBeInTheDocument();
    firstPageResponse = () => Promise.resolve(jsonResponse(FIRST_PAGE));
    await user.click(screen.getByRole("button", { name: text.bucket.retry }));

    expect(await screen.findByText("3 завершення")).toBeInTheDocument();
  });

  it("says the period has no such reads when the subset is empty", async () => {
    firstPageResponse = () =>
      Promise.resolve(jsonResponse({ items: [], nextCursor: null, totalCount: 0 }));
    renderSubset();

    expect(await screen.findByText(text.subset.empty)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.bucket.loadMore })).not.toBeInTheDocument();
  });

  it("announces that the reads are loading until the first page arrives", () => {
    firstPageResponse = () => new Promise<Response>(() => undefined);
    renderSubset();

    expect(screen.getByRole("status", { name: text.subset.loading })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("keeps keyboard focus on the first new read's trigger after loading more inside the mobile drawer", async () => {
    vi.stubGlobal("innerWidth", 375);
    const user = userEvent.setup();
    const drawerTitle = text.subset.title.replace("{name}", "Folio");
    const openSubset = text.subset.open.replace("{name}", "Folio");
    renderWithProviders(
      <StatisticsDetailSurface
        detail={() => <StatisticsSubsetDetails filter={PUBLISHER_FILTER} period={FIRST_QUARTER} />}
        label={openSubset}
        title={drawerTitle}
      >
        Folio
      </StatisticsDetailSurface>,
    );

    await user.click(screen.getByRole("button", { name: openSubset }));
    const drawer = await screen.findByRole("dialog", { name: drawerTitle });
    const loadMore = await within(drawer).findByRole("button", { name: text.bucket.loadMore });
    loadMore.focus();
    await user.keyboard("{Enter}");
    await within(drawer).findByText("Найдальший берег");
    await waitFor(() =>
      expect(readTrigger("Найдальший берег")).toHaveAttribute("data-slot", "drawer-trigger"),
    );

    expect(readTrigger("Найдальший берег")).toHaveFocus();
  });
});
