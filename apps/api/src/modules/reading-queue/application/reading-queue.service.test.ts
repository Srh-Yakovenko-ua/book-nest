import type { BookView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BookReadingService,
  BooksRepository,
  BookViewAssembler,
  BookWithRelations,
} from "../../books/index.js";
import type { ReadingQueueRepository } from "../infrastructure/reading-queue.repository.js";

import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { ReadingQueueService } from "./reading-queue.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";

type QueueRow = { id: string; pagesCount: null | number; queuePosition: null | number };

function buildService(rows: QueueRow[]): {
  listQueue: ReturnType<typeof vi.fn>;
  service: ReadingQueueService;
  viewOf: ReturnType<typeof vi.fn>;
} {
  const listQueue = vi.fn().mockResolvedValue(rows);
  const viewOf = vi.fn(
    (book: QueueRow): BookView =>
      ({ id: book.id, pagesCount: book.pagesCount }) as unknown as BookView,
  );
  const repository = { listQueue } as unknown as ReadingQueueRepository;
  const assembler = { viewOf } as unknown as BookViewAssembler;
  const booksRepository = {} as unknown as BooksRepository;
  const transactionRunner = {} as unknown as TransactionRunner;
  const service = new ReadingQueueService(
    booksRepository,
    {} as unknown as BookReadingService,
    assembler,
    repository,
    transactionRunner,
  );
  return { listQueue, service, viewOf };
}

describe("ReadingQueueService.getQueue", () => {
  it("maps repository rows to queue items preserving order with each book position and assembled view", async () => {
    const { service } = buildService([
      { id: "book-a", pagesCount: 100, queuePosition: 2 },
      { id: "book-b", pagesCount: 250, queuePosition: 5 },
      { id: "book-c", pagesCount: 50, queuePosition: 9 },
    ]);

    const result = await service.getQueue(USER_ID);

    expect(result.items).toEqual([
      { book: { id: "book-a", pagesCount: 100 }, position: 2 },
      { book: { id: "book-b", pagesCount: 250 }, position: 5 },
      { book: { id: "book-c", pagesCount: 50 }, position: 9 },
    ]);
  });

  it("sets count to the number of queued items", async () => {
    const { service } = buildService([
      { id: "book-a", pagesCount: 100, queuePosition: 1 },
      { id: "book-b", pagesCount: 250, queuePosition: 2 },
    ]);

    const result = await service.getQueue(USER_ID);

    expect(result.count).toBe(2);
  });

  it("sums pagesCount across items treating a null pagesCount as zero", async () => {
    const { service } = buildService([
      { id: "book-a", pagesCount: 120, queuePosition: 1 },
      { id: "book-b", pagesCount: null, queuePosition: 2 },
      { id: "book-c", pagesCount: 30, queuePosition: 3 },
    ]);

    const result = await service.getQueue(USER_ID);

    expect(result.totalPagesCount).toBe(150);
  });

  it("returns an empty queue view when no books are queued", async () => {
    const { service } = buildService([]);

    const result = await service.getQueue(USER_ID);

    expect(result).toEqual({ count: 0, items: [], totalPagesCount: 0 });
  });

  it("requests the queue for the passed user id", async () => {
    const { listQueue, service } = buildService([]);

    await service.getQueue(USER_ID);

    expect(listQueue).toHaveBeenCalledWith(USER_ID);
  });
});

