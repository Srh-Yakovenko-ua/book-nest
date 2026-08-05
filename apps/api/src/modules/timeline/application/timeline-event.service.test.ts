import type { Nullable } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type {
  EventScalarRow,
  TimelineEventRepository,
} from "../infrastructure/timeline-event.repository.js";
import type {
  BookReadingContext,
  TimelineRepository,
} from "../infrastructure/timeline.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { TimelineEventService } from "./timeline-event.service.js";
import { TimelineRelationService } from "./timeline-relation.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const BOOK_ID = "22222222-2222-2222-2222-222222222222";
const EVENT_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_ID = "44444444-4444-4444-4444-444444444444";
const RELATION_ID = "55555555-5555-5555-5555-555555555555";

type Config = {
  bookContext?: Nullable<BookReadingContext>;
  createRelationError?: unknown;
  eventInBook?: Nullable<{ id: string }>;
  ownedEvent?: Nullable<EventScalarRow>;
  ownedRelation?: Nullable<{ id: string }>;
};

function createService(config: Config = {}): {
  createRelation: ReturnType<typeof vi.fn>;
  relationService: TimelineRelationService;
  service: TimelineEventService;
} {
  const createRelation = config.createRelationError
    ? vi.fn().mockRejectedValue(config.createRelationError)
    : vi.fn().mockResolvedValue({
        createdAt: new Date(),
        id: RELATION_ID,
        relationType: "related",
        sourceEventId: EVENT_ID,
        targetEvent: {
          bookOrder: 1,
          chapter: null,
          id: OTHER_ID,
          pageNumber: null,
          timeline: { name: "Main" },
          timelineId: "t",
          title: "Target",
        },
        targetEventId: OTHER_ID,
      });

  const timelineEventRepository = {
    createRelation,
    findEventInBook: vi.fn().mockResolvedValue(config.eventInBook ?? null),
    findOwnedDetail: vi.fn().mockResolvedValue(null),
    findOwnedEvent: vi.fn().mockResolvedValue(config.ownedEvent ?? null),
    findOwnedRelation: vi.fn().mockResolvedValue(config.ownedRelation ?? null),
    update: vi.fn(),
  } as unknown as TimelineEventRepository;

  const timelineRepository = {
    findBookContext: vi.fn().mockResolvedValue(config.bookContext ?? null),
  } as unknown as TimelineRepository;

  const transactionRunner = {
    run: vi.fn(),
  } as unknown as TransactionRunner;

  const service = new TimelineEventService(
    timelineRepository,
    timelineEventRepository,
    transactionRunner,
  );
  const relationService = new TimelineRelationService(timelineEventRepository);

  return { createRelation, relationService, service };
}

function makeContext(overrides: Partial<BookReadingContext> = {}): BookReadingContext {
  return { currentPage: null, pagesCount: null, readingStatus: "reading", ...overrides };
}

function makeEvent(overrides: Partial<EventScalarRow> = {}): EventScalarRow {
  return {
    bookId: BOOK_ID,
    bookOrder: 1024,
    chapter: null,
    createdAt: new Date(),
    description: null,
    eventType: "main",
    id: EVENT_ID,
    importance: "medium",
    importanceRank: 1,
    location: null,
    pageNumber: null,
    personalNote: null,
    resolvedByEventId: null,
    storyTime: null,
    summary: null,
    threadStatus: null,
    timelineId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    timelineOrder: 1024,
    title: "Event",
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("TimelineEventService", () => {
  it("rejects creating an event for a book the user does not own", async () => {
    const { service } = createService({ bookContext: null });
    await expect(
      service.createEvent(USER_ID, BOOK_ID, {
        eventType: "main",
        importance: "medium",
        title: "x",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects reading a missing event", async () => {
    const { service } = createService({ ownedEvent: null });
    await expect(service.getEvent(USER_ID, EVENT_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a self relation", async () => {
    const { relationService } = createService({ ownedEvent: makeEvent() });
    await expect(
      relationService.createRelation(USER_ID, EVENT_ID, {
        relationType: "related",
        targetEventId: EVENT_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a relation to an event of another book", async () => {
    const { relationService } = createService({ eventInBook: null, ownedEvent: makeEvent() });
    await expect(
      relationService.createRelation(USER_ID, EVENT_ID, {
        relationType: "related",
        targetEventId: OTHER_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("maps a duplicate relation to a conflict", async () => {
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      clientVersion: "7.8.0",
      code: "P2002",
    });
    const { relationService } = createService({
      createRelationError: uniqueError,
      eventInBook: { id: OTHER_ID },
      ownedEvent: makeEvent(),
    });
    await expect(
      relationService.createRelation(USER_ID, EVENT_ID, {
        relationType: "related",
        targetEventId: OTHER_ID,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects deleting a missing relation", async () => {
    const { relationService } = createService({ ownedRelation: null });
    await expect(relationService.deleteRelation(USER_ID, RELATION_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("rejects a self resolution on update", async () => {
    const { service } = createService({ ownedEvent: makeEvent() });
    await expect(
      service.updateEvent(USER_ID, EVENT_ID, { resolvedByEventId: EVENT_ID }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a page beyond the book on update", async () => {
    const { service } = createService({
      bookContext: makeContext({ pagesCount: 100 }),
      ownedEvent: makeEvent(),
    });
    await expect(
      service.updateEvent(USER_ID, EVENT_ID, { pageNumber: 250 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
