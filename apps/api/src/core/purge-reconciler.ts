import { createExclusiveTask } from "./exclusive-task.js";
import { createLogger } from "./logger.js";

export type PurgeCandidate = { id: string; userId: string };

export type PurgeReconciler = { sweep: () => Promise<void> };

export function createPurgeReconciler({
  batchSize,
  findCandidates,
  purge,
  scope,
}: {
  batchSize: number;
  findCandidates: (args: { limit: number; now: Date }) => Promise<PurgeCandidate[]>;
  purge: (candidate: PurgeCandidate) => Promise<void>;
  scope: string;
}): PurgeReconciler {
  const reconcilerScope = `${scope}.purge-reconciler`;
  const log = createLogger(reconcilerScope);

  async function runSweep(): Promise<void> {
    let candidates: PurgeCandidate[];
    try {
      candidates = await findCandidates({ limit: batchSize, now: new Date() });
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

  return { sweep: createExclusiveTask({ run: runSweep, scope: reconcilerScope }) };
}
