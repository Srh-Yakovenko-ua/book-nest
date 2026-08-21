import type { ReadingGoalStatus, ReadingGoalView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { ListsService } from "../../lists/index.js";
import type { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import type {
  ReadingGoalListCandidate,
  ReadingGoalWithList,
} from "../infrastructure/reading-goals.repository.js";
import type { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import type { ReadingGoalActivityRecorder } from "./reading-goal-activity.recorder.js";
import type { ReadingGoalSnapshotService } from "./reading-goal-snapshot.service.js";

import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { addDaysToIsoDate, parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { ACTIVE_LIST_GOAL_INDEX } from "../domain/reading-goal.constants.js";
import { ReadingGoalActivityService } from "./reading-goal-activity.service.js";
import { ReadingGoalBooksService } from "./reading-goal-books.service.js";
import { ReadingGoalDetailAssembler } from "./reading-goal-detail.assembler.js";
import { ReadingGoalInputValidator } from "./reading-goal-input.validator.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";
import { ReadingGoalsService } from "./reading-goals.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const GOAL_ID = "33333333-3333-4333-8333-333333333333";
const OLD_GOAL_ID = "44444444-4444-4444-8444-444444444444";
const BOOK_ID = "55555555-5555-4555-8555-555555555555";

const TX = fakeOf<Prisma.TransactionClient>({});

const TODAY = toIsoDate(new Date());
const TOMORROW = addDaysToIsoDate(TODAY, 1);
const YESTERDAY = addDaysToIsoDate(TODAY, -1);

function buildAssembler() {
  const repository = { findOwnedById: vi.fn().mockResolvedValue(null) };
  const listsService = { countActiveBooks: vi.fn().mockResolvedValue(0) };
  const viewBuilder = {
    build: vi.fn().mockResolvedValue(view("active")),
    buildListItemFrom: vi.fn().mockReturnValue(view("active")),
  };
  const goalBooksService = {
    preview: vi.fn().mockResolvedValue({
      countedBooks: [],
      remainingBooks: [],
      snapshotBookCount: 0,
      snapshotBooks: [],
    }),
  };
  const goalActivityService = { preview: vi.fn().mockResolvedValue([]) };

  const assembler = new ReadingGoalDetailAssembler(
    repository as unknown as ReadingGoalsRepository,
    listsService as unknown as ListsService,
    viewBuilder as unknown as ReadingGoalViewBuilder,
    goalBooksService as unknown as ReadingGoalBooksService,
    goalActivityService as unknown as ReadingGoalActivityService,
  );

  return { assembler, repository };
}

function buildService(overrides: { listBookCount?: number; snapshotBookCount?: number } = {}) {
  const listBookCount = overrides.listBookCount ?? 10;
  const candidates = listCandidates(overrides.snapshotBookCount ?? listBookCount);

  const repository = {
    acquireCreateLock: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(goal()),
    deleteOwned: vi.fn().mockResolvedValue(1),
    findActiveByListId: vi.fn().mockResolvedValue(null),
    findActiveListBooks: vi.fn().mockResolvedValue(candidates),
    findOwnedById: vi.fn().mockResolvedValue(goal()),
    update: vi.fn().mockResolvedValue(goal()),
  };

  const listsService = {
    assertOwned: vi.fn().mockResolvedValue(undefined),
    countActiveBooks: vi.fn().mockResolvedValue(listBookCount),
  };

  const viewBuilder = {
    build: vi.fn().mockResolvedValue(view("active")),
  };

  const transactionRunner = {
    run: vi.fn(<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) => handler(TX)),
  };

  const snapshotService = {
    resync: vi.fn().mockResolvedValue([]),
    seed: vi.fn().mockResolvedValue(undefined),
  };

  const activityRecorder = {
    recordArchive: vi.fn().mockResolvedValue(undefined),
    recordCreation: vi.fn().mockResolvedValue(undefined),
    recordUpdate: vi.fn().mockResolvedValue(undefined),
  };

  const readingGoalBooksRepository = {
    countByGoal: vi.fn().mockResolvedValue(listBookCount),
  };

  const inputValidator = new ReadingGoalInputValidator(
    readingGoalBooksRepository as unknown as ReadingGoalBooksRepository,
  );

  const service = new ReadingGoalsService(
    repository as unknown as ReadingGoalsRepository,
    listsService as unknown as ListsService,
    viewBuilder as unknown as ReadingGoalViewBuilder,
    transactionRunner as unknown as TransactionRunner,
    inputValidator,
    snapshotService as unknown as ReadingGoalSnapshotService,
    activityRecorder as unknown as ReadingGoalActivityRecorder,
  );

  return {
    activityRecorder,
    candidates,
    listsService,
    repository,
    service,
    snapshotService,
    transactionRunner,
    viewBuilder,
  };
}

function goal(overrides: Partial<ReadingGoalWithList> = {}): ReadingGoalWithList {
  return {
    archivedAt: null,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    deadline: new Date("2026-09-01T00:00:00.000Z"),
    id: GOAL_ID,
    list: { id: LIST_ID, name: "Autumn reads" },
    listId: LIST_ID,
    name: "Five books",
    targetCount: 5,
    updatedAt: new Date("2026-08-01T10:00:00.000Z"),
    userId: USER_ID,
    ...overrides,
  };
}

function listCandidates(count: number): ReadingGoalListCandidate[] {
  return Array.from({ length: count }, (_unused, index) => ({
    bookId: `2222${String(index).padStart(4, "0")}-2222-4222-8222-222222222222`,
    finishedAt: null,
    position: index,
  }));
}

async function rejectionOf(operation: () => Promise<unknown>): Promise<unknown> {
  try {
    await operation();
  } catch (error) {
    return error;
  }
  throw new Error("expected the operation to reject");
}

function uniqueViolation(constraint: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    clientVersion: "7.0.0",
    code: "P2002",
    meta: { target: constraint },
  });
}

function view(status: ReadingGoalStatus): ReadingGoalView {
  return {
    archivedAt: null,
    completedAt: null,
    completedCount: 0,
    createdAt: "2026-08-01T10:00:00.000Z",
    daysLeft: 10,
    deadline: "2026-09-01",
    id: GOAL_ID,
    list: { id: LIST_ID, name: "Autumn reads" },
    name: "Five books",
    remainingCount: 5,
    result: null,
    status,
    targetCount: 5,
  };
}

const createInput = { deadline: TOMORROW, name: "Five books", targetCount: 5 };

describe("ReadingGoalsService.create", () => {
  it("rejects with a conflict when the list still has an active goal", async () => {
    const { repository, service, viewBuilder } = buildService();
    repository.findActiveByListId.mockResolvedValue(goal({ id: OLD_GOAL_ID }));
    viewBuilder.build.mockResolvedValue(view("active"));

    await expect(
      service.create({ input: createInput, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("does not create a second goal when the existing one is still active", async () => {
    const { repository, service, viewBuilder } = buildService();
    repository.findActiveByListId.mockResolvedValue(goal({ id: OLD_GOAL_ID }));
    viewBuilder.build.mockResolvedValue(view("active"));

    await rejectionOf(() =>
      service.create({ input: createInput, listId: LIST_ID, userId: USER_ID }),
    );

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("archives a completed predecessor before creating the new goal", async () => {
    const { repository, service, viewBuilder } = buildService();
    repository.findActiveByListId.mockResolvedValue(goal({ id: OLD_GOAL_ID }));
    viewBuilder.build.mockResolvedValueOnce(view("completed")).mockResolvedValue(view("active"));

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    expect(repository.archive).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: OLD_GOAL_ID, userId: USER_ID }),
      TX,
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("archives an expired predecessor before creating the new goal", async () => {
    const { repository, service, viewBuilder } = buildService();
    repository.findActiveByListId.mockResolvedValue(goal({ id: OLD_GOAL_ID }));
    viewBuilder.build.mockResolvedValueOnce(view("expired")).mockResolvedValue(view("active"));

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    expect(repository.archive).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: OLD_GOAL_ID, userId: USER_ID }),
      TX,
    );
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a target larger than the number of books captured by the snapshot", async () => {
    const { repository, service } = buildService({ listBookCount: 3 });

    const error = await rejectionOf(() =>
      service.create({
        input: { ...createInput, targetCount: 4 },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    );

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({
      fields: [{ field: "targetCount", message: expect.any(String) }],
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("validates the target against the snapshot rows rather than the pre-transaction list count", async () => {
    const { listsService, repository, service } = buildService({
      listBookCount: 10,
      snapshotBookCount: 2,
    });

    const error = await rejectionOf(() =>
      service.create({
        input: { ...createInput, targetCount: 3 },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    );

    expect(error).toBeInstanceOf(BadRequestError);
    expect(listsService.countActiveBooks).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("reads the snapshot candidates inside the transaction, after taking the lock", async () => {
    const { repository, service } = buildService();

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    expect(repository.findActiveListBooks).toHaveBeenCalledWith(
      { listId: LIST_ID, userId: USER_ID },
      TX,
    );
    const lockOrder = repository.acquireCreateLock.mock.invocationCallOrder.at(0) ?? 0;
    const candidatesOrder = repository.findActiveListBooks.mock.invocationCallOrder.at(0) ?? 0;
    expect(lockOrder).toBeLessThan(candidatesOrder);
  });

  it("seeds the snapshot from the candidates once the goal row exists", async () => {
    const { candidates, repository, service, snapshotService } = buildService();

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    expect(snapshotService.seed).toHaveBeenCalledWith({ candidates, goal: goal(), tx: TX });
    const createOrder = repository.create.mock.invocationCallOrder.at(0) ?? 0;
    const seedOrder = snapshotService.seed.mock.invocationCallOrder.at(0) ?? 0;
    expect(createOrder).toBeLessThan(seedOrder);
  });

  it("records the creation activity after the snapshot is seeded", async () => {
    const { activityRecorder, service, snapshotService } = buildService();

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    expect(activityRecorder.recordCreation).toHaveBeenCalledWith({
      goal: goal(),
      now: expect.any(Date),
      tx: TX,
    });
    const seedOrder = snapshotService.seed.mock.invocationCallOrder.at(0) ?? 0;
    const recordOrder = activityRecorder.recordCreation.mock.invocationCallOrder.at(0) ?? 0;
    expect(seedOrder).toBeLessThan(recordOrder);
  });

  it("records the archive activity for the predecessor it supersedes", async () => {
    const { activityRecorder, repository, service, viewBuilder } = buildService();
    repository.findActiveByListId.mockResolvedValue(goal({ id: OLD_GOAL_ID }));
    viewBuilder.build.mockResolvedValueOnce(view("completed")).mockResolvedValue(view("active"));

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    expect(activityRecorder.recordArchive).toHaveBeenCalledWith({
      changes: [],
      goal: expect.objectContaining({ archivedAt: expect.any(Date), id: OLD_GOAL_ID }),
      now: expect.any(Date),
      tx: TX,
    });
  });

  it("rejects a deadline set to today with a field-scoped error on deadline", async () => {
    const { service } = buildService();

    const error = await rejectionOf(() =>
      service.create({
        input: { ...createInput, deadline: TODAY },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    );

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({ fields: [{ field: "deadline", message: expect.any(String) }] });
  });

  it("rejects a deadline in the past with a field-scoped error on deadline", async () => {
    const { service } = buildService();

    const error = await rejectionOf(() =>
      service.create({
        input: { ...createInput, deadline: YESTERDAY },
        listId: LIST_ID,
        userId: USER_ID,
      }),
    );

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({ fields: [{ field: "deadline", message: expect.any(String) }] });
  });

  it("takes the create lock before reading the list's open goal", async () => {
    const { repository, service } = buildService();

    await service.create({ input: createInput, listId: LIST_ID, userId: USER_ID });

    const lockOrder = repository.acquireCreateLock.mock.invocationCallOrder.at(0) ?? 0;
    const readOrder = repository.findActiveByListId.mock.invocationCallOrder.at(0) ?? 0;
    expect(lockOrder).toBeGreaterThan(0);
    expect(lockOrder).toBeLessThan(readOrder);
  });

  it("maps a unique violation on the one-open-goal index to a conflict", async () => {
    const { repository, service } = buildService();
    repository.create.mockRejectedValue(uniqueViolation(ACTIVE_LIST_GOAL_INDEX));

    await expect(
      service.create({ input: createInput, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rethrows a unique violation raised by any other constraint", async () => {
    const { repository, service } = buildService();
    repository.create.mockRejectedValue(uniqueViolation("reading_goals_pkey"));

    const error = await rejectionOf(() =>
      service.create({ input: createInput, listId: LIST_ID, userId: USER_ID }),
    );

    expect(error).not.toBeInstanceOf(ConflictError);
    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("rejects when the list belongs to another user", async () => {
    const { listsService, service } = buildService();
    listsService.assertOwned.mockRejectedValue(new NotFoundError("List not found"));

    await expect(
      service.create({ input: createInput, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("ReadingGoalsService.update", () => {
  it("refuses to change an archived goal", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(
      goal({ archivedAt: new Date("2026-08-05T10:00:00.000Z") }),
    );

    await expect(
      service.update({ goalId: GOAL_ID, input: { name: "Renamed" }, userId: USER_ID }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("leaves an archived goal untouched in the repository", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(
      goal({ archivedAt: new Date("2026-08-05T10:00:00.000Z") }),
    );

    await rejectionOf(() =>
      service.update({ goalId: GOAL_ID, input: { name: "Renamed" }, userId: USER_ID }),
    );

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects moving the deadline into the past with a field-scoped error on deadline", async () => {
    const { service } = buildService();

    const error = await rejectionOf(() =>
      service.update({ goalId: GOAL_ID, input: { deadline: YESTERDAY }, userId: USER_ID }),
    );

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({ fields: [{ field: "deadline", message: expect.any(String) }] });
  });

  it("rejects moving the deadline to today with a field-scoped error on deadline", async () => {
    const { service } = buildService();

    const error = await rejectionOf(() =>
      service.update({ goalId: GOAL_ID, input: { deadline: TODAY }, userId: USER_ID }),
    );

    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({ fields: [{ field: "deadline", message: expect.any(String) }] });
  });

  it("rejects a raised target that exceeds the list size", async () => {
    const { service } = buildService({ listBookCount: 2 });

    const error = await rejectionOf(() =>
      service.update({ goalId: GOAL_ID, input: { targetCount: 7 }, userId: USER_ID }),
    );

    expect(error).toMatchObject({
      fields: [{ field: "targetCount", message: expect.any(String) }],
    });
  });

  it("reports another user's goal as not found rather than forbidden", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    const error = await rejectionOf(() =>
      service.update({ goalId: GOAL_ID, input: { name: "Renamed" }, userId: USER_ID }),
    );

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("writes the patch inside a transaction", async () => {
    const { repository, service, transactionRunner } = buildService();

    await service.update({ goalId: GOAL_ID, input: { name: "Renamed" }, userId: USER_ID });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ goalId: GOAL_ID, userId: USER_ID }),
      TX,
    );
  });

  it("resyncs the snapshot when the deadline moves", async () => {
    const { repository, service, snapshotService } = buildService();
    const moved = goal({ deadline: parseIsoDate(TOMORROW) });
    repository.update.mockResolvedValue(moved);

    await service.update({ goalId: GOAL_ID, input: { deadline: TOMORROW }, userId: USER_ID });

    expect(snapshotService.resync).toHaveBeenCalledWith({ goal: moved, tx: TX });
  });

  it("leaves the snapshot untouched when only the name changes", async () => {
    const { service, snapshotService } = buildService();

    await service.update({ goalId: GOAL_ID, input: { name: "Renamed" }, userId: USER_ID });

    expect(snapshotService.resync).not.toHaveBeenCalled();
  });

  it("hands the recorder both the pre-patch goal and the qualification changes", async () => {
    const { activityRecorder, repository, service, snapshotService } = buildService();
    const previous = goal();
    const moved = goal({ deadline: parseIsoDate(TOMORROW) });
    const changes = [
      { bookId: BOOK_ID, previousQualifiedFinishedAt: new Date(), qualifiedFinishedAt: null },
    ];
    repository.update.mockResolvedValue(moved);
    snapshotService.resync.mockResolvedValue(changes);

    await service.update({ goalId: GOAL_ID, input: { deadline: TOMORROW }, userId: USER_ID });

    expect(activityRecorder.recordUpdate).toHaveBeenCalledWith({
      changes,
      goal: moved,
      now: expect.any(Date),
      previous,
      tx: TX,
    });
  });

  it("reports a goal archived by a concurrent request as not found", async () => {
    const { repository, service } = buildService();
    repository.update.mockResolvedValue(null);

    const error = await rejectionOf(() =>
      service.update({ goalId: GOAL_ID, input: { name: "Renamed" }, userId: USER_ID }),
    );

    expect(error).toBeInstanceOf(NotFoundError);
  });
});

describe("ReadingGoalsService.archive", () => {
  it("reports another user's goal as not found rather than forbidden", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(null);

    const error = await rejectionOf(() => service.archive({ goalId: GOAL_ID, userId: USER_ID }));

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("leaves the original archivedAt in place when the goal is already archived", async () => {
    const { repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(
      goal({ archivedAt: new Date("2026-08-05T10:00:00.000Z") }),
    );

    await service.archive({ goalId: GOAL_ID, userId: USER_ID });

    expect(repository.archive).not.toHaveBeenCalled();
  });

  it("stamps archivedAt on an open goal", async () => {
    const { repository, service } = buildService();

    await service.archive({ goalId: GOAL_ID, userId: USER_ID });

    expect(repository.archive).toHaveBeenCalledWith(
      expect.objectContaining({ archivedAt: expect.any(Date), goalId: GOAL_ID, userId: USER_ID }),
      TX,
    );
  });

  it("records the archive activity when the stamp landed", async () => {
    const { activityRecorder, service } = buildService();

    await service.archive({ goalId: GOAL_ID, userId: USER_ID });

    expect(activityRecorder.recordArchive).toHaveBeenCalledWith({
      changes: [],
      goal: goal(),
      now: expect.any(Date),
      tx: TX,
    });
  });

  it("records nothing when the goal is already archived", async () => {
    const { activityRecorder, repository, service } = buildService();
    repository.findOwnedById.mockResolvedValue(
      goal({ archivedAt: new Date("2026-08-05T10:00:00.000Z") }),
    );

    await service.archive({ goalId: GOAL_ID, userId: USER_ID });

    expect(activityRecorder.recordArchive).not.toHaveBeenCalled();
  });

  it("records nothing when a concurrent request archived the goal first", async () => {
    const { activityRecorder, repository, service } = buildService();
    repository.archive.mockResolvedValue(0);

    await service.archive({ goalId: GOAL_ID, userId: USER_ID });

    expect(activityRecorder.recordArchive).not.toHaveBeenCalled();
  });
});

describe("ReadingGoalsService.delete", () => {
  it("reports another user's goal as not found rather than forbidden", async () => {
    const { repository, service } = buildService();
    repository.deleteOwned.mockResolvedValue(0);

    const error = await rejectionOf(() => service.delete({ goalId: GOAL_ID, userId: USER_ID }));

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("resolves when the goal belonged to the caller", async () => {
    const { service } = buildService();

    await expect(service.delete({ goalId: GOAL_ID, userId: USER_ID })).resolves.toBeUndefined();
  });
});

describe("ReadingGoalDetailAssembler.findDetail", () => {
  it("reports another user's goal as not found rather than forbidden", async () => {
    const { assembler } = buildAssembler();

    const error = await rejectionOf(() =>
      assembler.findDetail({ goalId: GOAL_ID, userId: USER_ID }),
    );

    expect(error).toBeInstanceOf(NotFoundError);
  });
});
