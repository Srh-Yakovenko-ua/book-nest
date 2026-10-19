import type { ReadingStatisticsRecord, StatisticsBookRef } from "@app/shared";
import type { ReactNode } from "react";

import { RECORDS_LIMIT } from "@app/shared";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { RecordsSection } from "./records-section";

type BookRecordType = Extract<
  ReadingStatisticsRecord,
  { data: { book: StatisticsBookRef } }
>["type"];

const { records } = overviewFixture();

const recordsText = messages.statistics.records;

const openBookText = messages.statistics.contextActions.open_book;

const translateRecords = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.records",
});

const BOOK_RECORD_TYPES = [
  "fastest_completed_read",
  "longest_completed_book",
  "shortest_completed_book",
] as const satisfies readonly BookRecordType[];

const LONG_TITLE =
  "The Collected Chronicles of the Archipelago, Its Wandering Mages, Its Forgotten Dragons and Every Island Beyond the Farthest Reach";

const BOOK: StatisticsBookRef = {
  bookId: statisticsIds.bookId,
  bookState: "active",
  coverThumbUrl: null,
  title: "The Left Hand of Darkness",
};

const COMPLETED_READ = {
  drilldown: {
    bookId: statisticsIds.bookId,
    kind: "reading_cycle",
    readingCycleId: statisticsIds.cycleId,
  },
  finishedAt: "2026-02-14",
  readingCycleId: statisticsIds.cycleId,
} as const;

const PEAK_MONTH = {
  data: { completedReads: 5, month: "2026-02", pagesRead: 1240 },
  type: "peak_month",
} satisfies ReadingStatisticsRecord;

const LONGEST_STREAK = {
  data: { days: 12, endDate: "2026-02-12", startDate: "2026-02-01" },
  type: "longest_streak",
} satisfies ReadingStatisticsRecord;

const SERIES_MARATHON = {
  data: {
    endFinishedAt: "2026-03-10",
    length: 3,
    name: "Earthsea Cycle",
    seriesId: statisticsIds.seriesId,
  },
  type: "longest_series_marathon",
} satisfies ReadingStatisticsRecord;

const fetchMock = vi.fn((input: RequestInfo | URL) =>
  Promise.reject(new Error(`unexpected fetch ${String(input)}`)),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function bookRecord(
  type: BookRecordType,
  book: Partial<StatisticsBookRef> = {},
): ReadingStatisticsRecord {
  const completedRead = { ...COMPLETED_READ, book: { ...BOOK, ...book } };
  if (type === "fastest_completed_read") {
    return { data: { ...completedRead, elapsedDays: 3 }, type };
  }
  return { data: { ...completedRead, pagesCount: 812 }, type };
}

function renderRecords(items: ReadingStatisticsRecord[], { isLowerBound = false } = {}) {
  renderWithProviders(
    <RecordsSection isLowerBound={isLowerBound} records={{ ...records, items }} />,
  );
}

describe("RecordsSection", () => {
  it("describes the selection with the records limit", () => {
    renderRecords(records.items);

    expect(
      screen.getByText(translateRecords("description", { limit: RECORDS_LIMIT })),
    ).toBeInTheDocument();
  });

  it("lists the records in the order they arrive", () => {
    const items: ReadingStatisticsRecord[] = [
      PEAK_MONTH,
      ...records.items,
      LONGEST_STREAK,
      bookRecord("longest_completed_book"),
    ];

    renderRecords(items);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(items.length);
    for (const [index, record] of items.entries()) {
      expect(listItems.at(index)).toHaveTextContent(recordsText.types[record.type]);
    }
  });

  it("shows a long book title in full and lets it wrap", () => {
    renderRecords([bookRecord("longest_completed_book", { title: LONG_TITLE })]);

    const title = screen.getByText(LONG_TITLE);
    expect(title).toHaveClass("break-words");
    expect(title).not.toHaveClass("line-clamp-2");
  });

  it("says the period has no records when there are none", () => {
    renderRecords([]);

    expect(screen.getByText(recordsText.empty)).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("notes that an exact peak month is picked by completed reads without a pages caveat", () => {
    renderRecords([PEAK_MONTH]);

    expect(screen.getByText(recordsText.values.peakMonthByReads)).toBeInTheDocument();
    expect(screen.queryByText(recordsText.values.peakMonthPagesIncomplete)).not.toBeInTheDocument();
  });

  it("adds the pages caveat to the peak month when the history is a lower bound", () => {
    renderRecords([PEAK_MONTH], { isLowerBound: true });

    expect(screen.getByText(recordsText.values.peakMonthByReads)).toBeInTheDocument();
    expect(screen.getByText(recordsText.values.peakMonthPagesIncomplete)).toBeInTheDocument();
  });

  it("counts the completed reads and pages of the peak month", () => {
    renderRecords([PEAK_MONTH]);

    expect(
      screen.getByText(
        translateRecords("values.peakMonthDetail", {
          pages: PEAK_MONTH.data.pagesRead,
          reads: PEAK_MONTH.data.completedReads,
        }),
      ),
    ).toBeInTheDocument();
  });

  it("marks a lower-bound streak as at least its days among recorded days", () => {
    renderRecords([LONGEST_STREAK], { isLowerBound: true });

    expect(
      screen.getByText(
        translateRecords("values.streakDaysAtLeast", { count: LONGEST_STREAK.data.days }),
      ),
    ).toHaveTextContent("≥");
    expect(screen.getByText(recordsText.values.recordedOnly)).toBeInTheDocument();
    expect(
      screen.queryByText(
        translateRecords("values.streakDays", { count: LONGEST_STREAK.data.days }),
      ),
    ).not.toBeInTheDocument();
  });

  it("shows an exact streak without the at-least mark or the recorded-days note", () => {
    renderRecords([LONGEST_STREAK]);

    expect(
      screen.getByText(translateRecords("values.streakDays", { count: LONGEST_STREAK.data.days })),
    ).toBeInTheDocument();
    expect(screen.queryByText(recordsText.values.recordedOnly)).not.toBeInTheDocument();
  });

  it.each(BOOK_RECORD_TYPES)("links an active %s record to its book page", (type) => {
    renderRecords([bookRecord(type)]);

    expect(screen.getByRole("link", { name: openBookText })).toHaveAttribute(
      "href",
      `/books/${statisticsIds.bookId}`,
    );
  });

  it.each(BOOK_RECORD_TYPES)("shows a soft-deleted %s record without a book link", (type) => {
    renderRecords([bookRecord(type, { bookState: "soft_deleted" })]);

    expect(screen.getByText(BOOK.title)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("makes the most pages day one trigger button without a link and fetches nothing", () => {
    renderRecords(records.items);

    expect(screen.getByRole("button")).toHaveTextContent(recordsText.types.most_pages_in_day);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([PEAK_MONTH, LONGEST_STREAK, SERIES_MARATHON])(
    "renders the $type card with neither a link nor a button",
    (record) => {
      renderRecords([record]);

      expect(screen.getByText(recordsText.types[record.type])).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );
});
