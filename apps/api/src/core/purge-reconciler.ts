import { createLogger } from "./logger.js";
import { TRASH_RETENTION } from "./trash-retention.js";

export type PurgeCandidate = { id: string; userId: string };

export type PurgeReconciler = { sweep: () => Promise<void> };

export function createPurgeReconciler({
  findCandidates,
  purge,
  scope,
}: {
  findCandidates: (args: { limit: number; now: Date }) => Promise<PurgeCandidate[]>;
  purge: (candidate: PurgeCandidate) => Promise<void>;
  scope: string;
}): PurgeReconciler {
  const log = createLogger(`${scope}.purge-reconciler`);
  let isRunning = false;

  async function runSweep(): Promise<void> {
    let candidates: PurgeCandidate[];
    try {
      candidates = await findCandidates({
        limit: TRASH_RETENTION.reconcileBatchSize,
        now: new Date(),
      });
    } catch (error) {
      log.error({ err: error }, "purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await purge(candidate);
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error({ entityId: candidate.id, err: error }, "purge reconciliation failed for entity");
      }
    }

    if (purgedIds.length > 0) {
      log.info({ count: purgedIds.length, entityIds: purgedIds }, "reconciled overdue purges");
    }
  }

  return {
    async sweep(): Promise<void> {
      if (isRunning) {
        log.warn("purge reconciliation still running, skipping this tick");
        return;
      }
      isRunning = true;
      try {
        await runSweep();
      } finally {
        isRunning = false;
      }
    },
  };
}
