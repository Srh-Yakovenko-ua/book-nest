import type { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { seconds, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { DatabaseModule } from "./core/database/database.module.js";
import { RequestIdMiddleware } from "./core/middleware/request-id.middleware.js";
import { RequestLoggerMiddleware } from "./core/middleware/request-logger.middleware.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { MetricsMiddleware } from "./modules/observability/metrics.middleware.js";
import { MetricsModule } from "./modules/observability/metrics.module.js";
import { ProfileModule } from "./modules/profile/profile.module.js";

const GLOBAL_THROTTLE_TTL_SECONDS = 60;
const GLOBAL_THROTTLE_LIMIT = 120;

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { limit: GLOBAL_THROTTLE_LIMIT, ttl: seconds(GLOBAL_THROTTLE_TTL_SECONDS) },
    ]),
    DatabaseModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    ProfileModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, MetricsMiddleware, RequestLoggerMiddleware)
      .forRoutes("*splat");
  }
}