function buildAddToQueueService(): {
  count: ReturnType<typeof vi.fn>;
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
  listQueue: ReturnType<typeof vi.fn>;
  service: ReadingQueueService;
  setPosition: ReturnType<typeof vi.fn>;
  shiftDownFrom: ReturnType<typeof vi.fn>;
  tx: Prisma.TransactionClient;
} {
  const tx = {} as unknown as Prisma.TransactionClient;
  const findOwnedByIdOrThrow = vi.fn();
  const count = vi.fn().mockResolvedValue(0);
  const shiftDownFrom = vi.fn().mockResolvedValue(undefined);
  const setPosition = vi.fn().mockResolvedValue(undefined);
  const listQueue = vi.fn().mockResolvedValue([]);
  const viewOf = vi.fn(
    (book: QueueRow): BookView =>
      ({ id: book.id, pagesCount: book.pagesCount }) as unknown as BookView,
  );
  const run = vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

  const booksRepository = { findOwnedByIdOrThrow } as unknown as BooksRepository;
  const assembler = { viewOf } as unknown as BookViewAssembler;
  const repository = {
    count,
    listQueue,
    setPosition,
    shiftDownFrom,
  } as unknown as ReadingQueueRepository;
  const transactionRunner = { run } as unknown as TransactionRunner;

  const service = new ReadingQueueService(
    booksRepository,
    {} as unknown as BookReadingService,
    assembler,
    repository,
    transactionRunner,
  );
  return { count, findOwnedByIdOrThrow, listQueue, service, setPosition, shiftDownFrom, tx };
}

function ownedBook(queuePosition: null | number): BookWithRelations {
  return { queuePosition } as unknown as BookWithRelations;
}

describe("ReadingQueueService.addToQueue", () => {
  it("rejects with NotFoundError when the book is not owned by the user", async () => {
    const { findOwnedByIdOrThrow, service } = buildAddToQueueService();
    findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));

    await expect(
      service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "end" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("rejects with ConflictError when the book is already in the queue", async () => {
    const { findOwnedByIdOrThrow, service } = buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(3));

    await expect(
      service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "end" }),
    ).rejects.toThrow(ConflictError);
  });

  it("does not shift or set positions when the book is already in the queue", async () => {
    const { findOwnedByIdOrThrow, service, setPosition, shiftDownFrom } = buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(3));

    await expect(
      service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "end" }),
    ).rejects.toThrow(ConflictError);
    expect(shiftDownFrom).not.toHaveBeenCalled();
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("appends at count + 1 for end placement over an existing queue", async () => {
    const { count, findOwnedByIdOrThrow, service, setPosition, shiftDownFrom, tx } =
      buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    count.mockResolvedValue(3);

    await service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "end" });

    expect(shiftDownFrom).toHaveBeenCalledWith(USER_ID, 4, tx);
    expect(setPosition).toHaveBeenCalledWith(USER_ID, BOOK_ID, 4, tx);
  });

  it("inserts at position 1 for start placement over an existing queue", async () => {
    const { count, findOwnedByIdOrThrow, service, setPosition, shiftDownFrom, tx } =
      buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    count.mockResolvedValue(3);

    await service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "start" });

    expect(shiftDownFrom).toHaveBeenCalledWith(USER_ID, 1, tx);
    expect(setPosition).toHaveBeenCalledWith(USER_ID, BOOK_ID, 1, tx);
  });

  it("inserts at the requested position for a valid specific placement", async () => {
    const { count, findOwnedByIdOrThrow, service, setPosition, shiftDownFrom, tx } =
      buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    count.mockResolvedValue(3);

    await service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "specific", position: 2 });

    expect(shiftDownFrom).toHaveBeenCalledWith(USER_ID, 2, tx);
    expect(setPosition).toHaveBeenCalledWith(USER_ID, BOOK_ID, 2, tx);
  });

  it("rejects with ValidationError when a specific position exceeds count + 1", async () => {
    const { count, findOwnedByIdOrThrow, service } = buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    count.mockResolvedValue(3);

    await expect(
      service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "specific", position: 99 }),
    ).rejects.toThrow(ValidationError);
  });

  it("does not shift or set positions when a specific position is out of range", async () => {
    const { count, findOwnedByIdOrThrow, service, setPosition, shiftDownFrom } =
      buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    count.mockResolvedValue(3);

    await expect(
      service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "specific", position: 99 }),
    ).rejects.toThrow(ValidationError);
    expect(shiftDownFrom).not.toHaveBeenCalled();
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("returns the reloaded queue view after inserting the book", async () => {
    const { findOwnedByIdOrThrow, listQueue, service } = buildAddToQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));
    listQueue.mockResolvedValue([
      { id: "book-a", pagesCount: 120, queuePosition: 1 },
      { id: "book-b", pagesCount: 30, queuePosition: 2 },
    ]);

    const result = await service.addToQueue(USER_ID, { bookId: BOOK_ID, placement: "end" });

    expect(result).toEqual({
      count: 2,
      items: [
        { book: { id: "book-a", pagesCount: 120 }, position: 1 },
        { book: { id: "book-b", pagesCount: 30 }, position: 2 },
      ],
      totalPagesCount: 150,
    });
  });
});

