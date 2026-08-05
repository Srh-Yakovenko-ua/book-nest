import { TIMELINE_ERROR_CODES } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { EventScalarRow } from "../infrastructure/timeline-event.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { TimelineEventRepository } from "../infrastructure/timeline-event.repository.js";

export async function requireOwnedEvent({
  client,
  eventId,
  repository,
  userId,
}: {
  client?: Prisma.TransactionClient;
  eventId: string;
  repository: TimelineEventRepository;
  userId: string;
}): Promise<EventScalarRow> {
  const event = await repository.findOwnedEvent({ eventId, userId }, client);
  if (event === null) {
    throw new NotFoundError("Event not found", { code: TIMELINE_ERROR_CODES.eventNotFound });
  }
  return event;
}
