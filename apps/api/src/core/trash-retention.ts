import { addDays, milliseconds } from "date-fns";

import { env } from "../config/env.js";

export type TrashStamp = { deletedAt: Date; purgeAt: Date };

export const TRASH_RETENTION = {
  days: env.trashRetentionDays,
  purgeDelayMs: milliseconds({ days: env.trashRetentionDays }),
  reconcileBatchSize: 100,
  stamp: (deletedAt: Date = new Date()): TrashStamp => ({
    deletedAt,
    purgeAt: addDays(deletedAt, env.trashRetentionDays),
  }),
} as const;
