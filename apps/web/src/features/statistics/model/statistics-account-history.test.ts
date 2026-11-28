import type { ReadingStatisticsMeta } from "@app/shared";

import { describe, expect, it } from "vitest";

import {
  accountCreatedDay,
  isBeforeAccountStart,
  isConfirmedNewAccount,
  newAccountStart,
  withNewAccountHistory,
} from "./statistics-account-history";
import { calendarDayFixture, calendarFixture, overviewFixture } from "./statistics.fixtures";

const LATE_EVENING_UTC = "2026-03-14T22:30:00.000Z";

function metaFixture({
  reliableFrom,
  timezone,
}: {
  reliableFrom: string;
  timezone: string;
}): ReadingStatisticsMeta {
  const meta = overviewFixture().meta;
  return {
    ...meta,
    activityHistory: { ...meta.activityHistory, reliableFrom },
    timezone,
  };
}

describe("accountCreatedDay", () => {
  it.each([
    ["Europe/Kyiv", "2026-03-15"],
    ["UTC", "2026-03-14"],
    ["America/New_York", "2026-03-14"],
  ])("reads the creation instant as a calendar day in %s", (timeZone, expected) => {
    expect(accountCreatedDay({ timeZone, user: { createdAt: LATE_EVENING_UTC } })).toBe(expected);
  });

  it("has no day without a user", () => {
    expect(accountCreatedDay({ timeZone: "Europe/Kyiv", user: null })).toBeNull();
  });

  it("has no day for a creation date that does not parse", () => {
    expect(
      accountCreatedDay({ timeZone: "Europe/Kyiv", user: { createdAt: "not-a-date" } }),
    ).toBeNull();
  });
});

describe("isConfirmedNewAccount", () => {
  it.each([
    ["the creation day", true, "2026-02-28"],
    ["the day after creation", true, "2026-03-01"],
    ["two days after creation", false, "2026-03-02"],
    ["a day before creation", true, "2026-02-27"],
  ])("treats reliableFrom on %s as confirmed: %s", (_label, expected, reliableFrom) => {
    expect(isConfirmedNewAccount({ accountCreatedDay: "2026-02-28", reliableFrom })).toBe(expected);
  });

  it("does not confirm an account without a creation day", () => {
    expect(isConfirmedNewAccount({ accountCreatedDay: null, reliableFrom: "2026-02-28" })).toBe(
      false,
    );
  });
});

describe("newAccountStart", () => {
  it("starts on the creation day in the profile timezone when reliableFrom is within a day of it", () => {
    expect(
      newAccountStart({
        meta: metaFixture({ reliableFrom: "2026-03-16", timezone: "Europe/Kyiv" }),
        user: { createdAt: LATE_EVENING_UTC },
      }),
    ).toBe("2026-03-15");
  });

  it("has no start when reliableFrom is two days after the creation day", () => {
    expect(
      newAccountStart({
        meta: metaFixture({ reliableFrom: "2026-03-17", timezone: "Europe/Kyiv" }),
        user: { createdAt: LATE_EVENING_UTC },
      }),
    ).toBeNull();
  });

  it.each([
    ["no user", null],
    ["an unparsable creation date", { createdAt: "not-a-date" }],
  ])("has no start with %s", (_label, user) => {
    expect(
      newAccountStart({
        meta: metaFixture({ reliableFrom: "2026-03-15", timezone: "Europe/Kyiv" }),
        user,
      }),
    ).toBeNull();
  });
});

describe("isBeforeAccountStart", () => {
  it.each([
    ["2026-03-14", true],
    ["2026-03-15", false],
    ["2026-03-16", false],
  ])("places %s before a 2026-03-15 start: %s", (date, expected) => {
    expect(isBeforeAccountStart({ accountStart: "2026-03-15", date })).toBe(expected);
  });

  it("places nothing before a missing start", () => {
    expect(isBeforeAccountStart({ accountStart: null, date: "1999-01-01" })).toBe(false);
  });
});

describe("withNewAccountHistory", () => {
  const legacyCalendar = calendarFixture({
    activeDays: 1,
    days: [
      calendarDayFixture({ date: "2026-03-02", historyQuality: "legacy_observed_only" }),
      calendarDayFixture({ date: "2026-03-03", historyQuality: "legacy_observed_only" }),
    ],
  });

  it("returns the calendar untouched without an account start", () => {
    expect(withNewAccountHistory({ accountStart: null, calendar: legacyCalendar })).toBe(
      legacyCalendar,
    );
  });

  it("marks every day exact for a confirmed new account and keeps the rest of the calendar", () => {
    const calendar = withNewAccountHistory({
      accountStart: "2026-03-15",
      calendar: legacyCalendar,
    });

    expect(calendar.days.map((day) => day.historyQuality)).toEqual(["exact", "exact"]);
    expect(calendar.days.map((day) => day.date)).toEqual(["2026-03-02", "2026-03-03"]);
    expect(calendar.activeDays).toBe(1);
  });
});
