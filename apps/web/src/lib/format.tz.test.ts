import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime } from "@/lib/format";

const PINNED_TIME_ZONE = "America/New_York";
const LOCAL_NOON = "2026-02-11T12:00:00";

let previousTimeZone: string | undefined;

beforeEach(() => {
  previousTimeZone = process.env.TZ;
  process.env.TZ = PINNED_TIME_ZONE;
  vi.useFakeTimers();
  vi.setSystemTime(parseISO(LOCAL_NOON));
});

afterEach(() => {
  vi.useRealTimers();
  if (previousTimeZone === undefined) {
    delete process.env.TZ;
    return;
  }
  process.env.TZ = previousTimeZone;
});

describe(`formatRelativeTime in ${PINNED_TIME_ZONE}`, () => {
  it("reads a date-only value as the local calendar day", () => {
    expect(formatRelativeTime("2026-02-10", "uk")).toBe("учора");
  });

  it("reads an instant in the local zone", () => {
    expect(formatRelativeTime("2026-02-10T03:00:00.000Z", "uk")).toBe("позавчора");
  });
});
