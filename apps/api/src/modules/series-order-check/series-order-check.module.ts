import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { ReadingQueueModule } from "../reading-queue/index.js";
import { SeriesOrderCheckController } from "./api/series-order-check.controller.js";
import { SeriesOrderCheckService } from "./application/series-order-check.service.js";
import { SeriesOrderCheckRepository } from "./infrastructure/series-order-check.repository.js";

@Module({
  controllers: [SeriesOrderCheckController],
  imports: [AuthModule, MediaModule, ReadingQueueModule],
  providers: [SeriesOrderCheckService, SeriesOrderCheckRepository],
})
export class SeriesOrderCheckModule {}
