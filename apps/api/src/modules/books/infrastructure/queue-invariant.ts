import { CLOSED_READING_STATUSES, isClosedReadingStatus, ReadingStatusSchema } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

import { acquireUserQueueLock } from "../../../core/database/queue-lock.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

export async function enforceQueueInvariant(
  client: Prisma.TransactionClient,
  args: { readingStatus: string | undefined; userId: string },
): Promise<void> {
  if (args.readingStatus === undefined) {
    return;
  }
  if (!isClosedReadingStatus(ReadingStatusSchema.parse(args.readingStatus))) {
    return;
  }

  await acquireUserQueueLock(args.userId, client);

  const clearedCount = await clearClosedQueuePlacements(client, args.userId);
  if (clearedCount === 0) {
    return;
  }

  await resequenceQueue(client, args.userId);
}

async function clearClosedQueuePlacements(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<number> {
  const { count } = await client.book.updateMany({
    data: {
      queuePosition: null,
      queuePriority: null,
      queuePriorityReason: null,
      queuePriorityReasonCustomText: null,
      queuePriorityTargetDate: null,
    },
    where: {
      ...SOFT_DELETE_SCOPE.active,
      queuePosition: { not: null },
      readingStatus: { in: [...CLOSED_READING_STATUSES] },
      userId,
    },
  });
  return count;
}

async function resequenceQueue(client: Prisma.TransactionClient, userId: string): Promise<void> {
  await client.$executeRaw`
    UPDATE books b
    SET queue_position = ranked.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY queue_position) AS rn
      FROM books
      WHERE user_id = ${userId}::uuid AND queue_position IS NOT NULL AND deleted_at IS NULL
    ) ranked
    WHERE b.id = ranked.id AND b.queue_position <> ranked.rn
  `;
}
