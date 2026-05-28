import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { Module } from "@nestjs/common";

import { DatabaseModule } from "./core/database/database.module.js";
import { RequestIdMiddleware } from "./core/middleware/request-id.middleware.js";
import { RequestLoggerMiddleware } from "./core/middleware/request-logger.middleware.js";
import { HealthModule } from "./modules/health/health.module.js";
import { MetricsMiddleware } from "./modules/observability/metrics.middleware.js";
import { MetricsModule } from "./modules/observability/metrics.module.js";

@Module({
  imports: [DatabaseModule, HealthModule, MetricsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, MetricsMiddleware, RequestLoggerMiddleware)
      .forRoutes("*splat");
  }
}
