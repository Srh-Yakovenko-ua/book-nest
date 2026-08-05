import type {
  CreateTimelineEventInput,
  Nullable,
  Paginator,
  TimelineEventDetailView,
  TimelineEventsQuery,
  TimelineEventView,
  TimelineOverviewView,
  UpdateTimelineEventInput,
} from "@app/shared";

import { normalizeSearch, TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UpdateEventFields } from "../domain/timeline-fields.js";
import type { EventScalarRow } from "../infrastructure/timeline-event.repository.js";
import type { BookReadingContext } from "../infrastructure/timeline.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { isRecordNotFoundError } from "../../../core/prisma-errors.js";
import { assertPageWithinBook } from "../domain/assert-page-within-book.js";
import { importanceRank, resolveImportanceFilter } from "../domain/importance.js";
import { appendPosition } from "../domain/sparse-position.js";
import { applyTextFields, emptyToNull, resolveReadingPosition } from "../domain/timeline-fields.js";
import { buildTimelineOverview } from "../domain/timeline-overview.js";
import { toEventDetailView, toEventView } from "../domain/timeline.mapper.js";
import { TimelineEventRepository } from "../infrastructure/timeline-event.repository.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";
import { requireOwnedEvent } from "./require-owned-event.js";

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

      assertPageWithinBook({
        pageNumber: input.pageNumber ?? null,
        pagesCount: context.pagesCount,
      });
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

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    await this.requireOwnedEvent(userId, eventId);
    const removed = await this.timelineEventRepository.deleteEvent(eventId);
    if (removed === 0) {
      throw new NotFoundError("Event not found", { code: TIMELINE_ERROR_CODES.eventNotFound });
    }
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
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
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

  async updateEvent(
    userId: string,
    eventId: string,
    input: UpdateTimelineEventInput,
  ): Promise<TimelineEventView> {
    const event = await this.requireOwnedEvent(userId, eventId);

    const fields: UpdateEventFields = {};
    applyTextFields({ fields, input });
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
        assertPageWithinBook({ pageNumber, pagesCount: context.pagesCount });
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

    try {
      const updated = await this.timelineEventRepository.update({ eventId, fields });
      return toEventView(updated);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new NotFoundError("Event not found", { code: TIMELINE_ERROR_CODES.eventNotFound });
      }
      throw error;
    }
  }

  private async requireBookContext(userId: string, bookId: string): Promise<BookReadingContext> {
    const context = await this.timelineRepository.findBookContext({ bookId, userId });
    if (context === null) {
      throw new NotFoundError("Book not found", { code: TIMELINE_ERROR_CODES.bookNotFound });
    }
    return context;
  }

  private requireOwnedEvent(
    userId: string,
    eventId: string,
    client?: Prisma.TransactionClient,
  ): Promise<EventScalarRow> {
    return requireOwnedEvent({
      client,
      eventId,
      repository: this.timelineEventRepository,
      userId,
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
}
