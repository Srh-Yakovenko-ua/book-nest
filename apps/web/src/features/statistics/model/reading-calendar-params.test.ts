import { describe, expect, it } from "vitest";

import {
  defaultReadingCalendarMonth,
  parseReadingCalendarDay,
  parseReadingCalendarMonth,
  parseReadingCalendarYear,
  readingCalendarCurrentYear,
  toMonthKey,
} from "./reading-calendar-params";

const TODAY = "2026-10-22";

describe("parseReadingCalendarYear", () => {
  it.each([
    ["2025", 2025],
    ["2026", 2026],
    ["1900", 1900],
  ] as const)("accepts %s as a year to show", (value, expected) => {
    expect(parseReadingCalendarYear({ currentYear: 2026, value })).toBe(expected);
  });

  it("rejects a year before 1900", () => {
    expect(parseReadingCalendarYear({ currentYear: 2026, value: "1899" })).toBeNull();
  });

  it("rejects a year after the current one", () => {
    expect(parseReadingCalendarYear({ currentYear: 2026, value: "2027" })).toBeNull();
  });

  it.each([["abc"], ["2025abc"], [""], ["25"], ["02025"]] as const)(
    "rejects %j, which is not a four-digit year",
    (value) => {
      expect(parseReadingCalendarYear({ currentYear: 2026, value })).toBeNull();
    },
  );
});

describe("parseReadingCalendarMonth", () => {
  it("accepts today's month in the current year", () => {
    expect(parseReadingCalendarMonth({ today: TODAY, value: "2026-10", year: 2026 })).toBe(
      "2026-10",
    );
  });

  it("rejects a month after today's month", () => {
    expect(parseReadingCalendarMonth({ today: TODAY, value: "2026-11", year: 2026 })).toBeNull();
  });

  it("rejects a month from another year than the one shown", () => {
    expect(parseReadingCalendarMonth({ today: TODAY, value: "2025-03", year: 2026 })).toBeNull();
  });

  it("accepts a month inside a past year", () => {
    expect(parseReadingCalendarMonth({ today: TODAY, value: "2025-03", year: 2025 })).toBe(
      "2025-03",
    );
  });

  it.each([["2025-13"], ["2025-00"], ["2025-3"], ["march"]] as const)(
    "rejects %j, which is not a YYYY-MM month",
    (value) => {
      expect(parseReadingCalendarMonth({ today: TODAY, value, year: 2025 })).toBeNull();
    },
  );
});

describe("defaultReadingCalendarMonth", () => {
  it("opens today's month for the current year", () => {
    expect(defaultReadingCalendarMonth({ today: TODAY, year: 2026 })).toBe("2026-10");
  });

  it.each([
    [2025, "2025-12"],
    [1900, "1900-12"],
  ] as const)("opens December for the past year %i", (year, expected) => {
    expect(defaultReadingCalendarMonth({ today: TODAY, year })).toBe(expected);
  });
});

describe("readingCalendarCurrentYear", () => {
  it.each([
    ["2026-10-22", 2026],
    ["2027-01-01", 2027],
  ] as const)("reads the year of %s", (today, expected) => {
    expect(readingCalendarCurrentYear(today)).toBe(expected);
  });
});

describe("parseReadingCalendarDay", () => {
  it.each([
    ["2026-10-05", "2026-10"],
    ["2025-03-31", "2025-03"],
  ] as const)("accepts %s, a past day of the month %s", (value, month) => {
    expect(parseReadingCalendarDay({ month, today: TODAY, value })).toBe(value);
  });

  it("accepts today", () => {
    expect(parseReadingCalendarDay({ month: "2026-10", today: TODAY, value: TODAY })).toBe(TODAY);
  });

  it("rejects the day after today", () => {
    expect(
      parseReadingCalendarDay({ month: "2026-10", today: TODAY, value: "2026-10-23" }),
    ).toBeNull();
  });

  it("rejects a day of another month than the one shown", () => {
    expect(
      parseReadingCalendarDay({ month: "2026-10", today: TODAY, value: "2026-09-30" }),
    ).toBeNull();
  });

  it.each([["2026-10-1"], ["2026/10/01"], ["abc"], [""]] as const)(
    "rejects %j, which is not a yyyy-MM-dd day",
    (value) => {
      expect(parseReadingCalendarDay({ month: "2026-10", today: TODAY, value })).toBeNull();
    },
  );

  it.each([
    ["2026-02-30", "2026-02"],
    ["2026-07-40", "2026-07"],
    ["2026-13-01", "2026-13"],
  ] as const)("rejects the impossible date %s without throwing", (value, month) => {
    const parseDay = () => parseReadingCalendarDay({ month, today: TODAY, value });

    expect(parseDay).not.toThrow();
    expect(parseDay()).toBeNull();
  });
});

describe("toMonthKey", () => {
  it.each([
    ["2026-07-15", "2026-07"],
    ["2025-12-31", "2025-12"],
  ] as const)("reads the month of %s as %s", (isoDay, expected) => {
    expect(toMonthKey(isoDay)).toBe(expected);
  });
});
