import type { Mock } from "vitest";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsContextService } from "../../profile/index.js";
import type { GenreOverviewAggregate } from "../domain/genres-overview.js";
import type { GenreStatsRepository } from "../infrastructure/genre-stats.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { GenresOverviewService } from "./genres-overview.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function buildService(): {
  calendar: Mock<UserSettingsContextService["calendar"]>;
  service: GenresOverviewService;
} {
  const calendar = vi.fn<UserSettingsContextService["calendar"]>().mockResolvedValue({
    timeZone: "Europe/Kyiv",
    today: new Date("2026-09-24T00:00:00.000Z"),
    weekStartDay: "monday",
  });
  const aggregateGenreOverview = vi
    .fn<GenreStatsRepository["aggregateGenreOverview"]>()
    .mockResolvedValue([fantasyLastReadOnJune26()]);
  const service = new GenresOverviewService(
    fakeOf<GenreStatsRepository>({ aggregateGenreOverview }),
    fakeOf<UserSettingsContextService>({ calendar }),
  );
  return { calendar, service };
}

function fantasyLastReadOnJune26(): GenreOverviewAggregate {
  return {
    booksCount: 3,
    firstAddedAt: new Date("2026-01-10T09:00:00.000Z"),
    key: "fantasy",
    label: "Fantasy",
    lastReadingActivityAt: new Date("2026-06-26T00:00:00.000Z"),
    latestUnratedFinishedAt: null,
    normalizedName: "fantasy",
    readCount: 1,
    startedBooksCount: 1,
    unratedFinishedCount: 0,
  };
}

describe("GenresOverviewService.overview reader calendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T21:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the profile calendar for the reader's day once", async () => {
    const { calendar, service } = buildService();

    await service.overview({ userId: USER_ID });

    expect(calendar).toHaveBeenCalledTimes(1);
    expect(calendar).toHaveBeenCalledWith({ now: expect.any(Date), userId: USER_ID });
  });

  it("counts dormancy from the reader's day, not the UTC day, so 90 days idle is dormant", async () => {
    const { service } = buildService();

    const overview = await service.overview({ userId: USER_ID });

    expect(overview.dormantGenres).toEqual([
      {
        booksCount: 3,
        key: "fantasy",
        label: "Fantasy",
        lastReadingActivityAt: "2026-06-26",
        readCount: 1,
      },
    ]);
  });
});
