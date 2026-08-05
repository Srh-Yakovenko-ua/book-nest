import type { CreatedEventRelationView, CreateEventRelationInput } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { EventScalarRow } from "../infrastructure/timeline-event.repository.js";

import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { toCreatedRelationView } from "../domain/timeline.mapper.js";
import { TimelineEventRepository } from "../infrastructure/timeline-event.repository.js";
import { requireOwnedEvent } from "./require-owned-event.js";

@Injectable()
export class TimelineRelationService {
  constructor(private readonly timelineEventRepository: TimelineEventRepository) {}

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
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError("This relation already exists", {
            code: TIMELINE_ERROR_CODES.duplicateRelation,
          }),
      });
    }
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

  private requireOwnedEvent(userId: string, eventId: string): Promise<EventScalarRow> {
    return requireOwnedEvent({ eventId, repository: this.timelineEventRepository, userId });
  }
}
