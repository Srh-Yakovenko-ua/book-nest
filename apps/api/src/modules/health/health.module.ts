import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { HEALTH_QUEUE_NAME } from "./health-queue.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

@Module({
  controllers: [HealthController],
  imports: [BullModule.registerQueue({ name: HEALTH_QUEUE_NAME })],
  providers: [HealthService],
})
export class HealthModule {}
