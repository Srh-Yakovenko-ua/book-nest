import type {
  CreatedEventRelationView,
  CreateEventRelationInput,
  CreateTimelineEventInput,
  MoveTimelineEventInput,
  Nullable,
  Paginator,
  ReorderTimelineEventInput,
  TimelineEventDetailView,
  TimelineEventsQuery,
  TimelineEventView,
  TimelineOverviewView,
  TimelineReorderScope,
  UpdateTimelineEventInput,
} from "@app/shared";

import { normalizeSearch, TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  EventPositionScope,
  EventScalarRow,
  UpdateEventFields,
} from "../infrastructure/timeline-event.repository.js";
import type { BookReadingContext } from "../infrastructure/timeline.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { importanceRank, resolveImportanceFilter } from "../domain/importance.js";
import { appendPosition, computeSparsePosition } from "../domain/sparse-position.js";
import { emptyToNull, resolveReadingPosition } from "../domain/timeline-fields.js";
import { buildTimelineOverview } from "../domain/timeline-overview.js";
import {
  toCreatedRelationView,
  toEventDetailView,
  toEventView,
} from "../domain/timeline.mapper.js";
import { TimelineEventRepository } from "../infrastructure/timeline-event.repository.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";

@Injectable()
export class TimelineEventService {
  constructor(
    private readonly timelineRepository: TimelineRepository,
    private readonly timelineEventRepository: TimelineEventRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async createEvent(
    userId: string,
    bookId: string,
    input: CreateTimelineEventInput,
  ): Promise<TimelineEventView> {
    const context = await this.requireBookContext(userId, bookId);

    const created = await this.transactionRunner.run(async (tx) => {
      await this.timelineRepository.acquireBookLock(bookId, tx);
      await this.timelineRepository.ensureDefault(bookId, tx);
      const timelineId = await this.resolveTimelineId({ bookId, timelineId: input.timelineId, tx });

      this.assertPageWithinBook(input.pageNumber ?? null, context.pagesCount);
      const resolvedByEventId = await this.resolveResolvedBy({
        bookId,
        eventId: null,
        resolvedByEventId: input.resolvedByEventId,
        tx,
      });

      const bookOrder = appendPosition(await this.timelineEventRepository.maxBookOrder(bookId, tx));
      const timelineOrder = appendPosition(
        await this.timelineEventRepository.maxTimelineOrder(timelineId, tx),
      );

      return this.timelineEventRepository.create(
        {
          bookId,
          bookOrder,
          chapter: emptyToNull(input.chapter),
          description: emptyToNull(input.description),
          eventType: input.eventType,
          importance: input.importance,
          importanceRank: importanceRank(input.importance),
          location: emptyToNull(input.location),
          pageNumber: input.pageNumber ?? null,
          personalNote: emptyToNull(input.personalNote),
          resolvedByEventId,
          storyTime: emptyToNull(input.storyTime),
          summary: emptyToNull(input.summary),
          threadStatus: input.threadStatus ?? null,
          timelineId,
          timelineOrder,
          title: input.title,
        },
        tx,
      );
    });

    return toEventView(created);
  }

  async createRelation(
    userId: string,
    eventId: string,
    input: CreateEventRelationInput,
  ): Promise<CreatedEventRelationView> {
    const source = await this.requireOwnedEvent(userId, eventId);
    if (input.targetEventId === eventId) {
      throw new ValidationError("An event cannot be related to itself", {
        code: TIMELINE_ERROR_CODES.selfRelation,
      });
    }
    const target = await this.timelineEventRepository.findEventInBook({
      bookId: source.bookId,
      eventId: input.targetEventId,
    });
    if (target === null) {
      throw new ValidationError("The related event must belong to the same book", {
        code: TIMELINE_ERROR_CODES.crossBookRelation,
      });
    }

    try {
      const created = await this.timelineEventRepository.createRelation({
        relationType: input.relationType,
        sourceEventId: eventId,
        targetEventId: input.targetEventId,
      });
      return toCreatedRelationView(created);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("This relation already exists", {
          code: TIMELINE_ERROR_CODES.duplicateRelation,
        });
      }
      throw error;
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    await this.requireOwnedEvent(userId, eventId);
    await this.timelineEventRepository.deleteEvent(eventId);
  }

  async deleteRelation(userId: string, relationId: string): Promise<void> {
    const owned = await this.timelineEventRepository.findOwnedRelation({ relationId, userId });
    if (owned === null) {
      throw new NotFoundError("Relation not found", {
        code: TIMELINE_ERROR_CODES.relationNotFound,
      });
    }
    await this.timelineEventRepository.deleteRelation(relationId);
  }

  async getEvent(userId: string, eventId: string): Promise<TimelineEventDetailView> {
    const detail = await this.timelineEventRepository.findOwnedDetail({ eventId, userId });
    if (detail === null) {
      throw new NotFoundError("Event not found", { code: TIMELINE_ERROR_CODES.eventNotFound });
    }
    return toEventDetailView(detail);
  }

  async listEvents(
    userId: string,
    bookId: string,
    query: TimelineEventsQuery,
  ): Promise<Paginator<TimelineEventView>> {
    const context = await this.requireBookContext(userId, bookId);
    const filter = {
      bookId,
      currentPage: context.currentPage,
      eventTypes: query.eventType,
      importances: resolveImportanceFilter({
        importance: query.importance,
        important: query.important,
        keyOnly: query.keyOnly,
      }),
      recap: query.recap ?? false,
      search: normalizeSearch(query.search),
      timelineId: query.timelineId,
      unresolved: query.unresolved ?? false,
    };

    const [items, totalCount] = await Promise.all([
      this.timelineEventRepository.listEvents({
        ...filter,
        skip: (query.pageNumber - 1) * query.pageSize,
        sort: query.sort,
        take: query.pageSize,
      }),
      this.timelineEventRepository.countEvents(filter),
    ]);

    return buildPaginator({
      items: items.map(toEventView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async moveEvent(
    userId: string,
    eventId: string,
    input: MoveTimelineEventInput,
  ): Promise<TimelineEventView> {
    const moved = await this.transactionRunner.run(async (tx) => {
      const initial = await this.requireOwnedEvent(userId, eventId, tx);
      await this.timelineRepository.acquireBookLock(initial.bookId, tx);
      const event = await this.requireOwnedEvent(userId, eventId, tx);
      this.assertExpectedUpdatedAt(event, input.expectedUpdatedAt);

      const target = await this.timelineRepository.findTimelineInBook(
        { bookId: event.bookId, timelineId: input.targetTimelineId },
        tx,
      );
      if (target === null) {
        throw new ValidationError("The target timeline does not belong to this book", {
          code: TIMELINE_ERROR_CODES.invalidTargetTimeline,
        });
      }

      const timelineOrder = await this.resolveTargetTimelineOrder({
        afterEventId: input.afterEventId,
        beforeEventId: input.beforeEventId,
        movingId: eventId,
        targetTimelineId: target.id,
        tx,
      });
      return this.runOrderWrite(() =>
        this.timelineEventRepository.moveEvent(
          { eventId, timelineId: target.id, timelineOrder },
          tx,
        ),
      );
    });

    return toEventView(moved);
  }

  async overview(userId: string, bookId: string): Promise<TimelineOverviewView> {
    const context = await this.requireBookContext(userId, bookId);
    const [aggregate, timelines] = await Promise.all([
      this.timelineEventRepository.aggregateOverview({ bookId, currentPage: context.currentPage }),
      this.timelineRepository.listWithCounts(bookId),
    ]);

    return buildTimelineOverview({
      aggregate,
      readingPosition: resolveReadingPosition({
        currentPage: context.currentPage,
        readingStatus: context.readingStatus,
      }),
      timelines: timelines.map((timeline) => ({
        colorKey: timeline.colorKey,
        eventsCount: timeline._count.events,
        id: timeline.id,
        name: timeline.name,
      })),
    });
  }

  async reorderEvent(
    userId: string,
    eventId: string,
    input: ReorderTimelineEventInput,
  ): Promise<TimelineEventView> {
    const reordered = await this.transactionRunner.run(async (tx) => {
      const initial = await this.requireOwnedEvent(userId, eventId, tx);
      await this.timelineRepository.acquireBookLock(initial.bookId, tx);
      const event = await this.requireOwnedEvent(userId, eventId, tx);
      this.assertExpectedUpdatedAt(event, input.expectedUpdatedAt);

      const position = await this.resolveReorderPosition({
        afterEventId: input.afterEventId,
        beforeEventId: input.beforeEventId,
        event,
        scope: input.scope,
        tx,
      });

      return this.runOrderWrite(() =>
        input.scope === "book"
          ? this.timelineEventRepository.setBookOrder({ bookOrder: position, eventId }, tx)
          : this.timelineEventRepository.setTimelineOrder({ eventId, timelineOrder: position }, tx),
      );
    });

    return toEventView(reordered);
  }

  async updateEvent(
    userId: string,
    eventId: string,
    input: UpdateTimelineEventInput,
  ): Promise<TimelineEventView> {
    const event = await this.requireOwnedEvent(userId, eventId);

    const fields: UpdateEventFields = {};
    this.applyTextFields(fields, input);
    if (input.eventType !== undefined) {
      fields.eventType = input.eventType;
    }
    if (input.importance !== undefined) {
      fields.importance = input.importance;
      fields.importanceRank = importanceRank(input.importance);
    }
    if (input.threadStatus !== undefined) {
      fields.threadStatus = input.threadStatus ?? null;
    }
    if (input.pageNumber !== undefined) {
      const pageNumber = input.pageNumber ?? null;
      if (pageNumber !== null) {
        const context = await this.requireBookContext(userId, event.bookId);
        this.assertPageWithinBook(pageNumber, context.pagesCount);
      }
      fields.pageNumber = pageNumber;
    }
    if (input.resolvedByEventId !== undefined) {
      fields.resolvedByEventId = await this.resolveResolvedBy({
        bookId: event.bookId,
        eventId,
        resolvedByEventId: input.resolvedByEventId,
      });
    }

    const updated = await this.timelineEventRepository.update({ eventId, fields });
    return toEventView(updated);
  }

  private applyTextFields(fields: UpdateEventFields, input: UpdateTimelineEventInput): void {
    if (input.title !== undefined) {
      fields.title = input.title;
    }
    if (input.summary !== undefined) {
      fields.summary = emptyToNull(input.summary);
    }
    if (input.description !== undefined) {
      fields.description = emptyToNull(input.description);
    }
    if (input.chapter !== undefined) {
      fields.chapter = emptyToNull(input.chapter);
    }
    if (input.location !== undefined) {
      fields.location = emptyToNull(input.location);
    }
    if (input.storyTime !== undefined) {
      fields.storyTime = emptyToNull(input.storyTime);
    }
    if (input.personalNote !== undefined) {
      fields.personalNote = emptyToNull(input.personalNote);
    }
  }

  private assertExpectedUpdatedAt(
    event: EventScalarRow,
    expectedUpdatedAt: string | undefined,
  ): void {
    if (expectedUpdatedAt !== undefined && event.updatedAt.toISOString() !== expectedUpdatedAt) {
      throw new ConflictError("The event changed, reload and retry", {
        code: TIMELINE_ERROR_CODES.reorderConflict,
      });
    }
  }

  private assertPageWithinBook(pageNumber: Nullable<number>, pagesCount: Nullable<number>): void {
    if (pageNumber !== null && pagesCount !== null && pageNumber > pagesCount) {
      throw new ValidationError("The page number exceeds the book page count", {
        code: TIMELINE_ERROR_CODES.pageExceedsBook,
      });
    }
  }

  private async reorderAnchorOrder({
    event,
    neighborId,
    scope,
    tx,
  }: {
    event: EventScalarRow;
    neighborId: string;
    scope: TimelineReorderScope;
    tx: Prisma.TransactionClient;
  }): Promise<number> {
    if (neighborId === event.id) {
      throw new ValidationError("An event cannot be positioned relative to itself", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    const neighbor = await this.timelineEventRepository.findNeighbor(
      { bookId: event.bookId, eventId: neighborId },
      tx,
    );
    if (neighbor === null) {
      throw new ValidationError("The neighbor event does not belong to this book", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    if (scope === "timeline" && neighbor.timelineId !== event.timelineId) {
      throw new ValidationError("The neighbor event belongs to a different timeline", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    return scope === "book" ? neighbor.bookOrder : neighbor.timelineOrder;
  }

  private async requireBookContext(userId: string, bookId: string): Promise<BookReadingContext> {
    const context = await this.timelineRepository.findBookContext({ bookId, userId });
    if (context === null) {
      throw new NotFoundError("Book not found", { code: TIMELINE_ERROR_CODES.bookNotFound });
    }
    return context;
  }

  private async requireOwnedEvent(
    userId: string,
    eventId: string,
    client?: Prisma.TransactionClient,
  ): Promise<EventScalarRow> {
    const event = await this.timelineEventRepository.findOwnedEvent({ eventId, userId }, client);
    if (event === null) {
      throw new NotFoundError("Event not found", { code: TIMELINE_ERROR_CODES.eventNotFound });
    }
    return event;
  }

  private async resolveNeighborOrders({
    afterEventId,
    beforeEventId,
    movingId,
    resolveAnchorOrder,
    scope,
    tx,
  }: {
    afterEventId: string | undefined;
    beforeEventId: string | undefined;
    movingId: string;
    resolveAnchorOrder: (neighborId: string) => Promise<number>;
    scope: EventPositionScope;
    tx: Prisma.TransactionClient;
  }): Promise<{ after: Nullable<number>; before: Nullable<number> }> {
    const afterOrder = afterEventId === undefined ? null : await resolveAnchorOrder(afterEventId);
    const beforeOrder =
      beforeEventId === undefined ? null : await resolveAnchorOrder(beforeEventId);

    if (afterOrder !== null) {
      const before = await this.timelineEventRepository.nextOrder(
        { excludeEventId: movingId, order: afterOrder, scope },
        tx,
      );
      return { after: afterOrder, before };
    }
    if (beforeOrder !== null) {
      const after = await this.timelineEventRepository.prevOrder(
        { excludeEventId: movingId, order: beforeOrder, scope },
        tx,
      );
      return { after, before: beforeOrder };
    }
    return { after: null, before: null };
  }

  private resolveReorderPosition({
    afterEventId,
    beforeEventId,
    event,
    scope,
    tx,
  }: {
    afterEventId: string | undefined;
    beforeEventId: string | undefined;
    event: EventScalarRow;
    scope: TimelineReorderScope;
    tx: Prisma.TransactionClient;
  }): Promise<number> {
    const positionScope: EventPositionScope =
      scope === "book"
        ? { bookId: event.bookId, kind: "book" }
        : { kind: "timeline", timelineId: event.timelineId };

    return this.resolveSparsePosition({
      afterEventId,
      beforeEventId,
      movingId: event.id,
      rebalance: () =>
        scope === "book"
          ? this.timelineEventRepository.rebalanceBookOrder(event.bookId, tx)
          : this.timelineEventRepository.rebalanceTimelineOrder(event.timelineId, tx),
      resolveAnchorOrder: (neighborId) => this.reorderAnchorOrder({ event, neighborId, scope, tx }),
      scope: positionScope,
      tx,
    });
  }

  private async resolveResolvedBy({
    bookId,
    eventId,
    resolvedByEventId,
    tx,
  }: {
    bookId: string;
    eventId: Nullable<string>;
    resolvedByEventId: Nullable<string> | undefined;
    tx?: Prisma.TransactionClient;
  }): Promise<Nullable<string>> {
    if (resolvedByEventId === undefined || resolvedByEventId === null) {
      return null;
    }
    if (resolvedByEventId === eventId) {
      throw new ValidationError("An event cannot resolve itself", {
        code: TIMELINE_ERROR_CODES.invalidResolvedBy,
      });
    }
    const target = await this.timelineEventRepository.findEventInBook(
      { bookId, eventId: resolvedByEventId },
      tx,
    );
    if (target === null) {
      throw new ValidationError("The resolving event must belong to the same book", {
        code: TIMELINE_ERROR_CODES.invalidResolvedBy,
      });
    }
    return resolvedByEventId;
  }

  private async resolveSparsePosition({
    afterEventId,
    beforeEventId,
    movingId,
    rebalance,
    resolveAnchorOrder,
    scope,
    tx,
  }: {
    afterEventId: string | undefined;
    beforeEventId: string | undefined;
    movingId: string;
    rebalance: () => Promise<void>;
    resolveAnchorOrder: (neighborId: string) => Promise<number>;
    scope: EventPositionScope;
    tx: Prisma.TransactionClient;
  }): Promise<number> {
    const compute = async (): Promise<Nullable<number>> => {
      const neighbors = await this.resolveNeighborOrders({
        afterEventId,
        beforeEventId,
        movingId,
        resolveAnchorOrder,
        scope,
        tx,
      });
      const result = computeSparsePosition(neighbors);
      return result.ok ? result.position : null;
    };

    const first = await compute();
    if (first !== null) {
      return first;
    }
    await rebalance();
    const second = await compute();
    if (second !== null) {
      return second;
    }
    throw new ConflictError("The event order changed, reload and retry", {
      code: TIMELINE_ERROR_CODES.reorderConflict,
    });
  }

  private async resolveTargetTimelineOrder({
    afterEventId,
    beforeEventId,
    movingId,
    targetTimelineId,
    tx,
  }: {
    afterEventId: string | undefined;
    beforeEventId: string | undefined;
    movingId: string;
    targetTimelineId: string;
    tx: Prisma.TransactionClient;
  }): Promise<number> {
    if (afterEventId === undefined && beforeEventId === undefined) {
      return appendPosition(
        await this.timelineEventRepository.maxTimelineOrder(targetTimelineId, tx),
      );
    }

    return this.resolveSparsePosition({
      afterEventId,
      beforeEventId,
      movingId,
      rebalance: () => this.timelineEventRepository.rebalanceTimelineOrder(targetTimelineId, tx),
      resolveAnchorOrder: (neighborId) =>
        this.timelineAnchorOrder({ movingId, neighborId, targetTimelineId, tx }),
      scope: { kind: "timeline", timelineId: targetTimelineId },
      tx,
    });
  }

  private async resolveTimelineId({
    bookId,
    timelineId,
    tx,
  }: {
    bookId: string;
    timelineId: string | undefined;
    tx: Prisma.TransactionClient;
  }): Promise<string> {
    if (timelineId !== undefined) {
      const timeline = await this.timelineRepository.findTimelineInBook({ bookId, timelineId }, tx);
      if (timeline === null) {
        throw new ValidationError("The timeline does not belong to this book", {
          code: TIMELINE_ERROR_CODES.invalidTargetTimeline,
        });
      }
      return timeline.id;
    }
    const defaultTimeline = await this.timelineRepository.findDefaultTimeline(bookId, tx);
    if (defaultTimeline === null) {
      throw new NotFoundError("Timeline not found", {
        code: TIMELINE_ERROR_CODES.timelineNotFound,
      });
    }
    return defaultTimeline.id;
  }

  private async runOrderWrite<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("The event order changed, reload and retry", {
          code: TIMELINE_ERROR_CODES.reorderConflict,
        });
      }
      throw error;
    }
  }

  private async timelineAnchorOrder({
    movingId,
    neighborId,
    targetTimelineId,
    tx,
  }: {
    movingId: string;
    neighborId: string;
    targetTimelineId: string;
    tx: Prisma.TransactionClient;
  }): Promise<number> {
    if (neighborId === movingId) {
      throw new ValidationError("An event cannot be positioned relative to itself", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    const timelineOrder = await this.timelineEventRepository.findTimelineOrderInTimeline(
      { eventId: neighborId, timelineId: targetTimelineId },
      tx,
    );
    if (timelineOrder === null) {
      throw new ValidationError("The neighbor event does not belong to the target timeline", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    return timelineOrder;
  }
}
