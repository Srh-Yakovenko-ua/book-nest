import { describe, expect, it } from "vitest";

import {
  buildMonthGrid,
  buildMonthSlots,
  clipCalendarMonth,
  hasDaysBeforeAccountStart,
  listCalendarMonths,
  resolveCalendarMonth,
  resolveSelectedCalendarDay,
  summarizeCalendarMonth,
  toSelectableCalendarDay,
  weekdayOrder,
} from "./statistics-calendar";
import { calendarDayFixture, statisticsIds } from "./statistics.fixtures";

const MARCH_2026 = [
  "2026-03-01",
  "2026-03-02",
  "2026-03-03",
  "2026-03-04",
  "2026-03-05",
  "2026-03-06",
  "2026-03-07",
].map((date) => calendarDayFixture({ date, drilldown: { date, kind: "reading_day" } }));

const READING_CYCLE_DRILLDOWN = {
  bookId: statisticsIds.bookId,
  kind: "reading_cycle",
  readingCycleId: statisticsIds.cycleId,
} as const;

function readingDay(date: string, booksCount: number) {
  return calendarDayFixture({ booksCount, date, drilldown: { date, kind: "reading_day" } });
}

describe("weekdayOrder", () => {
  it("starts on Monday for a Monday week start", () => {
    expect(weekdayOrder("monday")).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("starts on Sunday for a Sunday week start", () => {
    expect(weekdayOrder("sunday")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("buildMonthSlots", () => {
  it.each([
    ["2027-02", 4],
    ["2026-07", 5],
    ["2026-08", 6],
  ])("lays %s out in %i Monday-first weeks", (monthKey, weeks) => {
    expect(
      buildMonthSlots({
        accountStart: null,
        days: [],
        monthKey,
        today: "2027-12-31",
        weekStartDay: "monday",
      }),
    ).toHaveLength(weeks);
  });

  it("leaves the padding around the month blank and keeps each day under its weekday", () => {
    const weeks = buildMonthSlots({
      accountStart: null,
      days: MARCH_2026,
      monthKey: "2026-03",
      today: "2026-03-31",
      weekStartDay: "monday",
    });

    expect(weeks[0]?.slice(0, 6).every((slot) => slot.kind === "blank")).toBe(true);
    expect(weeks[0]?.[6]).toEqual({ day: MARCH_2026[0], kind: "day" });
    expect(weeks.at(-1)?.at(-1)).toEqual({ kind: "blank" });
  });

  it("splits the dates the calendar does not carry into missing up to today and future after it", () => {
    const weeks = buildMonthSlots({
      accountStart: null,
      days: MARCH_2026,
      monthKey: "2026-03",
      today: "2026-03-20",
      weekStartDay: "monday",
    });
    const slots = weeks.flat();

    expect(slots).toContainEqual({ date: "2026-03-20", kind: "missing" });
    expect(slots).toContainEqual({ date: "2026-03-21", kind: "future" });
    expect(slots).toContainEqual({ date: "2026-03-31", kind: "future" });
    expect(slots.filter((slot) => slot.kind !== "blank")).toHaveLength(31);
  });

  it.each([
    ["an exact unread day", readingDay("2026-03-03", 0)],
    [
      "an unknown legacy day",
      calendarDayFixture({
        date: "2026-03-03",
        drilldown: { date: "2026-03-03", kind: "reading_day" },
        historyQuality: "legacy_observed_only",
      }),
    ],
  ])("shows %s before the account start as before_account", (_label, day) => {
    const slots = buildMonthSlots({
      accountStart: "2026-03-05",
      days: [day],
      monthKey: "2026-03",
      today: "2026-03-20",
      weekStartDay: "monday",
    }).flat();

    expect(slots).toContainEqual({ date: "2026-03-03", kind: "before_account" });
  });

  it.each([
    [
      "pages read",
      calendarDayFixture({
        booksCount: 1,
        date: "2026-03-03",
        drilldown: { date: "2026-03-03", kind: "reading_day" },
        pagesRead: 40,
      }),
    ],
    ["a book without pages", readingDay("2026-03-03", 1)],
  ])("keeps a day with %s before the account start as a day", (_label, day) => {
    const slots = buildMonthSlots({
      accountStart: "2026-03-05",
      days: [day],
      monthKey: "2026-03",
      today: "2026-03-20",
      weekStartDay: "monday",
    }).flat();

    expect(slots).toContainEqual({ day, kind: "day" });
  });

  it("keeps unread days from the account start on as days", () => {
    const startDay = readingDay("2026-03-05", 0);
    const laterDay = readingDay("2026-03-10", 0);
    const slots = buildMonthSlots({
      accountStart: "2026-03-05",
      days: [startDay, laterDay],
      monthKey: "2026-03",
      today: "2026-03-20",
      weekStartDay: "monday",
    }).flat();

    expect(slots).toContainEqual({ day: startDay, kind: "day" });
    expect(slots).toContainEqual({ day: laterDay, kind: "day" });
  });

  it("marks uncarried dates before the account start as before_account and from it on as missing", () => {
    const slots = buildMonthSlots({
      accountStart: "2026-03-05",
      days: [],
      monthKey: "2026-03",
      today: "2026-03-20",
      weekStartDay: "monday",
    }).flat();

    expect(slots).toContainEqual({ date: "2026-03-01", kind: "before_account" });
    expect(slots).toContainEqual({ date: "2026-03-04", kind: "before_account" });
    expect(slots).toContainEqual({ date: "2026-03-05", kind: "missing" });
  });

  it("keeps dates after today future even when they fall before the account start", () => {
    const slots = buildMonthSlots({
      accountStart: "2026-03-25",
      days: [],
      monthKey: "2026-03",
      today: "2026-03-20",
      weekStartDay: "monday",
    }).flat();

    expect(slots).toContainEqual({ date: "2026-03-20", kind: "before_account" });
    expect(slots).toContainEqual({ date: "2026-03-21", kind: "future" });
  });
});

describe("hasDaysBeforeAccountStart", () => {
  it("reports an unread day before the account start", () => {
    expect(
      hasDaysBeforeAccountStart({
        accountStart: "2026-03-05",
        days: [readingDay("2026-03-04", 0), readingDay("2026-03-06", 0)],
      }),
    ).toBe(true);
  });

  it("ignores days with reading before the account start and unread days from it on", () => {
    expect(
      hasDaysBeforeAccountStart({
        accountStart: "2026-03-05",
        days: [readingDay("2026-03-02", 1), readingDay("2026-03-05", 0)],
      }),
    ).toBe(false);
  });

  it("reports nothing without an account start", () => {
    expect(
      hasDaysBeforeAccountStart({ accountStart: null, days: [readingDay("2026-03-02", 0)] }),
    ).toBe(false);
  });
});

describe("buildMonthGrid", () => {
  it("lays March 2026 out with a leading pad under a Monday week start", () => {
    const weeks = buildMonthGrid({ days: MARCH_2026, monthKey: "2026-03", weekStartDay: "monday" });

    expect(weeks[0]?.filter((cell) => cell === null)).toHaveLength(6);
    expect(weeks[0]?.[6]?.date).toBe("2026-03-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("renders every day of the month, including days without activity", () => {
    const weeks = buildMonthGrid({ days: MARCH_2026, monthKey: "2026-03", weekStartDay: "sunday" });
    const cells = weeks.flat();

    expect(cells).toHaveLength(35);
    expect(cells.filter((cell) => cell !== null)).toHaveLength(7);
  });
});

describe("listCalendarMonths", () => {
  it("lists every month the display range touches", () => {
    expect(listCalendarMonths({ from: "2025-11-14", to: "2026-02-03" })).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("returns a single month for a range inside one month", () => {
    expect(listCalendarMonths({ from: "2026-03-01", to: "2026-03-31" })).toEqual(["2026-03"]);
  });
});

describe("summarizeCalendarMonth", () => {
  const firstBook = "11111111-1111-4111-8111-111111111111";
  const secondBook = "22222222-2222-4222-8222-222222222222";

  it("counts active days, pages and distinct previewed books", () => {
    const summary = summarizeCalendarMonth([
      calendarDayFixture({
        booksCount: 2,
        booksPreview: [
          { bookId: firstBook, coverThumbUrl: null, pagesRead: 10, title: "First" },
          { bookId: secondBook, coverThumbUrl: null, pagesRead: 30, title: "Second" },
        ],
        date: "2026-03-02",
        pagesRead: 40,
      }),
      calendarDayFixture({
        booksCount: 1,
        booksPreview: [{ bookId: firstBook, coverThumbUrl: null, pagesRead: 10, title: "First" }],
        date: "2026-03-03",
        pagesRead: 10,
      }),
      calendarDayFixture({ date: "2026-03-04" }),
    ]);

    expect(summary).toEqual({
      activeDays: 2,
      books: { count: 2, isLowerBound: false },
      hasLegacyHistory: false,
      hasUnknownDays: false,
      pagesRead: 50,
    });
  });

  it("marks the book count as a lower bound when a day hides books behind the preview", () => {
    const summary = summarizeCalendarMonth([
      calendarDayFixture({
        booksCount: 4,
        booksPreview: [{ bookId: firstBook, coverThumbUrl: null, pagesRead: 10, title: "First" }],
        pagesRead: 30,
        remainingBooksCount: 3,
      }),
    ]);

    expect(summary.books).toEqual({ count: 1, isLowerBound: true });
  });

  it("flags empty legacy days as unknown history", () => {
    const summary = summarizeCalendarMonth([
      calendarDayFixture({ historyQuality: "legacy_observed_only" }),
    ]);

    expect(summary.hasUnknownDays).toBe(true);
    expect(summary.activeDays).toBe(0);
  });

  it("flags legacy history on a legacy day with recorded pages, which is not an unknown day", () => {
    const summary = summarizeCalendarMonth([
      calendarDayFixture({
        booksCount: 1,
        booksPreview: [{ bookId: firstBook, coverThumbUrl: null, pagesRead: 20, title: "First" }],
        historyQuality: "legacy_observed_only",
        pagesRead: 20,
      }),
    ]);

    expect(summary.hasLegacyHistory).toBe(true);
    expect(summary.hasUnknownDays).toBe(false);
  });

  it("flags legacy history when a single day among exact ones is legacy", () => {
    const summary = summarizeCalendarMonth([
      calendarDayFixture({ date: "2026-03-02", pagesRead: 10 }),
      calendarDayFixture({ date: "2026-03-03", historyQuality: "legacy_observed_only" }),
      calendarDayFixture({ date: "2026-03-04", pagesRead: 5 }),
    ]);

    expect(summary.hasLegacyHistory).toBe(true);
  });

  it("reports no legacy history when every day is exact", () => {
    const summary = summarizeCalendarMonth([
      calendarDayFixture({ date: "2026-03-02", pagesRead: 10 }),
      calendarDayFixture({ date: "2026-03-03" }),
    ]);

    expect(summary.hasLegacyHistory).toBe(false);
  });
});

describe("resolveCalendarMonth", () => {
  const months = ["2026-01", "2026-02", "2026-03"];

  it("keeps a requested month the range lists, even when it is not the latest", () => {
    expect(resolveCalendarMonth({ months, requested: "2026-01" })).toBe("2026-01");
  });

  it.each([["2026-13"], ["2026-3"], ["abc"], ["1999-01"], [null]] as const)(
    "falls back to the latest listed month for %s",
    (requested) => {
      expect(resolveCalendarMonth({ months, requested })).toBe("2026-03");
    },
  );

  it("resolves to no month when the range lists none", () => {
    expect(resolveCalendarMonth({ months: [], requested: "2026-03" })).toBeNull();
  });
});

describe("clipCalendarMonth", () => {
  const range = { from: "2025-12-15", to: "2026-03-10" };

  it("keeps a whole month that lies inside the range", () => {
    expect(clipCalendarMonth({ monthKey: "2026-02", range })).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("starts the first month where the display range starts", () => {
    expect(clipCalendarMonth({ monthKey: "2025-12", range })).toEqual({
      from: "2025-12-15",
      to: "2025-12-31",
    });
  });

  it("ends the current month at today when the display range stops there", () => {
    expect(clipCalendarMonth({ monthKey: "2026-03", range })).toEqual({
      from: "2026-03-01",
      to: "2026-03-10",
    });
  });
});

describe("toSelectableCalendarDay", () => {
  it("does not offer a day without books", () => {
    expect(toSelectableCalendarDay(readingDay("2026-03-04", 0))).toBeNull();
  });

  it("does not offer a day with books whose drilldown leads elsewhere than a reading day", () => {
    const day = calendarDayFixture({
      booksCount: 2,
      date: "2026-03-04",
      drilldown: READING_CYCLE_DRILLDOWN,
    });

    expect(toSelectableCalendarDay(day)).toBeNull();
  });

  it("offers a day with books and takes its detail date from the reading-day drilldown", () => {
    const day = calendarDayFixture({
      booksCount: 2,
      date: "2026-03-05",
      drilldown: { date: "2026-03-04", kind: "reading_day" },
    });

    expect(toSelectableCalendarDay(day)).toEqual({ date: "2026-03-05", detailDate: "2026-03-04" });
  });
});

describe("resolveSelectedCalendarDay", () => {
  const days = [
    readingDay("2026-03-02", 2),
    readingDay("2026-03-04", 0),
    readingDay("2026-03-05", 1),
    readingDay("2026-03-07", 0),
  ];

  it("keeps a requested day that has books, even when a later day has books too", () => {
    expect(resolveSelectedCalendarDay({ days, requested: "2026-03-02" })).toEqual({
      date: "2026-03-02",
      detailDate: "2026-03-02",
    });
  });

  it("falls back to the latest day with books when the requested day has none", () => {
    expect(resolveSelectedCalendarDay({ days, requested: "2026-03-04" })).toEqual({
      date: "2026-03-05",
      detailDate: "2026-03-05",
    });
  });

  it.each([["2026-03-20"], [null]] as const)(
    "falls back to the latest day with books for %s, which the month does not list",
    (requested) => {
      expect(resolveSelectedCalendarDay({ days, requested })).toEqual({
        date: "2026-03-05",
        detailDate: "2026-03-05",
      });
    },
  );

  it("picks the latest day with books by date, not by its position in the list", () => {
    const shuffled = [
      readingDay("2026-03-03", 3),
      readingDay("2026-03-05", 1),
      readingDay("2026-03-07", 0),
      readingDay("2026-03-02", 2),
    ];

    expect(resolveSelectedCalendarDay({ days: shuffled, requested: null })).toEqual({
      date: "2026-03-05",
      detailDate: "2026-03-05",
    });
  });

  it("selects no day when no day of the month can be opened", () => {
    const closedDays = [
      readingDay("2026-03-02", 0),
      calendarDayFixture({ booksCount: 2, date: "2026-03-03", drilldown: READING_CYCLE_DRILLDOWN }),
    ];

    expect(resolveSelectedCalendarDay({ days: closedDays, requested: "2026-03-03" })).toBeNull();
  });
});
