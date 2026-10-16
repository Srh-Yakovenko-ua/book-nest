import { Module } from "@nestjs/common";

import { MetricsController } from "./metrics.controller.js";
import { MetricsMiddleware } from "./metrics.middleware.js";
import { MetricsService } from "./metrics.service.js";
import { PrismaQueryMetrics } from "./prisma-query-metrics.js";

@Module({
  controllers: [MetricsController],
  exports: [MetricsService, MetricsMiddleware],
  providers: [MetricsService, MetricsMiddleware, PrismaQueryMetrics],
})
export class MetricsModule {}
