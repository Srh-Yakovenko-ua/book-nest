import type { BookView, Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookReadingService } from "./book-reading.service.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const EXISTING_STARTED_AT = new Date("2026-01-01T00:00:00.000Z");
const UPDATE_DATE = "2026-07-07";
const EXPECTED_EVENT_DATE = new Date("2026-07-07T00:00:00.000Z");

type AssemblerMock = { loadView: ReturnType<typeof vi.fn> };

type RepositoryMock = {
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
  findReadingEvents: ReturnType<typeof vi.fn>;
  recordReadingProgress: ReturnType<typeof vi.fn>;
};

function assemblerMock(): AssemblerMock {
  return { loadView: vi.fn().mockResolvedValue({} as BookView) };
}

function buildService(repository: RepositoryMock, assembler: AssemblerMock): BookReadingService {
  return new BookReadingService(
    repository as unknown as BooksRepository,
    assembler as unknown as BookViewAssembler,
  );
}

function ownedBook(args: {
  currentPage?: number;
  pagesCount?: Nullable<number>;
  readingStatus?: string;
}): BookWithRelations {
  const readingProgress =
    args.currentPage === undefined
      ? null
      : { currentPage: args.currentPage, startedAt: EXISTING_STARTED_AT };
  return {
    pagesCount: args.pagesCount ?? 320,
    readingProgress,
    readingStatus: args.readingStatus ?? "reading",
  } as unknown as BookWithRelations;
}

function repositoryMock(): RepositoryMock {
  return {
    findOwnedByIdOrThrow: vi.fn(),
    findReadingEvents: vi.fn(),
    recordReadingProgress: vi.fn().mockResolvedValue(undefined),
  };
}

describe("BookReadingService.updateReadingProgress history event", () => {
  it("appends an event with the pages advanced when the page moves forward", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ currentPage: 50 }));
    const service = buildService(repository, assemblerMock());

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 120,
      updateDate: UPDATE_DATE,
    });

    expect(repository.recordReadingProgress).toHaveBeenCalledWith({
      bookId: BOOK_ID,
      event: { date: EXPECTED_EVENT_DATE, page: 120, pagesRead: 70 },
      patch: expect.objectContaining({
        progress: expect.objectContaining({ currentPage: 120 }),
      }),
      userId: USER_ID,
    });
  });

  it("counts the whole current page as pages read on the first-ever progress update", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ readingStatus: "not_started" }));
    const service = buildService(repository, assemblerMock());

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 45,
      updateDate: UPDATE_DATE,
    });

    expect(repository.recordReadingProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        event: { date: EXPECTED_EVENT_DATE, page: 45, pagesRead: 45 },
      }),
    );
  });

  it("passes a null event when the page does not advance", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ currentPage: 120 }));
    const service = buildService(repository, assemblerMock());

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 120,
      updateDate: UPDATE_DATE,
    });

    expect(repository.recordReadingProgress).toHaveBeenCalledWith(
      expect.objectContaining({ event: null }),
    );
  });

  it("logs the remaining pages to the page count when marking the book as finished", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(
      ownedBook({ currentPage: 100, pagesCount: 320 }),
    );
    const service = buildService(repository, assemblerMock());

    await service.updateReadingProgress(USER_ID, BOOK_ID, {
      currentPage: 150,
      markAsFinished: true,
      updateDate: UPDATE_DATE,
    });

    expect(repository.recordReadingProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        event: { date: EXPECTED_EVENT_DATE, page: 320, pagesRead: 220 },
      }),
    );
  });
});

describe("BookReadingService.getReadingHistory", () => {
  it("aggregates the stored events into the reading history view", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockResolvedValue(ownedBook({ currentPage: 150 }));
    repository.findReadingEvents.mockResolvedValue([
      { date: new Date("2026-07-05T00:00:00.000Z"), id: "e1", page: 40, pagesRead: 40 },
      { date: new Date("2026-07-05T00:00:00.000Z"), id: "e2", page: 90, pagesRead: 50 },
      { date: new Date("2026-07-06T00:00:00.000Z"), id: "e3", page: 150, pagesRead: 60 },
    ]);
    const service = buildService(repository, assemblerMock());

    const result = await service.getReadingHistory(USER_ID, BOOK_ID);

    expect(result).toEqual({
      daily: [
        { date: "2026-07-05", pagesRead: 90 },
        { date: "2026-07-06", pagesRead: 60 },
      ],
      daysRead: 2,
      events: [
        { date: "2026-07-05", id: "e1", page: 40, pagesRead: 40 },
        { date: "2026-07-05", id: "e2", page: 90, pagesRead: 50 },
        { date: "2026-07-06", id: "e3", page: 150, pagesRead: 60 },
      ],
      totalPagesRead: 150,
    });
  });

  it("throws NotFoundError and never reads events when the book is not owned", async () => {
    const repository = repositoryMock();
    repository.findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));
    const service = buildService(repository, assemblerMock());

    await expect(service.getReadingHistory(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundError);
    expect(repository.findReadingEvents).not.toHaveBeenCalled();
  });
});
