import type { AdvisoryLockInput } from "../../../core/database/advisory-lock.js";

import { ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";

export function characterMergeLockFor(userId: string): AdvisoryLockInput {
  return { classId: ADVISORY_LOCK_CLASS.characterMerge, key: `char-merge:${userId}` };
}
