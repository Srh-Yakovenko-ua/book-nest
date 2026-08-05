import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { ExclusiveTask } from "../../../core/exclusive-task.js";

import { createExclusiveTask } from "../../../core/exclusive-task.js";
import { createLogger } from "../../../core/logger.js";
import { SessionsRepository } from "../infrastructure/sessions.repository.js";

export const SESSION_CLEANUP = {
  batchSize: 500,
  maxBatchesPerSweep: 20,
} as const satisfies Record<string, number>;

const SWEEP_SCOPE = "auth.session-cleanup";

const log = createLogger(SWEEP_SCOPE);

@Injectable()
export class SessionCleanupReconciler {
  private readonly sweepExclusively: ExclusiveTask;

  constructor(private readonly sessionsRepository: SessionsRepository) {
    this.sweepExclusively = createExclusiveTask({
      run: () => this.runSafely(),
      scope: SWEEP_SCOPE,
    });
  }

  async run({ now }: { now: Date }): Promise<number> {
    let deleted = 0;

    for (let batch = 0; batch < SESSION_CLEANUP.maxBatchesPerSweep; batch += 1) {
      const deletedInBatch = await this.sessionsRepository.deleteExpiredBatch({
        expiredBefore: now,
        limit: SESSION_CLEANUP.batchSize,
      });
      deleted += deletedInBatch;

      if (deletedInBatch < SESSION_CLEANUP.batchSize) {
        return deleted;
      }
    }

    log.warn(
      { deleted },
      "session cleanup hit its per-sweep batch cap, expired sessions remain for the next tick",
    );
    return deleted;
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.sweepExclusively();
  }

  private async runSafely(): Promise<void> {
    try {
      const deleted = await this.run({ now: new Date() });
      if (deleted > 0) {
        log.info({ deleted }, "deleted expired sessions");
      }
    } catch (error) {
      log.error({ err: error }, "session cleanup failed");
    }
  }
}
