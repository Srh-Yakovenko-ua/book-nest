import type {
  Nullable,
  ReadingStatisticsCalendarPage,
  ReadingStatisticsCalendarSection,
  WeekStartDay,
} from "@app/shared";
import type { Mock } from "vitest";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReadingHistoryProvenanceService } from "../../books/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";
import type {
  CalendarComposition,
  StatisticsCalendarComposer,
} from "./statistics-calendar.composer.js";

import { fakeOf } from "../../../test/fake.js";
import { ReadingCalendarPageService } from "./reading-calendar-page.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const CLOCK = {
  autumnInUtc: new Date("2026-10-22T09:00:00.000Z"),
  newYearsEveInUtc: new Date("2026-12-31T23:30:00.000Z"),
} as const;

const FUTURE_YEAR_REJECTION = {
  message: "A reading calendar year cannot be in the future",
  status: 400,
} as const;

type Harness = {
  compose: Mock<StatisticsCalendarComposer["compose"]>;
  ensure: Mock<ReadingHistoryProvenanceService["ensure"]>;
  section: ReadingStatisticsCalendarSection;
  service: ReadingCalendarPageService;
};

function buildHarness({
  earliestActivityDate = null,
  reliableFrom = "2020-01-01",
  timezone = "UTC",
  weekStartDay = "monday",
}: {
  earliestActivityDate?: Nullable<string>;
  reliableFrom?: string;
  timezone?: string;
  weekStartDay?: WeekStartDay;
} = {}): Harness {
  const section = fakeOf<ReadingStatisticsCalendarSection>({ activeDays: 7 });
  const compose = vi
    .fn<StatisticsCalendarComposer["compose"]>()
    .mockResolvedValue(fakeOf<CalendarComposition>({ section }));
  const ensure = vi.fn<ReadingHistoryProvenanceService["ensure"]>().mockResolvedValue({
    activityReliableFrom: reliableFrom,
    cycleHistoryCutoverAt: new Date("2020-01-01T00:00:00.000Z"),
  });
  const findEarliestActivityDate = vi
    .fn<StatisticsActivityRepository["findEarliestActivityDate"]>()
    .mockResolvedValue(earliestActivityDate);
  const resolve = vi
    .fn<UserSettingsContextService["resolve"]>()
    .mockResolvedValue({ timezone, weekStartDay });

  const service = new ReadingCalendarPageService(
    fakeOf<StatisticsActivityRepository>({ findEarliestActivityDate }),
    fakeOf<StatisticsCalendarComposer>({ compose }),
    fakeOf<ReadingHistoryProvenanceService>({ ensure }),
    fakeOf<UserSettingsContextService>({ resolve }),
  );

  return { compose, ensure, section, service };
}

function requestYear(
  service: ReadingCalendarPageService,
  year: number,
): Promise<ReadingStatisticsCalendarPage> {
  return service.getCalendarPage({ query: { year }, userId: USER_ID });
}

