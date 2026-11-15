import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserProfileSettingsModel } from "../../../generated/prisma/models.js";

import { fakeOf } from "../../../test/fake.js";
import { SettingsRepository } from "../infrastructure/settings.repository.js";
import { UserSettingsContextService } from "./user-settings-context.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const LATE_EVENING_IN_KYIV = new Date("2026-09-02T21:30:00.000Z");

function buildService(timezone: null | string): UserSettingsContextService {
  return new UserSettingsContextService(
    fakeOf<SettingsRepository>({
      findByUserId: vi
        .fn()
        .mockResolvedValue(
          timezone === null
            ? null
            : fakeOf<UserProfileSettingsModel>({ timezone, weekStartDay: "sunday" }),
        ),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(LATE_EVENING_IN_KYIV);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("UserSettingsContextService.today", () => {
  it("gives a reader ahead of UTC the date their own clock shows", async () => {
    await expect(buildService("Europe/Kyiv").today(USER_ID)).resolves.toBe("2026-09-03");
  });

  it("gives a reader behind UTC the date their own clock shows", async () => {
    await expect(buildService("America/New_York").today(USER_ID)).resolves.toBe("2026-09-02");
  });

  it("falls back to the product default when the reader has no settings row", async () => {
    await expect(buildService(null).today(USER_ID)).resolves.toBe("2026-09-03");
  });
});

describe("UserSettingsContextService.calendarDay", () => {
  const NIGHT_IN_KYIV_EVENING_IN_NEW_YORK = new Date("2026-11-15T22:30:00.000Z");

  it("returns the UTC midnight of the day a reader ahead of UTC is living in", async () => {
    const day = await buildService("Europe/Kyiv").calendarDay({
      now: NIGHT_IN_KYIV_EVENING_IN_NEW_YORK,
      userId: USER_ID,
    });

    expect(day.toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });

  it("returns the UTC midnight of the day a reader behind UTC is living in", async () => {
    const day = await buildService("America/New_York").calendarDay({
      now: NIGHT_IN_KYIV_EVENING_IN_NEW_YORK,
      userId: USER_ID,
    });

    expect(day.toISOString()).toBe("2026-11-15T00:00:00.000Z");
  });

  it("uses the product default zone when the reader has no settings row", async () => {
    const day = await buildService(null).calendarDay({
      now: NIGHT_IN_KYIV_EVENING_IN_NEW_YORK,
      userId: USER_ID,
    });

    expect(day.toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
});

describe("UserSettingsContextService.calendar", () => {
  const NIGHT_IN_KYIV_EVENING_IN_NEW_YORK = new Date("2026-11-15T22:30:00.000Z");

  it("returns the reader's zone with the UTC midnight of the day they are living in", async () => {
    await expect(
      buildService("Europe/Kyiv").calendar({
        now: NIGHT_IN_KYIV_EVENING_IN_NEW_YORK,
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      timeZone: "Europe/Kyiv",
      today: new Date("2026-11-16T00:00:00.000Z"),
    });
  });

  it("takes the zone from the reader's settings row rather than the product default", async () => {
    await expect(
      buildService("America/New_York").calendar({
        now: NIGHT_IN_KYIV_EVENING_IN_NEW_YORK,
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      timeZone: "America/New_York",
      today: new Date("2026-11-15T00:00:00.000Z"),
    });
  });

  it("uses the product default zone when the reader has no settings row", async () => {
    await expect(
      buildService(null).calendar({
        now: NIGHT_IN_KYIV_EVENING_IN_NEW_YORK,
        userId: USER_ID,
      }),
    ).resolves.toEqual({
      timeZone: "Europe/Kyiv",
      today: new Date("2026-11-16T00:00:00.000Z"),
    });
  });
});

describe("UserSettingsContextService.resolve", () => {
  it("returns the reader's own timezone and week start", async () => {
    await expect(buildService("America/New_York").resolve(USER_ID)).resolves.toEqual({
      timezone: "America/New_York",
      weekStartDay: "sunday",
    });
  });

  it("falls back to the product defaults when the reader has no settings row", async () => {
    await expect(buildService(null).resolve(USER_ID)).resolves.toEqual({
      timezone: "Europe/Kyiv",
      weekStartDay: "monday",
    });
  });
});
