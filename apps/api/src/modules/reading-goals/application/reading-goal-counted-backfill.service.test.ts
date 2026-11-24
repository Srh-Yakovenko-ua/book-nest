import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ReadingGoalActivityModel,
  ReadingGoalBookModel,
} from "../../../generated/prisma/models.js";
import type { ReadingGoalCountedOrdinalReplay } from "../domain/reading-goal-counted-replay.js";
import type { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import type { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import type {
  ReadingGoalCountedBackfillCandidate,
  ReadingGoalsRepository,
} from "../infrastructure/reading-goals.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { fakeOf } from "../../../test/fake.js";
import { ReadingGoalCountedBackfillService } from "./reading-goal-counted-backfill.service.js";

const BACKFILL = {
  deadline: "2026-09-01",
  goalCreatedAt: "2026-08-01T10:00:00.000Z",
  now: new Date("2026-08-20T12:00:00.000Z"),
  targetCount: 5,
  timeZone: "UTC",
  userId: "11111111-1111-4111-8111-111111111111",
} as const;

const BOOK_ID = {
  alpha: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  beta: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  gamma: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
} as const;

const GOAL_ID = {
  recounted: "90000000-0000-4000-8000-000000000002",
  sameDay: "90000000-0000-4000-8000-000000000001",
  stale: "90000000-0000-4000-8000-000000000003",
  tripled: "90000000-0000-4000-8000-000000000004",
} as const;

type HistoryEvent =
  | {
      at: string;
      bookId: string;
      completedCount: number;
      finishedAt: string;
      id: string;
      type: "book_counted";
    }
  | { at: string; bookId: string; id: string; previousFinishedAt: string; type: "book_uncounted" }
  | { at: string; id: string; type: "goal_created" };

type Scenario = {
  events: HistoryEvent[];
  goal: ReadingGoalCountedBackfillCandidate;
  snapshot: ReadingGoalBookModel[];
};

type StoredEvent = HistoryEvent & { goalId: string };

type TransactionRecord = {
  rewrites: string[];
  status: "committed" | "open" | "rolled_back";
};

function activityId(scenario: number, sequence: number): string {
  return `${String(scenario).padStart(8, "0")}-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function buildBackfill({
  changedByAnotherWriter = new Set<string>(),
  scenarios,
}: {
  changedByAnotherWriter?: ReadonlySet<string>;
  scenarios: Scenario[];
}) {
  const history = new Map<string, StoredEvent>(
    scenarios.flatMap(({ events, goal }) =>
      events.map((event): [string, StoredEvent] => [event.id, { ...event, goalId: goal.id }]),
    ),
  );
  const transactions: TransactionRecord[] = [];
  const openTransactions = new Map<Prisma.TransactionClient, TransactionRecord>();

  const rewrite = vi.fn(
    (
      { activityId: id, completedCount, recordedCompletedCount }: ReadingGoalCountedOrdinalReplay,
      client?: Prisma.TransactionClient,
    ): Promise<number> => {
      if (client !== undefined) {
        openTransactions.get(client)?.rewrites.push(id);
      }
      const stored = history.get(id);
      if (
        stored?.type !== "book_counted" ||
        stored.completedCount !== recordedCompletedCount ||
        changedByAnotherWriter.has(id)
      ) {
        return Promise.resolve(0);
      }
      history.set(id, { ...stored, completedCount });
      return Promise.resolve(1);
    },
  );

  const activityRepository = fakeOf<ReadingGoalActivityRepository>({
    findAllForGoal: ({ goalId }) =>
      Promise.resolve(
        [...history.values()].filter((event) => event.goalId === goalId).map(toActivityRow),
      ),
    rewriteBookCountedOrdinal: rewrite,
  });
  const booksRepository = fakeOf<ReadingGoalBooksRepository>({
    findByGoal: ({ goalId }) =>
      Promise.resolve(scenarios.find((scenario) => scenario.goal.id === goalId)?.snapshot ?? []),
  });
  const goalsRepository = fakeOf<ReadingGoalsRepository>({
    findCountedBackfillCandidates: ({ afterId }) =>
      Promise.resolve(afterId === null ? scenarios.map((scenario) => scenario.goal) : []),
  });
  const transactionRunner = fakeOf<TransactionRunner>({
    run: async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
      const tx = fakeOf<Prisma.TransactionClient>({});
      const record: TransactionRecord = { rewrites: [], status: "open" };
      const committedHistory = new Map(history);
      transactions.push(record);
      openTransactions.set(tx, record);
      try {
        const result = await work(tx);
        record.status = "committed";
        return result;
      } catch (error) {
        record.status = "rolled_back";
        history.clear();
        for (const [id, event] of committedHistory) {
          history.set(id, event);
        }
        throw error;
      }
    },
  });

  return {
    rewrite,
    service: new ReadingGoalCountedBackfillService(
      activityRepository,
      booksRepository,
      goalsRepository,
      transactionRunner,
    ),
    storedOrdinals: (goalId: string): number[] =>
      [...history.values()].flatMap((event) =>
        event.goalId === goalId && event.type === "book_counted" ? [event.completedCount] : [],
      ),
    transactions,
  };
}

function candidate(id: string): ReadingGoalCountedBackfillCandidate {
  return {
    archivedAt: null,
    createdAt: new Date(BACKFILL.goalCreatedAt),
    deadline: parseIsoDate(BACKFILL.deadline),
    id,
    targetCount: BACKFILL.targetCount,
    timezone: BACKFILL.timeZone,
    userId: BACKFILL.userId,
  };
}

function recountedScenario(): Scenario {
  return {
    events: [
      { at: BACKFILL.goalCreatedAt, id: activityId(2, 1), type: "goal_created" },
      {
        at: "2026-08-05T09:00:00.000Z",
        bookId: BOOK_ID.alpha,
        completedCount: 1,
        finishedAt: "2026-08-05",
        id: activityId(2, 2),
        type: "book_counted",
      },
      {
        at: "2026-08-07T09:00:00.000Z",
        bookId: BOOK_ID.beta,
        completedCount: 2,
        finishedAt: "2026-08-07",
        id: activityId(2, 3),
        type: "book_counted",
      },
      {
        at: "2026-08-08T09:00:00.000Z",
        bookId: BOOK_ID.alpha,
        id: activityId(2, 4),
        previousFinishedAt: "2026-08-05",
        type: "book_uncounted",
      },
      {
        at: "2026-08-09T09:00:00.000Z",
        bookId: BOOK_ID.alpha,
        completedCount: 1,
        finishedAt: "2026-08-05",
        id: activityId(2, 5),
        type: "book_counted",
      },
    ],
    goal: candidate(GOAL_ID.recounted),
    snapshot: [
      snapshotBook({ bookId: BOOK_ID.alpha, goalId: GOAL_ID.recounted, qualifiedOn: "2026-08-05" }),
      snapshotBook({ bookId: BOOK_ID.beta, goalId: GOAL_ID.recounted, qualifiedOn: "2026-08-07" }),
    ],
  };
}

function sameDayScenario(): Scenario {
  return {
    events: [
      { at: BACKFILL.goalCreatedAt, id: activityId(1, 1), type: "goal_created" },
      {
        at: "2026-08-10T09:00:00.000Z",
        bookId: BOOK_ID.beta,
        completedCount: 1,
        finishedAt: "2026-08-10",
        id: activityId(1, 2),
        type: "book_counted",
      },
      {
        at: "2026-08-11T09:00:00.000Z",
        bookId: BOOK_ID.alpha,
        completedCount: 1,
        finishedAt: "2026-08-10",
        id: activityId(1, 3),
        type: "book_counted",
      },
    ],
    goal: candidate(GOAL_ID.sameDay),
    snapshot: [
      snapshotBook({ bookId: BOOK_ID.alpha, goalId: GOAL_ID.sameDay, qualifiedOn: "2026-08-10" }),
      snapshotBook({ bookId: BOOK_ID.beta, goalId: GOAL_ID.sameDay, qualifiedOn: "2026-08-10" }),
    ],
  };
}

function snapshotBook({
  bookId,
  goalId,
  qualifiedOn,
}: {
  bookId: string;
  goalId: string;
  qualifiedOn: Nullable<string>;
}): ReadingGoalBookModel {
  return {
    bookId,
    createdAt: new Date(BACKFILL.goalCreatedAt),
    goalId,
    position: 0,
    qualifiedFinishedAt: qualifiedOn === null ? null : parseIsoDate(qualifiedOn),
    qualifiedReadingCycleId: null,
    updatedAt: new Date(BACKFILL.goalCreatedAt),
  };
}

function staleScenario(): Scenario {
  return {
    events: [
      { at: BACKFILL.goalCreatedAt, id: activityId(3, 1), type: "goal_created" },
      {
        at: "2026-08-05T09:00:00.000Z",
        bookId: BOOK_ID.alpha,
        completedCount: 1,
        finishedAt: "2026-08-05",
        id: activityId(3, 2),
        type: "book_counted",
      },
      {
        at: "2026-08-07T09:00:00.000Z",
        bookId: BOOK_ID.beta,
        completedCount: 1,
        finishedAt: "2026-08-07",
        id: activityId(3, 3),
        type: "book_counted",
      },
    ],
    goal: candidate(GOAL_ID.stale),
    snapshot: [
      snapshotBook({ bookId: BOOK_ID.alpha, goalId: GOAL_ID.stale, qualifiedOn: "2026-08-05" }),
      snapshotBook({ bookId: BOOK_ID.beta, goalId: GOAL_ID.stale, qualifiedOn: null }),
    ],
  };
}

function toActivityRow(event: StoredEvent): ReadingGoalActivityModel {
  const base = {
    createdAt: new Date(event.at),
    goalId: event.goalId,
    id: event.id,
    userId: BACKFILL.userId,
  };
  switch (event.type) {
    case "book_counted":
      return {
        ...base,
        bookId: event.bookId,
        metadata: {
          completedCount: event.completedCount,
          finishedAt: event.finishedAt,
          targetCount: BACKFILL.targetCount,
        },
        type: event.type,
      };
    case "book_uncounted":
      return {
        ...base,
        bookId: event.bookId,
        metadata: { previousFinishedAt: event.previousFinishedAt, reason: "finished_date_removed" },
        type: event.type,
      };
    case "goal_created":
      return {
        ...base,
        bookId: null,
        metadata: { deadline: BACKFILL.deadline, targetCount: BACKFILL.targetCount },
        type: event.type,
      };
    default:
      return assertNever(event);
  }
}

function tripledScenario(): Scenario {
  return {
    events: [
      { at: BACKFILL.goalCreatedAt, id: activityId(4, 1), type: "goal_created" },
      {
        at: "2026-08-10T09:00:00.000Z",
        bookId: BOOK_ID.gamma,
        completedCount: 1,
        finishedAt: "2026-08-10",
        id: activityId(4, 2),
        type: "book_counted",
      },
      {
        at: "2026-08-11T09:00:00.000Z",
        bookId: BOOK_ID.beta,
        completedCount: 1,
        finishedAt: "2026-08-10",
        id: activityId(4, 3),
        type: "book_counted",
      },
      {
        at: "2026-08-12T09:00:00.000Z",
        bookId: BOOK_ID.alpha,
        completedCount: 1,
        finishedAt: "2026-08-10",
        id: activityId(4, 4),
        type: "book_counted",
      },
    ],
    goal: candidate(GOAL_ID.tripled),
    snapshot: [
      snapshotBook({ bookId: BOOK_ID.alpha, goalId: GOAL_ID.tripled, qualifiedOn: "2026-08-10" }),
      snapshotBook({ bookId: BOOK_ID.beta, goalId: GOAL_ID.tripled, qualifiedOn: "2026-08-10" }),
      snapshotBook({ bookId: BOOK_ID.gamma, goalId: GOAL_ID.tripled, qualifiedOn: "2026-08-10" }),
    ],
  };
}

describe("ReadingGoalCountedBackfillService.run in a dry run", () => {
  it("plans the count each book_counted event should carry in recording order", async () => {
    const { service } = buildBackfill({ scenarios: [sameDayScenario(), recountedScenario()] });

    expect(await service.run({ mode: "dry_run", now: BACKFILL.now })).toEqual([
      {
        changes: [{ activityId: activityId(1, 3), completedCount: 2, recordedCompletedCount: 1 }],
        goalId: GOAL_ID.sameDay,
        status: "planned",
      },
      {
        changes: [{ activityId: activityId(2, 5), completedCount: 2, recordedCompletedCount: 1 }],
        goalId: GOAL_ID.recounted,
        status: "planned",
      },
    ]);
  });

  it("writes nothing and opens no transaction", async () => {
    const backfill = buildBackfill({ scenarios: [sameDayScenario(), recountedScenario()] });

    await backfill.service.run({ mode: "dry_run", now: BACKFILL.now });

    expect({
      recounted: backfill.storedOrdinals(GOAL_ID.recounted),
      rewriteCalls: backfill.rewrite.mock.calls.length,
      sameDay: backfill.storedOrdinals(GOAL_ID.sameDay),
      transactions: backfill.transactions,
    }).toEqual({ recounted: [1, 2, 1], rewriteCalls: 0, sameDay: [1, 1], transactions: [] });
  });
});

describe("ReadingGoalCountedBackfillService.run when applied", () => {
  it("rewrites each book_counted event to the count right after it in recording order", async () => {
    const backfill = buildBackfill({
      scenarios: [sameDayScenario(), recountedScenario(), tripledScenario()],
    });

    await backfill.service.run({ mode: "apply", now: BACKFILL.now });

    expect({
      recounted: backfill.storedOrdinals(GOAL_ID.recounted),
      sameDay: backfill.storedOrdinals(GOAL_ID.sameDay),
      tripled: backfill.storedOrdinals(GOAL_ID.tripled),
    }).toEqual({ recounted: [1, 2, 2], sameDay: [1, 2], tripled: [1, 2, 3] });
  });

  it("reports each corrected goal as applied with the changes it wrote", async () => {
    const { service } = buildBackfill({ scenarios: [sameDayScenario(), tripledScenario()] });

    expect(await service.run({ mode: "apply", now: BACKFILL.now })).toEqual([
      {
        changes: [{ activityId: activityId(1, 3), completedCount: 2, recordedCompletedCount: 1 }],
        goalId: GOAL_ID.sameDay,
        status: "applied",
      },
      {
        changes: [
          { activityId: activityId(4, 3), completedCount: 2, recordedCompletedCount: 1 },
          { activityId: activityId(4, 4), completedCount: 3, recordedCompletedCount: 1 },
        ],
        goalId: GOAL_ID.tripled,
        status: "applied",
      },
    ]);
  });

  it("writes each goal's corrections inside a transaction of its own", async () => {
    const backfill = buildBackfill({ scenarios: [sameDayScenario(), tripledScenario()] });

    await backfill.service.run({ mode: "apply", now: BACKFILL.now });

    expect(backfill.transactions).toEqual([
      { rewrites: [activityId(1, 3)], status: "committed" },
      { rewrites: [activityId(4, 3), activityId(4, 4)], status: "committed" },
    ]);
  });

  it("skips a goal whose history disagrees with its snapshot and leaves its events untouched", async () => {
    const backfill = buildBackfill({ scenarios: [staleScenario()] });

    const outcomes = await backfill.service.run({ mode: "apply", now: BACKFILL.now });

    expect({ outcomes, stored: backfill.storedOrdinals(GOAL_ID.stale) }).toEqual({
      outcomes: [
        {
          goalId: GOAL_ID.stale,
          skip: { countedTotal: 1, reason: "final_count_mismatch", replayedCount: 2 },
          status: "skipped",
        },
      ],
      stored: [1, 1],
    });
  });

  it("rolls the whole goal back and reports concurrent_change when a guarded update matches no row", async () => {
    const backfill = buildBackfill({
      changedByAnotherWriter: new Set([activityId(4, 4)]),
      scenarios: [tripledScenario()],
    });

    const outcomes = await backfill.service.run({ mode: "apply", now: BACKFILL.now });

    expect({
      outcomes,
      stored: backfill.storedOrdinals(GOAL_ID.tripled),
      transactions: backfill.transactions,
    }).toEqual({
      outcomes: [
        { goalId: GOAL_ID.tripled, skip: { reason: "concurrent_change" }, status: "skipped" },
      ],
      stored: [1, 1, 1],
      transactions: [{ rewrites: [activityId(4, 3), activityId(4, 4)], status: "rolled_back" }],
    });
  });

  it("keeps reconciling the other goals after one hits a concurrent change", async () => {
    const backfill = buildBackfill({
      changedByAnotherWriter: new Set([activityId(4, 4)]),
      scenarios: [tripledScenario(), sameDayScenario()],
    });

    await backfill.service.run({ mode: "apply", now: BACKFILL.now });

    expect({
      sameDay: backfill.storedOrdinals(GOAL_ID.sameDay),
      tripled: backfill.storedOrdinals(GOAL_ID.tripled),
    }).toEqual({ sameDay: [1, 2], tripled: [1, 1, 1] });
  });

  it("changes nothing when applied a second time over the corrected history", async () => {
    const backfill = buildBackfill({
      scenarios: [sameDayScenario(), recountedScenario(), tripledScenario()],
    });
    await backfill.service.run({ mode: "apply", now: BACKFILL.now });
    backfill.rewrite.mockClear();

    const outcomes = await backfill.service.run({ mode: "apply", now: BACKFILL.now });

    expect({ outcomes, rewriteCalls: backfill.rewrite.mock.calls.length }).toEqual({
      outcomes: [
        { goalId: GOAL_ID.sameDay, status: "unchanged" },
        { goalId: GOAL_ID.recounted, status: "unchanged" },
        { goalId: GOAL_ID.tripled, status: "unchanged" },
      ],
      rewriteCalls: 0,
    });
  });
});
