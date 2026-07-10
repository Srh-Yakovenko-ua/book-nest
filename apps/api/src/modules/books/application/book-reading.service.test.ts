import type { Nullable } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";
import type { BookViewAssembler } from "./book-view-assembler.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookReadingService } from "./book-reading.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const TODAY = new Date("2026-07-07T09:00:00.000Z");
const TODAY_START = new Date("2026-07-07T00:00:00.000Z");
const EXISTING_STARTED_AT = new Date("2026-01-01T00:00:00.000Z");

type ReadingProgressRow = NonNullable<BookWithRelations["readingProgress"]>;

type RepositoryMock = {
  applyReadingChange: ReturnType<typeof vi.fn>;
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
};

function buildService(repository: RepositoryMock): BookReadingService {
  return new BookReadingService(
    repository as unknown as BooksRepository,
    {} as unknown as BookViewAssembler,
  );
}

function ownedBook(readingProgress: Nullable<ReadingProgressRow>): BookWithRelations {
  return { pagesCount: 320, readingProgress } as unknown as BookWithRelations;
}

function readingProgressRow(startedAt: Nullable<Date>): ReadingProgressRow {
  return { startedAt } as unknown as ReadingProgressRow;
}

function repositoryMock(): RepositoryMock {
  return {
    applyReadingChange: vi.fn().mockResolvedValue(undefined),
    findOwnedByIdOrThrow: vi.fn(),
  };
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
    const client = {} as unknown as Prisma.TransactionClient;

    await service.startReading(USER_ID, BOOK_ID, client);

    expect(repository.applyReadingChange).toHaveBeenCalledWith(
      USER_ID,
      BOOK_ID,
      expect.anything(),
      client,
    );
  });
});
