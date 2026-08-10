import type { Prisma } from "../../generated/prisma/client.js";

export const ADVISORY_LOCK_CLASS = Object.freeze({
  bookLists: 13,
  characterGraphLayouts: 8,
  characterGroups: 6,
  characterMerge: 7,
  characterRelationships: 9,
  listMembership: 4,
  queue: 1,
  reading: 11,
  readingGoals: 14,
  series: 12,
  socialLinks: 10,
  storeLinks: 3,
  tags: 2,
  timeline: 5,
});

type AcquireAdvisoryLockInput = {
  classId: AdvisoryLockClassId;
  key: string;
};

type AdvisoryLockClassId = (typeof ADVISORY_LOCK_CLASS)[keyof typeof ADVISORY_LOCK_CLASS];

export async function acquireAdvisoryLock(
  { classId, key }: AcquireAdvisoryLockInput,
  client: Prisma.TransactionClient,
): Promise<void> {
  await client.$executeRaw`SELECT pg_advisory_xact_lock(${classId}, hashtext(${key}))`;
}