function buildRemoveFromQueueService(): {
  clearPosition: ReturnType<typeof vi.fn>;
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
  listQueue: ReturnType<typeof vi.fn>;
  service: ReadingQueueService;
  shiftUpAfter: ReturnType<typeof vi.fn>;
  tx: Prisma.TransactionClient;
} {
  const tx = {} as unknown as Prisma.TransactionClient;
  const findOwnedByIdOrThrow = vi.fn();
  const clearPosition = vi.fn().mockResolvedValue(undefined);
  const shiftUpAfter = vi.fn().mockResolvedValue(undefined);
  const listQueue = vi.fn().mockResolvedValue([]);
  const viewOf = vi.fn(
    (book: QueueRow): BookView =>
      ({ id: book.id, pagesCount: book.pagesCount }) as unknown as BookView,
  );
  const run = vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

  const booksRepository = { findOwnedByIdOrThrow } as unknown as BooksRepository;
  const assembler = { viewOf } as unknown as BookViewAssembler;
  const repository = {
    clearPosition,
    listQueue,
    shiftUpAfter,
  } as unknown as ReadingQueueRepository;
  const transactionRunner = { run } as unknown as TransactionRunner;

  const service = new ReadingQueueService(
    booksRepository,
    {} as unknown as BookReadingService,
    assembler,
    repository,
    transactionRunner,
  );
  return { clearPosition, findOwnedByIdOrThrow, listQueue, service, shiftUpAfter, tx };
}

describe("ReadingQueueService.removeFromQueue", () => {
  it("rejects with NotFoundError when the book is not owned by the user", async () => {
    const { findOwnedByIdOrThrow, service } = buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));

    await expect(service.removeFromQueue(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundError);
  });

  it("does not clear or shift positions when the book is not owned", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, shiftUpAfter } =
      buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));

    await expect(service.removeFromQueue(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundError);
    expect(clearPosition).not.toHaveBeenCalled();
    expect(shiftUpAfter).not.toHaveBeenCalled();
  });

  it("rejects with the not-in-queue message when the owned book has no queue position", async () => {
    const { findOwnedByIdOrThrow, service } = buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));

    await expect(service.removeFromQueue(USER_ID, BOOK_ID)).rejects.toThrow(
      "Книга не в черзі читання",
    );
  });

  it("does not clear or shift positions when the owned book has no queue position", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, shiftUpAfter } =
      buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));

    await expect(service.removeFromQueue(USER_ID, BOOK_ID)).rejects.toThrow(NotFoundError);
    expect(clearPosition).not.toHaveBeenCalled();
    expect(shiftUpAfter).not.toHaveBeenCalled();
  });

  it("clears the removed book position within the threaded transaction", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, tx } = buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.removeFromQueue(USER_ID, BOOK_ID);

    expect(clearPosition).toHaveBeenCalledWith(USER_ID, BOOK_ID, tx);
  });

  it("shifts up the books positioned after the removed one within the threaded transaction", async () => {
    const { findOwnedByIdOrThrow, service, shiftUpAfter, tx } = buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.removeFromQueue(USER_ID, BOOK_ID);

    expect(shiftUpAfter).toHaveBeenCalledWith(USER_ID, 2, tx);
  });

  it("returns the reloaded queue view after removing the book", async () => {
    const { findOwnedByIdOrThrow, listQueue, service } = buildRemoveFromQueueService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));
    listQueue.mockResolvedValue([
      { id: "book-a", pagesCount: 100, queuePosition: 1 },
      { id: "book-c", pagesCount: 50, queuePosition: 2 },
    ]);

    const result = await service.removeFromQueue(USER_ID, BOOK_ID);

    expect(result).toEqual({
      count: 2,
      items: [
        { book: { id: "book-a", pagesCount: 100 }, position: 1 },
        { book: { id: "book-c", pagesCount: 50 }, position: 2 },
      ],
      totalPagesCount: 150,
    });
  });
});

