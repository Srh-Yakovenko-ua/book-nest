import { Module } from "@nestjs/common";

import { MetricsController } from "./metrics.controller.js";
import { MetricsMiddleware } from "./metrics.middleware.js";
import { MetricsService } from "./metrics.service.js";

@Module({
  controllers: [MetricsController],
  exports: [MetricsService, MetricsMiddleware],
  providers: [MetricsService, MetricsMiddleware],
})
export class MetricsModule {}
