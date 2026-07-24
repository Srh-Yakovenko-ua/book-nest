import type { Prisma } from "../../generated/prisma/client.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "./advisory-lock.js";

export async function acquireUserQueueLock(
  userId: string,
  client: Prisma.TransactionClient,
): Promise<void> {
  await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.queue, key: userId }, client);
}
