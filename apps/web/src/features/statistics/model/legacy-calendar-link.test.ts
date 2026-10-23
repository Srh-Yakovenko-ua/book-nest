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

  it("takes the year from the month when the old link repeated the year", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-03",
        section: "calendar",
        year: ["2025", "2024"],
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03", year: "2025" } });
  });

  it("takes the year from the month of an old link that showed a period other than a year", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-03",
        period: "all_time",
        section: "calendar",
        tab: "activity",
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03", year: "2025" } });
  });

  it("takes the year from the month when a period other than a year dropped the old year", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-03",
        period: "all_time",
        section: "calendar",
        year: "2024",
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03", year: "2025" } });
  });

  it("takes the year from the month of an old link that named no year", () => {
    expect(legacyReadingCalendarHref({ calendarMonth: "2025-03", section: "calendar" })).toEqual({
      pathname: "/reading-calendar",
      query: { month: "2025-03", year: "2025" },
    });
  });

  it("keeps the explicit year of an old link that named no period next to its month", () => {
    expect(
      legacyReadingCalendarHref({ calendarMonth: "2025-03", section: "calendar", year: "2025" }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03", year: "2025" } });
  });

  it("keeps the explicit year of a yearly link even when its month falls in another year", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-03",
        period: "year",
        section: "calendar",
        year: "2024",
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-03", year: "2024" } });
  });

  it("derives no year from an out-of-range month and still passes the month through", () => {
    expect(
      legacyReadingCalendarHref({
        calendarMonth: "2025-13",
        period: "all_time",
        section: "calendar",
      }),
    ).toEqual({ pathname: "/reading-calendar", query: { month: "2025-13" } });
  });

  it("derives no year from a month not written as YYYY-MM and still passes it through", () => {
    expect(legacyReadingCalendarHref({ calendarMonth: "march", section: "calendar" })).toEqual({
      pathname: "/reading-calendar",
      query: { month: "march" },
    });
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
