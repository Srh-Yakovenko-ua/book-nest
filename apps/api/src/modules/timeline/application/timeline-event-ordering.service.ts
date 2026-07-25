import type {
  MoveTimelineEventInput,
  Nullable,
  ReorderTimelineEventInput,
  TimelineEventView,
  TimelineReorderScope,
} from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  EventPositionScope,
  EventScalarRow,
} from "../infrastructure/timeline-event.repository.js";

import { assertNotStale } from "../../../core/assert-not-stale.js";
import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, ValidationError } from "../../../core/exceptions/errors.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { appendPosition, computeSparsePosition } from "../domain/sparse-position.js";
import { toEventView } from "../domain/timeline.mapper.js";
import { TimelineEventRepository } from "../infrastructure/timeline-event.repository.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";
import { requireOwnedEvent } from "./require-owned-event.js";

@Injectable()
export class TimelineEventOrderingService {
  constructor(
    private readonly timelineRepository: TimelineRepository,
    private readonly timelineEventRepository: TimelineEventRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

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

  private assertExpectedUpdatedAt(
    event: EventScalarRow,
    expectedUpdatedAt: string | undefined,
  ): void {
    assertNotStale({
      actual: event.updatedAt,
      expected: expectedUpdatedAt,
      toError: () =>
        new ConflictError("The event changed, reload and retry", {
          code: TIMELINE_ERROR_CODES.reorderConflict,
        }),
    });
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

  private async runOrderWrite<Result>(write: () => Promise<Result>): Promise<Result> {
    try {
      return await write();
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError("The event order changed, reload and retry", {
            code: TIMELINE_ERROR_CODES.reorderConflict,
          }),
      });
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
