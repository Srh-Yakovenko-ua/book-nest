import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { z } from "zod";

import type {
  ReadingGoalCountedBackfillMode,
  ReadingGoalCountedBackfillOutcome,
} from "../modules/reading-goals/application/reading-goal-counted-backfill.service.js";

import { AppModule } from "../app.module.js";
import { assertNever } from "../core/assert-never.js";
import { createLogger } from "../core/logger.js";
import { ReadingGoalCountedBackfillService } from "../modules/reading-goals/application/reading-goal-counted-backfill.service.js";

const log = createLogger("backfill-reading-goal-ordinals");

const BACKFILL_ARGUMENT = {
  apply: "--apply",
  separator: "--",
} as const;

const BackfillArgumentsSchema = z
  .array(z.enum([BACKFILL_ARGUMENT.apply, BACKFILL_ARGUMENT.separator]))
  .transform((values): ReadingGoalCountedBackfillMode =>
    values.includes(BACKFILL_ARGUMENT.apply) ? "apply" : "dry_run",
  );

type OutcomeTally = Record<ReadingGoalCountedBackfillOutcome["status"], number>;

async function backfillReadingGoalOrdinals(argumentValues: string[]): Promise<void> {
  const mode = BackfillArgumentsSchema.parse(argumentValues);
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const outcomes = await app
      .get(ReadingGoalCountedBackfillService)
      .run({ mode, now: new Date() });
    const tally: OutcomeTally = { applied: 0, planned: 0, skipped: 0, unchanged: 0 };
    for (const outcome of outcomes) {
      tally[outcome.status] += 1;
      reportOutcome(outcome);
    }
    log.info({ mode, tally }, "reading goal ordinal backfill complete");
  } finally {
    await app.close();
  }
}

function reportOutcome(outcome: ReadingGoalCountedBackfillOutcome): void {
  switch (outcome.status) {
    case "applied":
    case "planned":
      log.info(
        { changes: outcome.changes, goalId: outcome.goalId, status: outcome.status },
        "book_counted ordinals differ from the replayed history",
      );
      return;
    case "skipped":
      log.warn(
        { goalId: outcome.goalId, skip: outcome.skip },
        "goal history is ambiguous, left untouched",
      );
      return;
    case "unchanged":
      return;
    default:
      assertNever(outcome);
  }
}

backfillReadingGoalOrdinals(process.argv.slice(2))
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    log.error({ err: error }, "reading goal ordinal backfill crashed");
    process.exit(1);
  });
