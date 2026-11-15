import { describe, expect, it } from "vitest";

import { ISO_DAY } from "./iso-day";

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
