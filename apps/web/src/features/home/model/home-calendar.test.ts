import { WEEK_STARTS_ON } from "@app/shared";
import { addMilliseconds, differenceInMinutes, isBefore } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  homeCalendar,
  isSameCalendarSlot,
  millisecondsUntilNextBoundary,
  nextCalendarBoundary,
  partOfDayForHour,
} from "./home-calendar";

const KYIV = "Europe/Kyiv";
const MONDAY_START = WEEK_STARTS_ON.monday;
const SUNDAY_START = WEEK_STARTS_ON.sunday;

function kyivCalendar(instant: string) {
  return homeCalendar({ now: new Date(instant), timeZone: KYIV, weekStartsOn: MONDAY_START });
}

describe("homeCalendar part of day", () => {
  it.each([
    ["2026-11-24T02:59:00.000Z", "04:59", "night"],
    ["2026-11-24T03:00:00.000Z", "05:00", "morning"],
    ["2026-11-24T09:59:00.000Z", "11:59", "morning"],
    ["2026-11-24T10:00:00.000Z", "12:00", "day"],
    ["2026-11-24T15:59:00.000Z", "17:59", "day"],
    ["2026-11-24T16:00:00.000Z", "18:00", "evening"],
    ["2026-11-24T20:59:00.000Z", "22:59", "evening"],
    ["2026-11-24T21:00:00.000Z", "23:00", "night"],
  ] as const)("reads %s (%s in Kyiv) as %s", (instant, _kyivTime, expected) => {
    expect(kyivCalendar(instant).partOfDay).toBe(expected);
  });

  it.each([
    [0, "night"],
    [4, "night"],
    [5, "morning"],
    [11, "morning"],
    [12, "day"],
    [17, "day"],
    [18, "evening"],
    [22, "evening"],
    [23, "night"],
  ] as const)("maps hour %i to %s", (hour, expected) => {
    expect(partOfDayForHour(hour)).toBe(expected);
  });
});

describe("homeCalendar local day", () => {
  it("dates the day in the profile timezone, not in UTC", () => {
    expect(kyivCalendar("2026-11-24T22:30:00.000Z").today).toBe("2026-11-25");
  });

  it("keeps the UTC day for a UTC profile at the same instant", () => {
    const calendar = homeCalendar({
      now: new Date("2026-11-24T22:30:00.000Z"),
      timeZone: "UTC",
      weekStartsOn: MONDAY_START,
    });

    expect(calendar.today).toBe("2026-11-24");
  });

  it("falls back to UTC for an unknown timezone without throwing", () => {
    const calendar = homeCalendar({
      now: new Date("2026-11-24T22:30:00.000Z"),
      timeZone: "Mars/Olympus_Mons",
      weekStartsOn: MONDAY_START,
    });

    expect(calendar).toMatchObject({ timeZone: "UTC", today: "2026-11-24" });
  });

  it("starts the week on Monday for a Monday profile", () => {
    expect(kyivCalendar("2026-11-24T22:30:00.000Z").weekStart).toBe("2026-11-23");
  });

  it("starts the week on Sunday for a Sunday profile", () => {
    const calendar = homeCalendar({
      now: new Date("2026-11-24T22:30:00.000Z"),
      timeZone: KYIV,
      weekStartsOn: SUNDAY_START,
    });

    expect(calendar.weekStart).toBe("2026-11-22");
  });
});

describe("nextCalendarBoundary", () => {
  it("returns the next part-of-day start within the same day", () => {
    const boundary = nextCalendarBoundary({
      now: new Date("2026-11-24T09:30:00.000Z"),
      timeZone: KYIV,
    });

    expect(boundary.toISOString()).toBe("2026-11-24T10:00:00.000Z");
  });

  it("returns local midnight after the last part of the day has started", () => {
    const boundary = nextCalendarBoundary({
      now: new Date("2026-11-24T21:30:00.000Z"),
      timeZone: KYIV,
    });

    expect(boundary.toISOString()).toBe("2026-11-24T22:00:00.000Z");
  });

  it("lands on 05:00 winter time on the night Kyiv turns the clocks back", () => {
    const boundary = nextCalendarBoundary({
      now: new Date("2026-10-24T21:30:00.000Z"),
      timeZone: KYIV,
    });

    expect(boundary.toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("lands on 05:00 summer time on the night Kyiv turns the clocks forward", () => {
    const boundary = nextCalendarBoundary({
      now: new Date("2027-03-27T22:30:00.000Z"),
      timeZone: KYIV,
    });

    expect(boundary.toISOString()).toBe("2027-03-28T02:00:00.000Z");
  });
});

describe("millisecondsUntilNextBoundary", () => {
  it.each([
    ["2026-11-24T21:30:00.000Z", "2026-11-24T22:00:00.000Z"],
    ["2026-10-24T21:30:00.000Z", "2026-10-25T03:00:00.000Z"],
    ["2027-03-27T22:30:00.000Z", "2027-03-28T02:00:00.000Z"],
  ] as const)("fires from %s just after the boundary at %s", (instant, boundary) => {
    const now = new Date(instant);
    const firesAt = addMilliseconds(now, millisecondsUntilNextBoundary({ now, timeZone: KYIV }));

    expect(isBefore(firesAt, new Date(boundary))).toBe(false);
    expect(differenceInMinutes(firesAt, new Date(boundary))).toBe(0);
  });

  it("fires in a different calendar slot than the one it was scheduled in", () => {
    const now = new Date("2026-10-24T21:30:00.000Z");
    const firesAt = addMilliseconds(now, millisecondsUntilNextBoundary({ now, timeZone: KYIV }));

    expect(isSameCalendarSlot({ left: now, right: firesAt, timeZone: KYIV })).toBe(false);
  });
});

describe("isSameCalendarSlot", () => {
  it("treats two instants in the same local day and part of day as one slot", () => {
    expect(
      isSameCalendarSlot({
        left: new Date("2026-11-24T03:00:00.000Z"),
        right: new Date("2026-11-24T09:59:00.000Z"),
        timeZone: KYIV,
      }),
    ).toBe(true);
  });

  it("separates the night before local midnight from the night after it", () => {
    expect(
      isSameCalendarSlot({
        left: new Date("2026-11-24T21:59:00.000Z"),
        right: new Date("2026-11-24T22:00:00.000Z"),
        timeZone: KYIV,
      }),
    ).toBe(false);
  });
});
