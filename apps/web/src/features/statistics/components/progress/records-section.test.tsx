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
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { RecordsSection } from "./records-section";

type BookRecordType = Extract<
  ReadingStatisticsRecord,
  { data: { book: StatisticsBookRef } }
>["type"];

const { records } = overviewFixture();

const recordsText = messages.statistics.records;

const openBookText = messages.statistics.contextActions.open_book;

const translateHint = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.progressHint",
});

async function openRecordHint(type: ReadingStatisticsRecord["type"]) {
  await userEvent.click(
    screen.getByRole("button", {
      name: translateHint("label", { topic: recordsText.types[type] }),
    }),
  );
}

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

const MOST_PAGES_DAY = {
  data: {
    date: "2026-03-02",
    drilldown: { date: "2026-03-02", kind: "reading_day" },
    pagesRead: 124,
  },
  type: "most_pages_in_day",
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

  it.each<{ record: ReadingStatisticsRecord; value: string }>([
    { record: bookRecord("longest_completed_book"), value: "812 сторінок" },
    { record: bookRecord("shortest_completed_book"), value: "812 сторінок" },
    { record: bookRecord("fastest_completed_read"), value: "за 3 дні" },
    { record: MOST_PAGES_DAY, value: "124 сторінки" },
    { record: SERIES_MARATHON, value: "3 книги поспіль" },
    { record: LONGEST_STREAK, value: "12 днів поспіль" },
    { record: PEAK_MONTH, value: "лютий 2026 р." },
  ])("shows the $record.type record with its label and $value", ({ record, value }) => {
    renderRecords([record]);

    const tile = screen.getByRole("listitem");
    expect(tile).toHaveTextContent(recordsText.types[record.type]);
    expect(within(tile).getByText(value)).toBeInTheDocument();
  });

  it.each([1, 2, 4])("renders one tile per record and no placeholders for %i records", (count) => {
    renderRecords([PEAK_MONTH, LONGEST_STREAK, SERIES_MARATHON, MOST_PAGES_DAY].slice(0, count));

    expect(screen.getAllByRole("listitem")).toHaveLength(count);
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

  it("notes in a hint that an exact peak month is picked by completed reads without a pages caveat", async () => {
    renderRecords([PEAK_MONTH]);

    await openRecordHint("peak_month");

    expect(await screen.findByText(recordsText.values.peakMonthByReads)).toBeInTheDocument();
    expect(screen.queryByText(recordsText.values.peakMonthPagesIncomplete)).not.toBeInTheDocument();
  });

  it("adds the pages caveat to the peak month hint when the history is a lower bound", async () => {
    renderRecords([PEAK_MONTH], { isLowerBound: true });

    await openRecordHint("peak_month");

    expect(await screen.findByText(recordsText.values.peakMonthByReads)).toBeInTheDocument();
    expect(screen.getByText(recordsText.values.peakMonthPagesIncomplete)).toBeInTheDocument();
  });

  it("counts the completed reads and pages of the peak month", () => {
    renderRecords([PEAK_MONTH]);

    expect(
      screen.getByText(
        translateRecords("values.peakMonthDetail", {
          pages: PEAK_MONTH.data.pagesRead,
          reads: PEAK_MONTH.data.completedReads,
        }).replace(/\s+/g, " "),
      ),
    ).toBeInTheDocument();
  });

  it("marks a lower-bound streak as at least its days among recorded days", async () => {
    renderRecords([LONGEST_STREAK], { isLowerBound: true });

    expect(
      screen.getByText(
        translateRecords("values.streakDaysAtLeast", { count: LONGEST_STREAK.data.days }),
      ),
    ).toHaveTextContent("≥");
    expect(
      screen.queryByText(
        translateRecords("values.streakDays", { count: LONGEST_STREAK.data.days }),
      ),
    ).not.toBeInTheDocument();

    await openRecordHint("longest_streak");

    expect(await screen.findByText(recordsText.values.recordedOnly)).toBeInTheDocument();
  });

  it("shows an exact streak without the at-least mark or the recorded-days note", () => {
    renderRecords([LONGEST_STREAK]);

    expect(
      screen.getByText(translateRecords("values.streakDays", { count: LONGEST_STREAK.data.days })),
    ).toBeInTheDocument();
    expect(screen.queryByText(/≥/)).not.toBeInTheDocument();
    expect(screen.queryByText(recordsText.values.recordedOnly)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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

  it("gives the most pages day one day-details action instead of a clickable tile and fetches nothing", () => {
    renderRecords(records.items);

    expect(screen.getAllByRole("button")).toEqual([
      screen.getByRole("button", { name: recordsText.openDay }),
    ]);
    expect(
      screen.queryByRole("button", { name: new RegExp(recordsText.types.most_pages_in_day) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the most pages day details from the keyboard", async () => {
    vi.stubGlobal("innerWidth", 1280);
    const user = userEvent.setup();
    renderRecords([MOST_PAGES_DAY]);
    const trigger = screen.getByRole("button", { name: recordsText.openDay });

    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("dialog", { name: "2 березня 2026 р." })).toBeInTheDocument();
  });

  it.each([PEAK_MONTH, LONGEST_STREAK, SERIES_MARATHON])(
    "renders the $type card with neither a link nor a details action",
    (record) => {
      renderRecords([record]);

      expect(screen.getByText(recordsText.types[record.type])).toBeInTheDocument();
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: recordsText.openDay })).not.toBeInTheDocument();
      expect(
        screen
          .queryAllByRole("button")
          .map((button) => button.getAttribute("aria-label") ?? button.textContent),
      ).toEqual(
        record.type === "peak_month"
          ? [translateHint("label", { topic: recordsText.types.peak_month })]
          : [],
      );
    },
  );
});
