import { describe, expect, it } from "vitest";

import { instantToIsoDay, ISO_DAY } from "./iso-day";

describe("ISO_DAY.pattern", () => {
  it("accepts a zero-padded calendar day", () => {
    expect(ISO_DAY.pattern.test("2026-11-15")).toBe(true);
  });

  it.each([
    ["a day without zero padding", "2026-1-5"],
    ["a day in the dotted local format", "15.11.2026"],
    ["a day with a time attached", "2026-11-15T00:00"],
  ])("rejects %s", (_label, value) => {
    expect(ISO_DAY.pattern.test(value)).toBe(false);
  });
});

describe("instantToIsoDay", () => {
  it.each([
    ["a Kyiv midnight", "2026-02-09T22:00:00.000Z", "Europe/Kyiv", "2026-02-10"],
    ["a New York midnight", "2026-02-10T05:00:00.000Z", "America/New_York", "2026-02-10"],
    ["a late evening in New York", "2026-02-10T04:59:59.999Z", "America/New_York", "2026-02-09"],
    ["a summer night in Kyiv", "2026-07-14T21:30:00.000Z", "Europe/Kyiv", "2026-07-15"],
  ])("dates %s by the profile zone", (_label, instant, timeZone, expected) => {
    expect(instantToIsoDay({ instant, timeZone })).toBe(expected);
  });
});
