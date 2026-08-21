import type { BookView, Nullable } from "@app/shared";
import type { Mock } from "vitest";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { fakeOf } from "../../../test/fake.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookReadingService } from "./book-reading.service.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const TODAY = new Date("2026-07-07T09:00:00.000Z");
const TODAY_START = new Date("2026-07-07T00:00:00.000Z");
const EXISTING_STARTED_AT = new Date("2026-01-01T00:00:00.000Z");

const TRANSACTION_CLIENT = fakeOf<Prisma.TransactionClient>();

type ReadingProgressRow = NonNullable<BookWithRelations["readingProgress"]>;

type RepositoryMock = {
  applyReadingChange: Mock;
  findOwnedByIdOrThrow: Mock;
};

function buildService(repository: RepositoryMock): BookReadingService {
  return new BookReadingService(
    fakeOf<BooksRepository>(repository),
    fakeOf<BookViewAssembler>(),
    transactionRunnerMock(),
    fakeOf<ReadingGoalSyncService>({ syncBooks: vi.fn().mockResolvedValue(undefined) }),
  );
}

function ownedBook(readingProgress: Nullable<ReadingProgressRow>): BookWithRelations {
  return fakeOf<BookWithRelations>({ pagesCount: 320, readingProgress });
}

function readingProgressRow(startedAt: Nullable<Date>): ReadingProgressRow {
  return fakeOf<ReadingProgressRow>({ startedAt });
}

function repositoryMock(): RepositoryMock {
  return {
    applyReadingChange: vi.fn().mockResolvedValue(undefined),
    findOwnedByIdOrThrow: vi.fn(),
  };
}

function transactionRunnerMock(): TransactionRunner {
  return fakeOf<TransactionRunner>({
    run: <T>(callback: (client: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
      callback(TRANSACTION_CLIENT),
  });
}

describe("BookReadingService.startReading", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TODAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects and never applies a change when the book is not owned", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));
    const service = buildService(repository);

    await expect(service.startReading(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundError);
    expect(repository.applyReadingChange).not.toHaveBeenCalled();
  });

  it("applies a fresh reading patch with today's start date when there is no existing progress", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    const service = buildService(repository);

    await service.startReading(USER_ID, BOOK_ID);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      {
        book: { readingStatus: "reading" },
        progress: {
          abandonedAt: null,
          finishedAt: null,
          note: null,
          pausedAt: null,
          startedAt: TODAY_START,
        },
      },
      undefined,
    );
  });

  it("preserves the existing start date on an idempotent restart", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(
      ownedBook(readingProgressRow(EXISTING_STARTED_AT)),
    );
    const service = buildService(repository);

    await service.startReading(USER_ID, BOOK_ID);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.objectContaining({
        book: { readingStatus: "reading" },
        progress: expect.objectContaining({ startedAt: EXISTING_STARTED_AT }),
      }),
      undefined,
    );
  });

  it("threads the provided transaction client through to applyReadingChange", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    const service = buildService(repository);
    const client = fakeOf<Prisma.TransactionClient>();

    await service.startReading(USER_ID, BOOK_ID, client);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.anything(),
      client,
    );
  });
});

describe("BookReadingService.changeReadingStatus clearEvents", () => {
  function buildStatusService(repository: {
    acquireBookLock: Mock;
    findOwnedByIdOrThrow: Mock;
    recordReadingStatusChange: Mock;
  }): BookReadingService {
    return new BookReadingService(
      fakeOf<BooksRepository>(repository),
      fakeOf<BookViewAssembler>({ loadView: vi.fn().mockResolvedValue({} as BookView) }),
      transactionRunnerMock(),
      fakeOf<ReadingGoalSyncService>({ syncBooks: vi.fn().mockResolvedValue(undefined) }),
    );
  }

  function statusRepositoryMock(): {
    acquireBookLock: Mock;
    findOwnedByIdOrThrow: Mock;
    recordReadingStatusChange: Mock;
  } {
    return {
      acquireBookLock: vi.fn().mockResolvedValue(undefined),
      findOwnedByIdOrThrow: vi.fn().mockResolvedValue(
        fakeOf<BookWithRelations>({
          pagesCount: 320,
          readingProgress: fakeOf<ReadingProgressRow>({
            currentPage: 120,
            startedAt: EXISTING_STARTED_AT,
          }),
        }),
      ),
      recordReadingStatusChange: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("clears the reading events when resetting progress to not_started", async () => {
    const repository = statusRepositoryMock();
    const service = buildStatusService(repository);

    await service.changeReadingStatus(USER_ID, BOOK_ID, {
      resetProgress: true,
      status: "not_started",
    });

    expect(repository.recordReadingStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ clearEvents: true }),
      TRANSACTION_CLIENT,
    );
  });

  it("keeps the reading events when finishing a book pulls the current page to the page count", async () => {
    const repository = statusRepositoryMock();
    const service = buildStatusService(repository);

    await service.changeReadingStatus(USER_ID, BOOK_ID, { status: "finished" });

    expect(repository.recordReadingStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ clearEvents: false }),
      TRANSACTION_CLIENT,
    );
  });

  it("keeps the reading events when returning to not_started without a reset", async () => {
    const repository = statusRepositoryMock();
    const service = buildStatusService(repository);

    await service.changeReadingStatus(USER_ID, BOOK_ID, { status: "not_started" });

    expect(repository.recordReadingStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ clearEvents: false }),
      TRANSACTION_CLIENT,
    );
  });

  it("does not clear events when resetProgress is set but the target status still reads", async () => {
    const repository = statusRepositoryMock();
    const service = buildStatusService(repository);

    await service.changeReadingStatus(USER_ID, BOOK_ID, {
      resetProgress: true,
      status: "reading",
    });

    expect(repository.recordReadingStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ clearEvents: false }),
      TRANSACTION_CLIENT,
    );
  });
});
