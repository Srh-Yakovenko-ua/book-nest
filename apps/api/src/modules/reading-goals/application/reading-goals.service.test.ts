import type { ReadingGoalStatus, ReadingGoalView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { ListsService } from "../../lists/index.js";
import type { MediaService } from "../../media/index.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";
import type { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";

import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { addDaysToIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { fakeOf } from "../../../test/fake.js";
import { ACTIVE_LIST_GOAL_INDEX } from "../domain/reading-goal.constants.js";
import { ReadingGoalDetailAssembler } from "./reading-goal-detail.assembler.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";
import { ReadingGoalsService } from "./reading-goals.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const GOAL_ID = "33333333-3333-4333-8333-333333333333";
const OLD_GOAL_ID = "44444444-4444-4444-8444-444444444444";

const TX = fakeOf<Prisma.TransactionClient>({});

const TODAY = toIsoDate(new Date());
const TOMORROW = addDaysToIsoDate(TODAY, 1);
const YESTERDAY = addDaysToIsoDate(TODAY, -1);

function buildAssembler() {
  const repository = {
    findCountedBooks: vi.fn().mockResolvedValue([]),
    findOwnedById: vi.fn().mockResolvedValue(null),
  };
  const listsService = { countActiveBooks: vi.fn().mockResolvedValue(0) };
  const mediaService = { buildViewOrNull: vi.fn().mockReturnValue(null) };
  const viewBuilder = {
    build: vi.fn().mockResolvedValue(view("active")),
    countedSince: vi.fn().mockReturnValue(new Date("2026-08-01T00:00:00.000Z")),
  };

  const assembler = new ReadingGoalDetailAssembler(
    repository as unknown as ReadingGoalsRepository,
    listsService as unknown as ListsService,
    mediaService as unknown as MediaService,
    viewBuilder as unknown as ReadingGoalViewBuilder,
  );

  return { assembler, repository };
}

function buildService(overrides: { listBookCount?: number } = {}) {
  const repository = {
    acquireCreateLock: vi.fn().mockResolvedValue(undefined),
    archive: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue(goal()),
    deleteOwned: vi.fn().mockResolvedValue(1),
    findActiveByListId: vi.fn().mockResolvedValue(null),
    findCountedBooks: vi.fn().mockResolvedValue([]),
    findCountedFinishedDates: vi.fn().mockResolvedValue([]),
    findOwnedById: vi.fn().mockResolvedValue(goal()),
    update: vi.fn().mockResolvedValue(goal()),
  };

  const listsService = {
    assertOwned: vi.fn().mockResolvedValue(undefined),
    countActiveBooks: vi.fn().mockResolvedValue(overrides.listBookCount ?? 10),
  };

  const viewBuilder = {
    build: vi.fn().mockResolvedValue(view("active")),
    countedSince: vi.fn().mockReturnValue(new Date("2026-08-01T00:00:00.000Z")),
  };

  const transactionRunner = {
    run: vi.fn(<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) => handler(TX)),
  };

  const service = new ReadingGoalsService(
    repository as unknown as ReadingGoalsRepository,
    listsService as unknown as ListsService,
    viewBuilder as unknown as ReadingGoalViewBuilder,
    transactionRunner as unknown as TransactionRunner,
  );

  return { listsService, repository, service, transactionRunner, viewBuilder };
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
    completedAt: null,
    completedCount: 0,
    createdAt: "2026-08-01T10:00:00.000Z",
    daysLeft: 10,
    deadline: "2026-09-01",
    id: GOAL_ID,
    list: { id: LIST_ID, name: "Autumn reads" },
    name: "Five books",
    remainingCount: 5,
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

  it("rejects a target larger than the number of active books in the list", async () => {
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
    );
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
