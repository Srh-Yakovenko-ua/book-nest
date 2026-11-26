import { describe, expect, it, vi } from "vitest";

import type { UserSettingsContextService } from "../../profile/index.js";
import type { ReadingGoalPlansService } from "../../reading-goals/index.js";
import type { ReadingWeekService } from "../../statistics/index.js";
import type { HomeActiveBooksService } from "./home-active-books.service.js";

import { fakeOf } from "../../../test/fake.js";
import { HomeReadingService } from "./home-reading.service.js";

type ReadingSources = {
  calendar: UserSettingsContextService["calendar"];
  listGoalPlans: ReadingGoalPlansService["listGoalPlans"];
  loadPage: HomeActiveBooksService["loadPage"];
  loadWeek: ReadingWeekService["loadWeek"];
};

type Resolved<TMethod extends (...args: never[]) => Promise<unknown>> = Awaited<
  ReturnType<TMethod>
>;

type WeekActivityDay = Resolved<ReadingWeekService["loadWeek"]>["days"][number];

const USER_ID = "11111111-1111-4111-8111-111111111111";

const SOURCE_FAILURE = "source unavailable";

const CALENDAR: Resolved<UserSettingsContextService["calendar"]> = {
  timeZone: "Europe/Kyiv",
  today: new Date("2026-11-24T00:00:00.000Z"),
  weekStartDay: "monday",
};

const WEEK_DATES = [
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
  "2026-11-27",
  "2026-11-28",
  "2026-11-29",
] as const;

const UNAVAILABLE_SECTION = { reason: "SOURCE_FAILED", status: "unavailable" } as const;

function availableSources(): ReadingSources {
  return {
    calendar: vi.fn<UserSettingsContextService["calendar"]>().mockResolvedValue(CALENDAR),
    listGoalPlans: vi
      .fn<ReadingGoalPlansService["listGoalPlans"]>()
      .mockResolvedValue(
        fakeOf<Resolved<ReadingGoalPlansService["listGoalPlans"]>>({ active: [], completed: [] }),
      ),
    loadPage: vi
      .fn<HomeActiveBooksService["loadPage"]>()
      .mockResolvedValue({ items: [], nextCursor: null, total: 0 }),
    loadWeek: vi.fn<ReadingWeekService["loadWeek"]>().mockResolvedValue({
      currentStreak: { availability: "unavailable", data: null },
      days: WEEK_DATES.map((date) => quietDay(date)),
      hasReadingHistory: true,
      periodReliable: true,
    }),
  };
}

function buildService(overrides: Partial<ReadingSources> = {}): HomeReadingService {
  const sources = { ...availableSources(), ...overrides };
  return new HomeReadingService(
    fakeOf<HomeActiveBooksService>({ loadPage: sources.loadPage }),
    fakeOf<ReadingGoalPlansService>({ listGoalPlans: sources.listGoalPlans }),
    fakeOf<ReadingWeekService>({ loadWeek: sources.loadWeek }),
    fakeOf<UserSettingsContextService>({ calendar: sources.calendar }),
  );
}

function quietDay(date: string): WeekActivityDay {
  return { booksCount: 0, date, historyQuality: "exact", pagesRead: 0 };
}

describe("HomeReadingService.getReading", () => {
  it("marks only the reading week unavailable when its source fails", async () => {
    const service = buildService({
      loadWeek: vi
        .fn<ReadingWeekService["loadWeek"]>()
        .mockRejectedValue(new Error(SOURCE_FAILURE)),
    });

    const view = await service.getReading(USER_ID);

    expect(view.readingWeek).toEqual(UNAVAILABLE_SECTION);
    expect(view.currentlyReading.status).toBe("available");
    expect(view.readingGoal.status).toBe("available");
  });

  it("marks only the currently reading row unavailable when its source fails", async () => {
    const service = buildService({
      loadPage: vi
        .fn<HomeActiveBooksService["loadPage"]>()
        .mockRejectedValue(new Error(SOURCE_FAILURE)),
    });

    const view = await service.getReading(USER_ID);

    expect(view.currentlyReading).toEqual(UNAVAILABLE_SECTION);
    expect(view.readingGoal.status).toBe("available");
    expect(view.readingWeek.status).toBe("available");
  });

  it("marks only the reading goal unavailable when its source fails", async () => {
    const service = buildService({
      listGoalPlans: vi
        .fn<ReadingGoalPlansService["listGoalPlans"]>()
        .mockRejectedValue(new Error(SOURCE_FAILURE)),
    });

    const view = await service.getReading(USER_ID);

    expect(view.readingGoal).toEqual(UNAVAILABLE_SECTION);
    expect(view.currentlyReading.status).toBe("available");
    expect(view.readingWeek.status).toBe("available");
  });

  it("rejects when every section source fails", async () => {
    const service = buildService({
      listGoalPlans: vi
        .fn<ReadingGoalPlansService["listGoalPlans"]>()
        .mockRejectedValue(new Error(SOURCE_FAILURE)),
      loadPage: vi
        .fn<HomeActiveBooksService["loadPage"]>()
        .mockRejectedValue(new Error(SOURCE_FAILURE)),
      loadWeek: vi
        .fn<ReadingWeekService["loadWeek"]>()
        .mockRejectedValue(new Error(SOURCE_FAILURE)),
    });

    await expect(service.getReading(USER_ID)).rejects.toThrow(SOURCE_FAILURE);
  });
});
