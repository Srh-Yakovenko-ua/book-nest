import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import { genreTenure } from "./genre-tenure";

const NOW = new Date("2026-09-23T12:00:00.000Z");

describe("genreTenure", () => {
  it("counts days during the first week", () => {
    expect(genreTenure("2026-09-18T12:00:00.000Z", NOW)).toEqual({ count: 5, unit: "day" });
  });

  it("never says zero days for a genre added today", () => {
    expect(genreTenure("2026-09-23T08:00:00.000Z", NOW)).toEqual({ count: 1, unit: "day" });
  });

  it("switches to weeks after seven days", () => {
    expect(genreTenure("2026-09-09T12:00:00.000Z", NOW)).toEqual({ count: 2, unit: "week" });
  });

  it("says one week, never zero, when seven calendar days span less than a full week", () => {
    expect(genreTenure("2026-09-16T16:00:00.000", parseISO("2026-09-23T12:00:00.000"))).toEqual({
      count: 1,
      unit: "week",
    });
  });

  it("switches to months after a full month", () => {
    expect(genreTenure("2026-08-20T12:00:00.000Z", NOW)).toEqual({ count: 1, unit: "month" });
  });
});
