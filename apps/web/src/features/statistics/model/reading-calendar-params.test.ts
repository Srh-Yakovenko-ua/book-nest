import { describe, expect, it } from "vitest";

import {
  defaultReadingCalendarMonth,
  parseReadingCalendarMonth,
  parseReadingCalendarYear,
  readingCalendarCurrentYear,
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
