import { addDays, milliseconds, subDays } from "date-fns";

import { env } from "../config/env.js";

export const TRASH_RETENTION = {
  days: env.trashRetentionDays,
  purgeAfter: (deletedAt: Date): Date => addDays(deletedAt, env.trashRetentionDays),
  purgeDelayMs: milliseconds({ days: env.trashRetentionDays }),
  purgeThreshold: (now: Date): Date => subDays(now, env.trashRetentionDays),
} as const;