beforeEach(() => {
  vi.useFakeTimers({ now: CLOCK.autumnInUtc, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReadingCalendarPageService.getCalendarPage", () => {
  describe("year bounds", () => {
    it("rejects a year after the current one with a 400 saying it cannot be in the future", async () => {
      const { service } = buildHarness();

      await expect(requestYear(service, 2027)).rejects.toMatchObject(FUTURE_YEAR_REJECTION);
    });

    it("rejects a future year before reading history provenance is ensured", async () => {
      const { ensure, service } = buildHarness();

      await expect(requestYear(service, 2027)).rejects.toMatchObject(FUTURE_YEAR_REJECTION);
      expect(ensure).not.toHaveBeenCalled();
    });

    it("rejects the next UTC year for a UTC reader on New Year's Eve", async () => {
      vi.setSystemTime(CLOCK.newYearsEveInUtc);
      const { service } = buildHarness({ timezone: "UTC" });

      await expect(requestYear(service, 2027)).rejects.toMatchObject(FUTURE_YEAR_REJECTION);
    });

    it("accepts the next UTC year once the reader's own zone has reached it", async () => {
      vi.setSystemTime(CLOCK.newYearsEveInUtc);
      const { compose, service } = buildHarness({ timezone: "Europe/Kyiv" });

      await requestYear(service, 2027);

      expect(compose).toHaveBeenCalledWith(
        expect.objectContaining({ period: { from: "2027-01-01", to: "2027-01-01" } }),
      );
    });

    it("reports today as the local date in the reader's zone", async () => {
      vi.setSystemTime(CLOCK.newYearsEveInUtc);
      const { service } = buildHarness({ timezone: "Europe/Kyiv" });

      const page = await requestYear(service, 2027);

      expect(page.today).toBe("2027-01-01");
    });
  });

  describe("calendar period", () => {
    it("composes a past year from January 1 to December 31", async () => {
      const { compose, service } = buildHarness({ reliableFrom: "2023-05-01" });

      await requestYear(service, 2024);

      expect(compose).toHaveBeenCalledWith({
        period: { from: "2024-01-01", to: "2024-12-31" },
        reliableFrom: "2023-05-01",
        today: "2026-10-22",
        userId: USER_ID,
      });
    });

    it("composes the current year from January 1 to today", async () => {
      const { compose, service } = buildHarness();

      await requestYear(service, 2026);

      expect(compose).toHaveBeenCalledWith(
        expect.objectContaining({ period: { from: "2026-01-01", to: "2026-10-22" } }),
      );
    });

    it("returns the composer's calendar section unchanged", async () => {
      const { section, service } = buildHarness();

      const page = await requestYear(service, 2024);

      expect(page.calendar).toBe(section);
    });
  });

  describe("available years", () => {
    it("offers only the current year when there is no reading progress", async () => {
      const { service } = buildHarness({ earliestActivityDate: null });

      const page = await requestYear(service, 2026);

      expect(page.availableYears).toEqual([2026]);
    });

    it("offers every year from the earliest progress to the current year in ascending order", async () => {
      const { service } = buildHarness({ earliestActivityDate: "2023-07-15" });

      const page = await requestYear(service, 2026);

      expect(page.availableYears).toEqual([2023, 2024, 2025, 2026]);
    });

    it("starts at 1900 when the earliest progress predates it", async () => {
      const { service } = buildHarness({ earliestActivityDate: "1850-05-01" });

      const page = await requestYear(service, 2026);

      expect({
        count: page.availableYears.length,
        first: page.availableYears[0],
        last: page.availableYears.at(-1),
      }).toEqual({ count: 127, first: 1900, last: 2026 });
    });
  });

  describe("meta", () => {
    it("marks the year exact when reliable history starts on its January 1", async () => {
      const { service } = buildHarness({ reliableFrom: "2024-01-01" });

      const page = await requestYear(service, 2024);

      expect(page.meta.activityHistory).toEqual({
        reliableFrom: "2024-01-01",
        selectedPeriodQuality: "exact",
      });
    });

    it("marks the year a legacy lower bound when reliable history starts after its January 1", async () => {
      const { service } = buildHarness({ reliableFrom: "2024-03-01" });

      const page = await requestYear(service, 2024);

      expect(page.meta.activityHistory).toEqual({
        reason: "LEGACY_EVENTS_MAY_HAVE_BEEN_DELETED",
        reliableFrom: "2024-03-01",
        selectedPeriodQuality: "legacy_lower_bound",
      });
    });

    it("carries the reader's time zone and week start", async () => {
      const { service } = buildHarness({ timezone: "Europe/Kyiv", weekStartDay: "sunday" });

      const page = await requestYear(service, 2024);

      expect(page.meta).toMatchObject({ timezone: "Europe/Kyiv", weekStartDay: "sunday" });
    });

    it("echoes the requested year", async () => {
      const { service } = buildHarness();

      const page = await requestYear(service, 2024);

      expect(page.year).toBe(2024);
    });
  });
});
