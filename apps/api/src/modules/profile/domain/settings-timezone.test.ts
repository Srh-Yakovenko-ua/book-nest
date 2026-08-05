import {
  defaultUserProfileSettings,
  StoredTimezoneSchema,
  UpdateSettingsInputSchema,
} from "@app/shared";
import { describe, expect, it, vi } from "vitest";

const TIMEZONE_MAX = 64;
const OVERSIZED_BODY_TIMEZONE = "K".repeat(1_000_000);
const NON_CANONICAL_TIMEZONE = "US/Eastern";
const buildDateTimeFormat = Intl.DateTimeFormat;

function countDateTimeFormats() {
  return vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (...args) {
    return new buildDateTimeFormat(...args);
  });
}

function parseTimezone(timezone: string): boolean {
  return UpdateSettingsInputSchema.safeParse({ timezone }).success;
}

describe("the settings timezone boundary", () => {
  it.each([
    "Europe/Kyiv",
    "Europe/Kiev",
    "America/New_York",
    "Asia/Tokyo",
    "UTC",
    defaultUserProfileSettings.timezone,
  ])("accepts the resolvable zone %s", (timezone) => {
    expect(parseTimezone(timezone)).toBe(true);
  });

  it.each(["Not/AZone", "Europe/Atlantis", "", "   ", "+02:00", "<script>alert(1)</script>"])(
    "rejects %s",
    (timezone) => {
      expect(parseTimezone(timezone)).toBe(false);
    },
  );

  it("rejects a string longer than the column bound", () => {
    expect(parseTimezone(`Europe/${"K".repeat(TIMEZONE_MAX)}`)).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = UpdateSettingsInputSchema.parse({ timezone: "  Europe/Kyiv  " });

    expect(result.timezone).toBe("Europe/Kyiv");
  });

  it("reports the rejected zone under the timezone field", () => {
    const result = UpdateSettingsInputSchema.safeParse({ timezone: "Not/AZone" });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["timezone"]]);
  });
});

describe("the settings timezone pre-filter", () => {
  it.each([
    ["an oversized string", OVERSIZED_BODY_TIMEZONE],
    ["an HTML-bearing string", "<script>alert(1)</script>"],
    ["an empty string", ""],
  ])("never builds a formatter for %s", (_label, timezone) => {
    const dateTimeFormat = countDateTimeFormats();

    expect(parseTimezone(timezone)).toBe(false);
    expect(dateTimeFormat).not.toHaveBeenCalled();
  });

  it("builds at most one formatter for a valid non-canonical zone", () => {
    const dateTimeFormat = countDateTimeFormats();

    expect(parseTimezone(NON_CANONICAL_TIMEZONE)).toBe(true);
    expect(dateTimeFormat.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("StoredTimezoneSchema", () => {
  it("keeps a stored zone that still resolves", () => {
    expect(StoredTimezoneSchema.parse("Europe/London")).toBe("Europe/London");
  });

  it.each(["Not/AZone", "", "x".repeat(TIMEZONE_MAX + 1)])(
    "falls back to the default when the stored value %s cannot be resolved",
    (stored) => {
      expect(StoredTimezoneSchema.parse(stored)).toBe(defaultUserProfileSettings.timezone);
    },
  );
});