function buildReorderService(): {
  findQueuedBookIds: ReturnType<typeof vi.fn>;
  listQueue: ReturnType<typeof vi.fn>;
  service: ReadingQueueService;
  setPosition: ReturnType<typeof vi.fn>;
  tx: Prisma.TransactionClient;
} {
  const tx = {} as unknown as Prisma.TransactionClient;
  const findQueuedBookIds = vi.fn().mockResolvedValue([]);
  const setPosition = vi.fn().mockResolvedValue(undefined);
  const listQueue = vi.fn().mockResolvedValue([]);
  const viewOf = vi.fn(
    (book: QueueRow): BookView =>
      ({ id: book.id, pagesCount: book.pagesCount }) as unknown as BookView,
  );
  const run = vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

  const booksRepository = {} as unknown as BooksRepository;
  const assembler = { viewOf } as unknown as BookViewAssembler;
  const repository = {
    findQueuedBookIds,
    listQueue,
    setPosition,
  } as unknown as ReadingQueueRepository;
  const transactionRunner = { run } as unknown as TransactionRunner;

  const service = new ReadingQueueService(
    booksRepository,
    {} as unknown as BookReadingService,
    assembler,
    repository,
    transactionRunner,
  );
  return { findQueuedBookIds, listQueue, service, setPosition, tx };
}

function buildStartReadingService(): {
  clearPosition: ReturnType<typeof vi.fn>;
  findOwnedByIdOrThrow: ReturnType<typeof vi.fn>;
  listQueue: ReturnType<typeof vi.fn>;
  service: ReadingQueueService;
  shiftUpAfter: ReturnType<typeof vi.fn>;
  startReading: ReturnType<typeof vi.fn>;
  tx: Prisma.TransactionClient;
} {
  const tx = {} as unknown as Prisma.TransactionClient;
  const findOwnedByIdOrThrow = vi.fn();
  const startReading = vi.fn().mockResolvedValue(undefined);
  const clearPosition = vi.fn().mockResolvedValue(undefined);
  const shiftUpAfter = vi.fn().mockResolvedValue(undefined);
  const listQueue = vi.fn().mockResolvedValue([]);
  const viewOf = vi.fn(
    (book: QueueRow): BookView =>
      ({ id: book.id, pagesCount: book.pagesCount }) as unknown as BookView,
  );
  const run = vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx));

  const booksRepository = { findOwnedByIdOrThrow } as unknown as BooksRepository;
  const bookReadingService = { startReading } as unknown as BookReadingService;
  const assembler = { viewOf } as unknown as BookViewAssembler;
  const repository = {
    clearPosition,
    listQueue,
    shiftUpAfter,
  } as unknown as ReadingQueueRepository;
  const transactionRunner = { run } as unknown as TransactionRunner;

  const service = new ReadingQueueService(
    booksRepository,
    bookReadingService,
    assembler,
    repository,
    transactionRunner,
  );
  return {
    clearPosition,
    findOwnedByIdOrThrow,
    listQueue,
    service,
    shiftUpAfter,
    startReading,
    tx,
  };
}

