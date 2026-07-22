import type { Prisma } from "../../generated/prisma/client.js";

export async function acquireUserQueueLock(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
}
