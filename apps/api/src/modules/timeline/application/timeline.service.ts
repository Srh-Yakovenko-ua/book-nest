import type {
  CreateTimelineInput,
  DeleteTimelineQuery,
  Nullable,
  ReorderTimelinesInput,
  SetDefaultTimelineInput,
  TimelineDeletionResult,
  TimelineListView,
  TimelineSummaryView,
  TimelineView,
  UpdateTimelineInput,
} from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UpdateTimelineFields } from "../infrastructure/timeline.repository.js";

import { assertNotStale } from "../../../core/assert-not-stale.js";
import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { BookAccessService } from "../../books/index.js";
import { appendPosition, computeSparsePosition } from "../domain/sparse-position.js";
import { emptyToNull } from "../domain/timeline-fields.js";
import { toTimelineView } from "../domain/timeline.mapper.js";
import { TimelineEventRepository } from "../infrastructure/timeline-event.repository.js";
import { TimelineRepository, type TimelineRow } from "../infrastructure/timeline.repository.js";
import { TimelinePurgeScheduler } from "./timeline-purge.scheduler.js";

@Injectable()
export class TimelineService {
  constructor(
    private readonly bookAccess: BookAccessService,
    private readonly timelineRepository: TimelineRepository,
    private readonly timelineEventRepository: TimelineEventRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly purgeScheduler: TimelinePurgeScheduler,
  ) {}

  async createTimeline(
    userId: string,
    bookId: string,
    input: CreateTimelineInput,
  ): Promise<TimelineView> {
    await this.assertBookOwned(userId, bookId);

    const created = await this.transactionRunner.run(async (tx) => {
      await this.timelineRepository.acquireBookLock(bookId, tx);
      await this.timelineRepository.ensureDefault(bookId, tx);
      const position = appendPosition(await this.timelineRepository.maxPosition(bookId, tx));
      try {
        return await this.timelineRepository.create(
          {
            bookId,
            colorKey: input.colorKey ?? null,
            description: emptyToNull(input.description),
            isDefault: false,
            name: input.name,
            position,
          },
          tx,
        );
      } catch (error) {
        throw this.mapUniqueNameError(error);
      }
    });

    return toTimelineView(created, 0);
  }

  async deleteTimeline(
    userId: string,
    timelineId: string,
    query: DeleteTimelineQuery,
  ): Promise<TimelineDeletionResult> {
    const deletedAt = new Date();
    const owned = await this.timelineRepository.findOwnedTimeline({ timelineId, userId });
    if (owned === null) {
      throw new NotFoundError("Timeline not found", {
        code: TIMELINE_ERROR_CODES.timelineNotFound,
      });
    }

    await this.transactionRunner.run(async (tx) => {
      await this.timelineRepository.acquireBookLock(owned.bookId, tx);
      const fresh = await this.timelineRepository.findOwnedTimeline({ timelineId, userId }, tx);
      if (fresh === null) {
        throw new NotFoundError("Timeline not found", {
          code: TIMELINE_ERROR_CODES.timelineNotFound,
        });
      }
      if (fresh.isDefault) {
        throw new ConflictError("The default timeline cannot be deleted", {
          code: TIMELINE_ERROR_CODES.defaultTimelineDelete,
        });
      }

      const eventCount = await this.timelineEventRepository.countInTimeline(timelineId, tx);
      if (eventCount === 0) {
        await this.timelineRepository.softDelete({ deletedAt, timelineId }, tx);
        return;
      }

      await this.deleteNonEmptyTimeline({ bookId: owned.bookId, deletedAt, query, timelineId, tx });
    });

    await this.purgeScheduler.schedule({ timelineId, userId });

    return {
      deletedAt: deletedAt.toISOString(),
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
      timelineId,
    };
  }

  async listTimelines(userId: string, bookId: string): Promise<TimelineListView> {
    await this.assertBookOwned(userId, bookId);

    let timelines = await this.timelineRepository.listWithCounts(bookId);
    if (timelines.length === 0) {
      await this.transactionRunner.run(async (tx) => {
        await this.timelineRepository.acquireBookLock(bookId, tx);
        await this.timelineRepository.ensureDefault(bookId, tx);
      });
      timelines = await this.timelineRepository.listWithCounts(bookId);
    }

    return {
      timelines: timelines.map((timeline) => toTimelineView(timeline, timeline._count.events)),
    };
  }

