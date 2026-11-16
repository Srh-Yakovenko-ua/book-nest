import { format } from "date-fns";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isoDayToDate } from "@/lib/iso-day";

const PINNED_TIME_ZONE = "America/New_York";
const CALENDAR_DAY = "2026-08-24";

let previousTimeZone: string | undefined;

beforeEach(() => {
  previousTimeZone = process.env.TZ;
  process.env.TZ = PINNED_TIME_ZONE;
});

afterEach(() => {
  if (previousTimeZone === undefined) {
    delete process.env.TZ;
    return;
  }
  process.env.TZ = previousTimeZone;
});

function parsedDay(value: string): Date {
  const date = isoDayToDate(value);
  if (date === undefined) throw new Error(`expected ${value} to parse as a calendar day`);
  return date;
}

describe(`isoDayToDate reading a day string into a Date in ${PINNED_TIME_ZONE}`, () => {
  it("reads the string as that same local calendar day rather than the UTC midnight before it", () => {
    expect(format(parsedDay(CALENDAR_DAY), "yyyy-MM-dd")).toBe("2026-08-24");
  });
});
