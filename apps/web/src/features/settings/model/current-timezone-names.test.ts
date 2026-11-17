import { describe, expect, it } from "vitest";

import { currentTimezoneName, legacyTimezoneNames } from "./current-timezone-names";

const ZONES = {
  renamed: [
    { current: "Europe/Kyiv", legacy: "Europe/Kiev" },
    { current: "Asia/Kolkata", legacy: "Asia/Calcutta" },
  ],
  runtime: Intl.supportedValuesOf("timeZone"),
  unrenamed: ["Europe/Berlin", "America/New_York", "UTC"],
} as const;

function resolvedTimezone(zone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
}

describe("currentTimezoneName", () => {
  it.each(ZONES.renamed)("renames $legacy to $current", ({ current, legacy }) => {
    expect(currentTimezoneName(legacy)).toBe(current);
  });

  it.each(ZONES.unrenamed)("returns %s unchanged", (zone) => {
    expect(currentTimezoneName(zone)).toBe(zone);
  });

  it("names the zone the runtime resolves for every zone the runtime lists", () => {
    const mismatches = ZONES.runtime.filter(
      (zone) => resolvedTimezone(currentTimezoneName(zone)) !== resolvedTimezone(zone),
    );

    expect(mismatches).toEqual([]);
  });
});

describe("legacyTimezoneNames", () => {
  it.each(ZONES.renamed)("lists $legacy as the legacy name of $current", ({ current, legacy }) => {
    expect(legacyTimezoneNames(current)).toEqual([legacy]);
  });

  it.each(ZONES.unrenamed)("lists no legacy name for %s", (zone) => {
    expect(legacyTimezoneNames(zone)).toEqual([]);
  });
});
