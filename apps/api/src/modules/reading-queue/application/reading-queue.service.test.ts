import type { BookView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { BookViewAssembler } from "../../books/index.js";
import type { ReadingQueueRepository } from "../infrastructure/reading-queue.repository.js";

import { ReadingQueueService } from "./reading-queue.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

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
  const service = new ReadingQueueService(assembler, repository);
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
