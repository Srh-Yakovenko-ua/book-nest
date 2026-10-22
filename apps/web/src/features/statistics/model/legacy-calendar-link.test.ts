import { describe, expect, it } from "vitest";

import { legacyReadingCalendarHref } from "./legacy-calendar-link";

describe("legacyReadingCalendarHref", () => {
  it("moves an old yearly calendar link to the reading calendar with its year and month", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-03",
        period: "year",
        section: "calendar",
        tab: "activity",
        year: "2025",
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03", year: "2025" } });
  });

  it("keeps the year of an old calendar link that named no period", () => {
    expect(legacyReadingCalendarHref({ section: "calendar", year: "2024" })).toEqual({
      pathname: "/reading-calendar",
      query: { year: "2024" },
    });
  });

  it("drops the year when the old link showed a period other than a year", () => {
    expect(
      legacyReadingCalendarHref({ period: "all_time", section: "calendar", year: "2025" }),
    ).toEqual({ pathname: "/reading-calendar", query: {} });
  });

  it("opens the reading calendar with no query for a bare calendar link", () => {
    expect(legacyReadingCalendarHref({ section: "calendar" })).toEqual({
      pathname: "/reading-calendar",
      query: {},
    });
  });

  it("still redirects a repeated year, dropping the year and keeping the month", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-03",
        section: "calendar",
        year: ["2025", "2024"],
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03" } });
  });

  it("leaves a link to another statistics section alone", () => {
    expect(legacyReadingCalendarHref({ section: "habits", year: "2025" })).toBeNull();
  });

  it("leaves a statistics link without a section alone", () => {
    expect(legacyReadingCalendarHref({ period: "year", year: "2025" })).toBeNull();
  });

  it("leaves a link with a repeated section alone", () => {
    expect(legacyReadingCalendarHref({ section: ["calendar", "calendar"] })).toBeNull();
  });
});
