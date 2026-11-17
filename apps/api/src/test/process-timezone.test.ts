import { describe, expect, it } from "vitest";

import { switchProcessTimezone } from "./process-timezone.js";

const PINNED_TIMEZONE = "Asia/Tokyo";

function resolvedTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

describe("switchProcessTimezone", () => {
  it("resolves dates in the requested zone until restored", () => {
    const restore = switchProcessTimezone(PINNED_TIMEZONE);
    const pinnedTimezone = resolvedTimezone();
    restore();

    expect(pinnedTimezone).toBe(PINNED_TIMEZONE);
  });

  it("restores the zone and the TZ variable it replaced", () => {
    const before = { envValue: process.env.TZ, timezone: resolvedTimezone() };

    switchProcessTimezone(PINNED_TIMEZONE)();

    expect({ envValue: process.env.TZ, timezone: resolvedTimezone() }).toStrictEqual(before);
  });
});
