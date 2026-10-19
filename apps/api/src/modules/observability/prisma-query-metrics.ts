import { Injectable, type OnModuleInit, Optional } from "@nestjs/common";

import { env } from "../../config/env.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { createLogger } from "../../core/logger.js";
import { MetricsService } from "./metrics.service.js";

const MILLISECONDS_PER_SECOND = 1_000;

type SlowQueryLogger = {
  warn(record: object, message: string): void;
};

@Injectable()
export class PrismaQueryMetrics implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metricsService: MetricsService,
    @Optional() private readonly log: SlowQueryLogger = createLogger("prisma"),
  ) {}

  onModuleInit(): void {
    this.prisma.onQuery((event) => {
      this.metricsService.dbQueryDurationSeconds.observe(event.duration / MILLISECONDS_PER_SECOND);

      if (event.duration < env.slowQueryThresholdMs) return;

      this.metricsService.dbSlowQueriesTotal.inc();
      this.log.warn({ durationMs: event.duration, query: event.query }, "slow query");
    });
  }
}
