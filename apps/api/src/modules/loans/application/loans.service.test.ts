import type { LoansQuickCounts } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { LoansRepository } from "../infrastructure/loans.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { LoansService } from "./loans.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-09-24T15:30:00.000Z");
const TODAY = new Date("2026-09-24T00:00:00.000Z");
const SOON_END = new Date("2026-10-01T00:00:00.000Z");

const ZERO_QUICK_COUNTS: LoansQuickCounts = {
  all: 0,
  no_return_date: 0,
  overdue: 0,
  return_soon: 0,
};

function buildService(counts: LoansQuickCounts = ZERO_QUICK_COUNTS) {
  const repository = {
    countQuickFilters: vi.fn().mockResolvedValue(counts),
  };
  const service = new LoansService(
    fakeOf<LoansRepository>(repository),
    fakeOf<MediaService>({ buildViewOrNull: vi.fn().mockReturnValue(null) }),
  );
  return { repository, service };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LoansService.quickCounts", () => {
  it("returns the counts the repository produced", async () => {
    const counts: LoansQuickCounts = { all: 6, no_return_date: 2, overdue: 1, return_soon: 3 };
    const { service } = buildService(counts);

    const result = await service.quickCounts({ query: {}, userId: USER_ID });

    expect(result).toEqual(counts);
  });

  it("counts every chip over the direction, search and advanced filters of the query", async () => {
    const { repository, service } = buildService();

    await service.quickCounts({
      query: {
        contactId: CONTACT_ID,
        hasNote: true,
        reminder: "off",
        search: " dune ",
        type: "lent_to_someone",
      },
      userId: USER_ID,
    });

    const shared = {
      contactId: CONTACT_ID,
      hasNote: true,
      reminder: "off",
      search: "dune",
      type: "lent_to_someone",
      userId: USER_ID,
    };
    expect(repository.countQuickFilters).toHaveBeenCalledWith({
      filters: {
        all: expect.objectContaining({ ...shared, filter: "all" }),
        no_return_date: expect.objectContaining({ ...shared, filter: "no_return_date" }),
        overdue: expect.objectContaining({ ...shared, filter: "overdue" }),
        return_soon: expect.objectContaining({ ...shared, filter: "return_soon" }),
      },
    });
  });

  it("windows overdue and return soon from the start of the current UTC day", async () => {
    const { repository, service } = buildService();

    await service.quickCounts({ query: {}, userId: USER_ID });

    expect(repository.countQuickFilters).toHaveBeenCalledWith({
      filters: expect.objectContaining({
        overdue: expect.objectContaining({ soonEnd: SOON_END, today: TODAY }),
        return_soon: expect.objectContaining({ soonEnd: SOON_END, today: TODAY }),
      }),
    });
  });

  it("turns the loan and return date bounds into dates", async () => {
    const { repository, service } = buildService();

    await service.quickCounts({
      query: {
        expectedReturnDateFrom: "2026-09-01",
        expectedReturnDateTo: "2026-09-30",
        loanDateFrom: "2026-08-01",
        loanDateTo: "2026-08-31",
      },
      userId: USER_ID,
    });

    expect(repository.countQuickFilters).toHaveBeenCalledWith({
      filters: expect.objectContaining({
        all: expect.objectContaining({
          expectedReturnDateFrom: new Date("2026-09-01T00:00:00.000Z"),
          expectedReturnDateTo: new Date("2026-09-30T00:00:00.000Z"),
          loanDateFrom: new Date("2026-08-01T00:00:00.000Z"),
          loanDateTo: new Date("2026-08-31T00:00:00.000Z"),
        }),
      }),
    });
  });
});
