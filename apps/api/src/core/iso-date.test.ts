import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  parseIsoDate,
  toIsoDate,
  toIsoDateFromIsoString,
} from "./iso-date.js";

describe("iso-date", () => {
  it("round-trips a calendar date unchanged", () => {
    expect(toIsoDate(parseIsoDate("2000-05-15"))).toBe("2000-05-15");
  });

  it("pins a parsed date to UTC midnight", () => {
    expect(parseIsoDate("2000-05-15").toISOString()).toBe("2000-05-15T00:00:00.000Z");
  });

  it("preserves the calendar day for a UTC-midnight instant", () => {
    expect(toIsoDate(new Date("2000-05-15T00:00:00.000Z"))).toBe("2000-05-15");
  });

  describe("reading a calendar day out of an ISO string", () => {
    it("keeps a day-only string on its own day", () => {
      expect(toIsoDateFromIsoString("2026-08-05")).toBe("2026-08-05");
    });

    it("reads the UTC day out of an instant", () => {
      expect(toIsoDateFromIsoString("2026-08-05T00:00:00Z")).toBe("2026-08-05");
      expect(toIsoDateFromIsoString("2026-08-05T23:00:00-05:00")).toBe("2026-08-06");
    });
  });

  describe("with a server timezone west of UTC", () => {
    const originalTimezone = process.env.TZ;

    beforeEach(() => {
      process.env.TZ = "America/Los_Angeles";
    });

    afterEach(() => {
      process.env.TZ = originalTimezone;
    });

    it("does not shift the calendar day when round-tripping", () => {
      expect(toIsoDate(parseIsoDate("2000-05-15"))).toBe("2000-05-15");
    });

    it("reads the same calendar day out of an ISO string as it does at UTC", () => {
      expect(toIsoDateFromIsoString("2000-05-15")).toBe("2000-05-15");
      expect(toIsoDateFromIsoString("2000-05-15T00:00:00Z")).toBe("2000-05-15");
    });

    it("keeps a UTC-midnight instant on the same calendar day", () => {
      expect(toIsoDate(new Date("2000-05-15T00:00:00.000Z"))).toBe("2000-05-15");
    });

    it("counts calendar days across a spring-forward transition", () => {
      expect(addDaysToIsoDate("2000-04-01", 3)).toBe("2000-04-04");
      expect(daysBetweenIsoDates({ endIsoDate: "2000-04-04", startIsoDate: "2000-04-01" })).toBe(3);
    });
  });

  describe("calendar-day arithmetic on ISO date strings", () => {
    it("shifts a date forward and backward without touching the clock", () => {
      expect(addDaysToIsoDate("2026-07-30", 3)).toBe("2026-08-02");
      expect(addDaysToIsoDate("2026-08-02", -3)).toBe("2026-07-30");
    });

    it("counts whole days from the start date to the end date", () => {
      expect(daysBetweenIsoDates({ endIsoDate: "2026-08-02", startIsoDate: "2026-07-30" })).toBe(3);
    });

    it("returns a negative count when the end date precedes the start date", () => {
      expect(daysBetweenIsoDates({ endIsoDate: "2026-07-30", startIsoDate: "2026-08-02" })).toBe(
        -3,
      );
    });
  });
});
