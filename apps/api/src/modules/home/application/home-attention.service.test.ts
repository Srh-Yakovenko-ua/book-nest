import { describe, expect, it, vi } from "vitest";

import type { DeliveryReadService } from "../../delivery/index.js";
import type { LoansService } from "../../loans/index.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type { ReadingGoalPlansService } from "../../reading-goals/index.js";
import type { SeriesOrderCheckService } from "../../series-order-check/index.js";
import type { HomeAttentionRepository } from "../infrastructure/home-attention.repository.js";
import type { HomeActiveBooksService } from "./home-active-books.service.js";

import { fakeOf } from "../../../test/fake.js";
import { HomeAttentionService } from "./home-attention.service.js";

type AttentionSources = {
  calendar: UserSettingsContextService["calendar"];
  findBorrowedLoanDueBookIds: HomeAttentionRepository["findBorrowedLoanDueBookIds"];
  findQueueDeadlines: HomeAttentionRepository["findQueueDeadlines"];
  inTransitSummary: DeliveryReadService["inTransitSummary"];
  listActiveBooks: HomeActiveBooksService["listActiveBooks"];
  listGoalPlans: ReadingGoalPlansService["listGoalPlans"];
  listIssues: SeriesOrderCheckService["listIssues"];
  readyForPickupNotExpiring: DeliveryReadService["readyForPickupNotExpiring"];
  summary: LoansService["summary"];
};

type LoanDirection = Resolved<LoansService["summary"]>["borrowed"];

type Resolved<TMethod extends (...args: never[]) => Promise<unknown>> = Awaited<
  ReturnType<TMethod>
>;

const USER_ID = "11111111-1111-4111-8111-111111111111";

const STALE_BOOK_ID = "44444444-4444-4444-8444-444444444444";

const SOURCE_FAILURE = "source unavailable";

const CALENDAR: Resolved<UserSettingsContextService["calendar"]> = {
  timeZone: "Europe/Kyiv",
  today: new Date("2026-11-24T00:00:00.000Z"),
  weekStartDay: "monday",
};

function availableSources(): AttentionSources {
  return {
    calendar: vi.fn<UserSettingsContextService["calendar"]>().mockResolvedValue(CALENDAR),
    findBorrowedLoanDueBookIds: vi
      .fn<HomeAttentionRepository["findBorrowedLoanDueBookIds"]>()
      .mockResolvedValue([]),
    findQueueDeadlines: vi
      .fn<HomeAttentionRepository["findQueueDeadlines"]>()
      .mockResolvedValue([]),
    inTransitSummary: vi
      .fn<DeliveryReadService["inTransitSummary"]>()
      .mockResolvedValue(
        fakeOf<Resolved<DeliveryReadService["inTransitSummary"]>>({ attention: [] }),
      ),
    listActiveBooks: vi.fn<HomeActiveBooksService["listActiveBooks"]>().mockResolvedValue([
      {
        id: STALE_BOOK_ID,
        key: "2026-11-16",
        lastProgressAt: "2026-11-16",
        title: "Stalled",
      },
    ]),
    listGoalPlans: vi
      .fn<ReadingGoalPlansService["listGoalPlans"]>()
      .mockResolvedValue(
        fakeOf<Resolved<ReadingGoalPlansService["listGoalPlans"]>>({ active: [], completed: [] }),
      ),
    listIssues: vi
      .fn<SeriesOrderCheckService["listIssues"]>()
      .mockResolvedValue(fakeOf<Resolved<SeriesOrderCheckService["listIssues"]>>({ items: [] })),
    readyForPickupNotExpiring: vi
      .fn<DeliveryReadService["readyForPickupNotExpiring"]>()
      .mockResolvedValue(
        fakeOf<Resolved<DeliveryReadService["readyForPickupNotExpiring"]>>({
          count: 0,
          nearestPickupUntil: null,
        }),
      ),
    summary: vi
      .fn<LoansService["summary"]>()
      .mockResolvedValue(
        fakeOf<Resolved<LoansService["summary"]>>({ borrowed: quietLoans(), lent: quietLoans() }),
      ),
  };
}

function buildService(overrides: Partial<AttentionSources> = {}): HomeAttentionService {
  const sources = { ...availableSources(), ...overrides };
  return new HomeAttentionService(
    fakeOf<HomeActiveBooksService>({ listActiveBooks: sources.listActiveBooks }),
    fakeOf<HomeAttentionRepository>({
      findBorrowedLoanDueBookIds: sources.findBorrowedLoanDueBookIds,
      findQueueDeadlines: sources.findQueueDeadlines,
    }),
    fakeOf<DeliveryReadService>({
      inTransitSummary: sources.inTransitSummary,
      readyForPickupNotExpiring: sources.readyForPickupNotExpiring,
    }),
    fakeOf<LoansService>({ summary: sources.summary }),
    fakeOf<ReadingGoalPlansService>({ listGoalPlans: sources.listGoalPlans }),
    fakeOf<SeriesOrderCheckService>({ listIssues: sources.listIssues }),
    fakeOf<UserSettingsContextService>({ calendar: sources.calendar }),
  );
}

function failingSource(): Promise<never> {
  return Promise.reject(new Error(SOURCE_FAILURE));
}

function quietLoans(): LoanDirection {
  return fakeOf<LoanDirection>({
    nearestReturnDate: null,
    oldestOverdueReturnDate: null,
    overdueCount: 0,
    returningSoonCount: 0,
  });
}

describe("HomeAttentionService.getAttention", () => {
  it("lists a failing source as unavailable while the other sources still raise groups", async () => {
    const service = buildService({ summary: failingSource });

    const view = await service.getAttention(USER_ID);

    expect(view.unavailableSources).toEqual(["loans"]);
    expect(view.groups).toEqual([
      expect.objectContaining({ bookId: STALE_BOOK_ID, reason: "reading_stale", severity: "low" }),
    ]);
  });

  it("rejects when every attention source fails", async () => {
    const service = buildService({
      findQueueDeadlines: failingSource,
      inTransitSummary: failingSource,
      listActiveBooks: failingSource,
      listGoalPlans: failingSource,
      listIssues: failingSource,
      summary: failingSource,
    });

    await expect(service.getAttention(USER_ID)).rejects.toThrow(SOURCE_FAILURE);
  });
});