  async reorderTimelines(
    userId: string,
    bookId: string,
    input: ReorderTimelinesInput,
  ): Promise<TimelineListView> {
    await this.assertBookOwned(userId, bookId);

    await this.transactionRunner.run(async (tx) => {
      await this.timelineRepository.acquireBookLock(bookId, tx);
      const moving = await this.timelineRepository.findTimelineInBook(
        { bookId, timelineId: input.timelineId },
        tx,
      );
      if (moving === null) {
        throw new NotFoundError("Timeline not found", {
          code: TIMELINE_ERROR_CODES.timelineNotFound,
        });
      }
      assertNotStale({
        actual: moving.updatedAt,
        expected: input.expectedUpdatedAt,
        toError: () =>
          new ConflictError("The timeline order changed, reload and retry", {
            code: TIMELINE_ERROR_CODES.reorderConflict,
          }),
      });

      const position = await this.resolveTimelinePosition({
        afterTimelineId: input.afterTimelineId,
        beforeTimelineId: input.beforeTimelineId,
        bookId,
        movingId: moving.id,
        tx,
      });
      await this.timelineRepository.setPosition({ position, timelineId: moving.id }, tx);
    });

    return this.listTimelines(userId, bookId);
  }

  async setDefault(
    userId: string,
    timelineId: string,
    input: SetDefaultTimelineInput,
  ): Promise<TimelineListView> {
    const owned = await this.timelineRepository.findOwnedTimeline({ timelineId, userId });
    if (owned === null) {
      throw new NotFoundError("Timeline not found", {
        code: TIMELINE_ERROR_CODES.timelineNotFound,
      });
    }

    await this.transactionRunner.run(async (tx) => {
      await this.timelineRepository.acquireBookLock(owned.bookId, tx);
      const fresh = await this.timelineRepository.findOwnedTimeline({ timelineId, userId }, tx);
      if (fresh === null) {
        throw new NotFoundError("Timeline not found", {
          code: TIMELINE_ERROR_CODES.timelineNotFound,
        });
      }
      assertNotStale({
        actual: fresh.updatedAt,
        expected: input.expectedUpdatedAt,
        toError: () =>
          new ConflictError("The timeline changed, reload and retry", {
            code: TIMELINE_ERROR_CODES.reorderConflict,
          }),
      });
      await this.timelineRepository.setDefault({ bookId: owned.bookId, timelineId }, tx);
    });

    return this.listTimelines(userId, owned.bookId);
  }

  async summary(userId: string, bookId: string): Promise<TimelineSummaryView> {
    await this.assertBookOwned(userId, bookId);
    const timelines = await this.timelineRepository.listWithCounts(bookId);
    const entries = timelines.map((timeline) => ({
      eventsCount: timeline._count.events,
      timelineId: timeline.id,
    }));
    return {
      timelines: entries,
      totalEvents: entries.reduce((total, entry) => total + entry.eventsCount, 0),
    };
  }

  async updateTimeline(
    userId: string,
    timelineId: string,
    input: UpdateTimelineInput,
  ): Promise<TimelineView> {
    const owned = await this.timelineRepository.findOwnedTimeline({ timelineId, userId });
    if (owned === null) {
      throw new NotFoundError("Timeline not found", {
        code: TIMELINE_ERROR_CODES.timelineNotFound,
      });
    }

    const fields: UpdateTimelineFields = {};
    if (input.name !== undefined) {
      fields.name = input.name;
    }
    if (input.description !== undefined) {
      fields.description = emptyToNull(input.description);
    }
    if (input.colorKey !== undefined) {
      fields.colorKey = input.colorKey ?? null;
    }

    let updated: TimelineRow;
    try {
      updated = await this.timelineRepository.update({ fields, timelineId });
    } catch (error) {
      throw this.mapUniqueNameError(error);
    }

    const eventsCount = await this.timelineEventRepository.countInTimeline(timelineId);
    return toTimelineView(updated, eventsCount);
  }

