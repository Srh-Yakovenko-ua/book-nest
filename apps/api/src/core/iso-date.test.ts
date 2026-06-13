import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseIsoDate, toIsoDate } from "./iso-date.js";

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

    it("keeps a UTC-midnight instant on the same calendar day", () => {
      expect(toIsoDate(new Date("2000-05-15T00:00:00.000Z"))).toBe("2000-05-15");
    });
  });
});