describe("ReadingQueueService.reorder", () => {
  it("rejects with ValidationError when the order contains duplicate ids", async () => {
    const { service } = buildReorderService();

    await expect(
      service.reorder(USER_ID, { order: ["book-a", "book-a", "book-b"] }),
    ).rejects.toThrow(ValidationError);
  });

  it("does not set any position when the order contains duplicate ids", async () => {
    const { service, setPosition } = buildReorderService();

    await expect(
      service.reorder(USER_ID, { order: ["book-a", "book-a", "book-b"] }),
    ).rejects.toThrow(ValidationError);
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("rejects with ValidationError when the order omits a queued id", async () => {
    const { findQueuedBookIds, service } = buildReorderService();
    findQueuedBookIds.mockResolvedValue(["book-a", "book-b", "book-c"]);

    await expect(service.reorder(USER_ID, { order: ["book-a", "book-b"] })).rejects.toThrow(
      ValidationError,
    );
  });

  it("does not set any position when the order omits a queued id", async () => {
    const { findQueuedBookIds, service, setPosition } = buildReorderService();
    findQueuedBookIds.mockResolvedValue(["book-a", "book-b", "book-c"]);

    await expect(service.reorder(USER_ID, { order: ["book-a", "book-b"] })).rejects.toThrow(
      ValidationError,
    );
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("rejects with ValidationError when the order includes a foreign id of matching length", async () => {
    const { findQueuedBookIds, service } = buildReorderService();
    findQueuedBookIds.mockResolvedValue(["book-a", "book-b", "book-c"]);

    await expect(
      service.reorder(USER_ID, { order: ["book-a", "book-b", "book-x"] }),
    ).rejects.toThrow(ValidationError);
  });

  it("does not set any position when the order includes a foreign id", async () => {
    const { findQueuedBookIds, service, setPosition } = buildReorderService();
    findQueuedBookIds.mockResolvedValue(["book-a", "book-b", "book-c"]);

    await expect(
      service.reorder(USER_ID, { order: ["book-a", "book-b", "book-x"] }),
    ).rejects.toThrow(ValidationError);
    expect(setPosition).not.toHaveBeenCalled();
  });

  it("sets each queued book position by its index within the threaded transaction", async () => {
    const { findQueuedBookIds, service, setPosition, tx } = buildReorderService();
    findQueuedBookIds.mockResolvedValue(["book-a", "book-b", "book-c"]);

    await service.reorder(USER_ID, { order: ["book-c", "book-a", "book-b"] });

    expect(setPosition).toHaveBeenNthCalledWith(1, USER_ID, "book-c", 1, tx);
    expect(setPosition).toHaveBeenNthCalledWith(2, USER_ID, "book-a", 2, tx);
    expect(setPosition).toHaveBeenNthCalledWith(3, USER_ID, "book-b", 3, tx);
  });

  it("returns the reloaded queue view after reordering", async () => {
    const { findQueuedBookIds, listQueue, service } = buildReorderService();
    findQueuedBookIds.mockResolvedValue(["book-a", "book-b", "book-c"]);
    listQueue.mockResolvedValue([
      { id: "book-c", pagesCount: 30, queuePosition: 1 },
      { id: "book-a", pagesCount: 100, queuePosition: 2 },
      { id: "book-b", pagesCount: 250, queuePosition: 3 },
    ]);

    const result = await service.reorder(USER_ID, { order: ["book-c", "book-a", "book-b"] });

    expect(result).toEqual({
      count: 3,
      items: [
        { book: { id: "book-c", pagesCount: 30 }, position: 1 },
        { book: { id: "book-a", pagesCount: 100 }, position: 2 },
        { book: { id: "book-b", pagesCount: 250 }, position: 3 },
      ],
      totalPagesCount: 380,
    });
  });
});

describe("ReadingQueueService.startReading", () => {
  it("rejects with NotFoundError when the book is not owned by the user", async () => {
    const { findOwnedByIdOrThrow, service } = buildStartReadingService();
    findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));

    await expect(service.startReading(USER_ID, BOOK_ID, true)).rejects.toThrow(NotFoundError);
  });

  it("does not start reading or dequeue the book when it is not owned", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, shiftUpAfter, startReading } =
      buildStartReadingService();
    findOwnedByIdOrThrow.mockRejectedValue(new NotFoundError("Book not found"));

    await expect(service.startReading(USER_ID, BOOK_ID, true)).rejects.toThrow(NotFoundError);
    expect(startReading).not.toHaveBeenCalled();
    expect(clearPosition).not.toHaveBeenCalled();
    expect(shiftUpAfter).not.toHaveBeenCalled();
  });

  it("marks the book as reading within the threaded transaction when it is queued and removeFromQueue is true", async () => {
    const { findOwnedByIdOrThrow, service, startReading, tx } = buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.startReading(USER_ID, BOOK_ID, true);

    expect(startReading).toHaveBeenCalledWith(USER_ID, BOOK_ID, tx);
  });

  it("clears the started book position within the threaded transaction when it is queued and removeFromQueue is true", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, tx } = buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.startReading(USER_ID, BOOK_ID, true);

    expect(clearPosition).toHaveBeenCalledWith(USER_ID, BOOK_ID, tx);
  });

  it("shifts up the books positioned after the started one within the threaded transaction", async () => {
    const { findOwnedByIdOrThrow, service, shiftUpAfter, tx } = buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.startReading(USER_ID, BOOK_ID, true);

    expect(shiftUpAfter).toHaveBeenCalledWith(USER_ID, 2, tx);
  });

  it("marks the book as reading when removeFromQueue is false and the book is queued", async () => {
    const { findOwnedByIdOrThrow, service, startReading, tx } = buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.startReading(USER_ID, BOOK_ID, false);

    expect(startReading).toHaveBeenCalledWith(USER_ID, BOOK_ID, tx);
  });

  it("does not dequeue the book when removeFromQueue is false", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, shiftUpAfter } =
      buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(2));

    await service.startReading(USER_ID, BOOK_ID, false);

    expect(clearPosition).not.toHaveBeenCalled();
    expect(shiftUpAfter).not.toHaveBeenCalled();
  });

  it("marks the book as reading when removeFromQueue is true but the book is not queued", async () => {
    const { findOwnedByIdOrThrow, service, startReading, tx } = buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));

    await service.startReading(USER_ID, BOOK_ID, true);

    expect(startReading).toHaveBeenCalledWith(USER_ID, BOOK_ID, tx);
  });

  it("does not dequeue when removeFromQueue is true but the book has no queue position", async () => {
    const { clearPosition, findOwnedByIdOrThrow, service, shiftUpAfter } =
      buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(null));

    await service.startReading(USER_ID, BOOK_ID, true);

    expect(clearPosition).not.toHaveBeenCalled();
    expect(shiftUpAfter).not.toHaveBeenCalled();
  });

  it("returns the reloaded queue view after starting reading", async () => {
    const { findOwnedByIdOrThrow, listQueue, service } = buildStartReadingService();
    findOwnedByIdOrThrow.mockResolvedValue(ownedBook(1));
    listQueue.mockResolvedValue([
      { id: "book-a", pagesCount: 100, queuePosition: 1 },
      { id: "book-b", pagesCount: 250, queuePosition: 2 },
    ]);

    const result = await service.startReading(USER_ID, BOOK_ID, false);

    expect(result).toEqual({
      count: 2,
      items: [
        { book: { id: "book-a", pagesCount: 100 }, position: 1 },
        { book: { id: "book-b", pagesCount: 250 }, position: 2 },
      ],
      totalPagesCount: 350,
    });
  });
});