  private async assertBookOwned(userId: string, bookId: string): Promise<void> {
    await this.bookAccess.assertOwned({
      bookId,
      notFoundCode: TIMELINE_ERROR_CODES.bookNotFound,
      userId,
    });
  }

  private async deleteNonEmptyTimeline({
    bookId,
    deletedAt,
    query,
    timelineId,
    tx,
  }: {
    bookId: string;
    deletedAt: Date;
    query: DeleteTimelineQuery;
    timelineId: string;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    if (query.strategy === undefined) {
      throw new ValidationError("A delete strategy is required for a timeline with events", {
        code: TIMELINE_ERROR_CODES.deleteStrategyRequired,
      });
    }
    if (query.strategy === "delete") {
      await this.timelineRepository.softDelete({ deletedAt, timelineId }, tx);
      return;
    }

    if (query.targetTimelineId === undefined || query.targetTimelineId === timelineId) {
      throw new ValidationError("A different target timeline is required to move events", {
        code: TIMELINE_ERROR_CODES.targetTimelineRequired,
      });
    }
    const target = await this.timelineRepository.findTimelineInBook(
      { bookId, timelineId: query.targetTimelineId },
      tx,
    );
    if (target === null) {
      throw new ValidationError("The target timeline does not belong to this book", {
        code: TIMELINE_ERROR_CODES.invalidTargetTimeline,
      });
    }
    const baseOrder = (await this.timelineEventRepository.maxTimelineOrder(target.id, tx)) ?? 0;
    await this.timelineEventRepository.moveAllEvents(
      { baseOrder, fromTimelineId: timelineId, toTimelineId: target.id },
      tx,
    );
    await this.timelineRepository.softDelete({ deletedAt, timelineId }, tx);
  }

  private mapUniqueNameError(error: unknown): unknown {
    if (isUniqueConstraintError(error)) {
      return new ConflictError("A timeline with this name already exists for this book", {
        code: TIMELINE_ERROR_CODES.duplicateName,
      });
    }
    return error;
  }

  private async neighborTimelinePosition({
    bookId,
    movingId,
    neighborId,
    tx,
  }: {
    bookId: string;
    movingId: string;
    neighborId: string | undefined;
    tx: Prisma.TransactionClient;
  }): Promise<Nullable<number>> {
    if (neighborId === undefined) {
      return null;
    }
    if (neighborId === movingId) {
      throw new ValidationError("A timeline cannot be positioned relative to itself", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    const neighbor = await this.timelineRepository.findTimelineInBook(
      { bookId, timelineId: neighborId },
      tx,
    );
    if (neighbor === null) {
      throw new ValidationError("The neighbor timeline does not belong to this book", {
        code: TIMELINE_ERROR_CODES.invalidNeighbor,
      });
    }
    return neighbor.position;
  }

  private async resolveTimelinePosition({
    afterTimelineId,
    beforeTimelineId,
    bookId,
    movingId,
    tx,
  }: {
    afterTimelineId: string | undefined;
    beforeTimelineId: string | undefined;
    bookId: string;
    movingId: string;
    tx: Prisma.TransactionClient;
  }): Promise<number> {
    const compute = async (): Promise<Nullable<number>> => {
      const after = await this.neighborTimelinePosition({
        bookId,
        movingId,
        neighborId: afterTimelineId,
        tx,
      });
      const before = await this.neighborTimelinePosition({
        bookId,
        movingId,
        neighborId: beforeTimelineId,
        tx,
      });
      const result = computeSparsePosition({ after, before });
      return result.ok ? result.position : null;
    };

    const first = await compute();
    if (first !== null) {
      return first;
    }
    await this.timelineRepository.rebalancePositions(bookId, tx);
    const second = await compute();
    if (second !== null) {
      return second;
    }
    throw new ConflictError("The timeline order changed, reload and retry", {
      code: TIMELINE_ERROR_CODES.reorderConflict,
    });
  }
}
