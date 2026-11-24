import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime, formatTimeInZone } from "@/lib/format";

const REFERENCE_INSTANT = new Date(2026, 6, 30, 12, 0, 0);

function localIso({
  days = 0,
  hours = 0,
  minutes = 0,
  months = 0,
  seconds = 0,
  years = 0,
}: {
  days?: number;
  hours?: number;
  minutes?: number;
  months?: number;
  seconds?: number;
  years?: number;
}): string {
  return new Date(
    REFERENCE_INSTANT.getFullYear() + years,
    REFERENCE_INSTANT.getMonth() + months,
    REFERENCE_INSTANT.getDate() + days,
    REFERENCE_INSTANT.getHours() + hours,
    REFERENCE_INSTANT.getMinutes() + minutes,
    REFERENCE_INSTANT.getSeconds() + seconds,
  ).toISOString();
}

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(REFERENCE_INSTANT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("picks seconds for the freshest instants", () => {
    expect(formatRelativeTime(localIso({ seconds: -45 }), "uk")).toBe("45 секунд тому");
  });

  it("picks minutes past a minute", () => {
    expect(formatRelativeTime(localIso({ minutes: -5 }), "uk")).toBe("5 хвилин тому");
  });

  it("picks hours past an hour", () => {
    expect(formatRelativeTime(localIso({ hours: -3 }), "uk")).toBe("3 години тому");
  });

  it("names the previous calendar day instead of counting hours", () => {
    expect(formatRelativeTime(localIso({ days: -1 }), "uk")).toBe("учора");
  });

  it("counts days up to a month", () => {
    expect(formatRelativeTime(localIso({ days: -10 }), "uk")).toBe("10 днів тому");
  });

  it("picks months past a month", () => {
    expect(formatRelativeTime(localIso({ months: -2 }), "uk")).toBe("2 місяці тому");
  });

  it("picks years past a year", () => {
    expect(formatRelativeTime(localIso({ years: -2 }), "uk")).toBe("2 роки тому");
  });

  it("formats future instants", () => {
    expect(formatRelativeTime(localIso({ days: 2 }), "uk")).toBe("післязавтра");
  });

  it("honours the locale argument", () => {
    expect(formatRelativeTime(localIso({ days: -1 }), "en")).toBe("yesterday");
  });

  it("names a date-only string for the current day as today instead of counting hours", () => {
    expect(formatRelativeTime("2026-07-30", "uk")).toBe("сьогодні");
  });

  it("counts calendar days back to a date-only string", () => {
    expect(formatRelativeTime("2026-07-27", "uk")).toBe("3 дні тому");
  });
});

describe("formatTimeInZone", () => {
  it.each([
    { expected: "9:05", timeZone: "Europe/Kyiv" },
    { expected: "7:05", timeZone: "UTC" },
  ])("shows the same instant as $expected on the $timeZone clock", ({ expected, timeZone }) => {
    const time = formatTimeInZone({ instant: "2026-11-24T07:05:00.000Z", locale: "uk", timeZone });

    expect(time).toBe(expected);
  });

  it.each([
    { expected: "15:30", locale: "uk" },
    { expected: "3:30 PM", locale: "en" },
  ])("writes an afternoon time as $expected in $locale", ({ expected, locale }) => {
    const time = formatTimeInZone({
      instant: "2026-11-24T13:30:00.000Z",
      locale,
      timeZone: "Europe/Kyiv",
    });

    expect(time).toBe(expected);
  });

  it("writes a morning time with AM in en", () => {
    const time = formatTimeInZone({
      instant: "2026-11-24T07:05:00.000Z",
      locale: "en",
      timeZone: "America/New_York",
    });

    expect(time).toBe("2:05 AM");
  });
});
