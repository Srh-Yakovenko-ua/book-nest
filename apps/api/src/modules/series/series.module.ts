import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { SeriesController } from "./api/series.controller.js";
import { SeriesService } from "./application/series.service.js";
import { SeriesRepository } from "./infrastructure/series.repository.js";

@Module({
  controllers: [SeriesController],
  exports: [SeriesService],
  imports: [AuthModule],
  providers: [SeriesService, SeriesRepository],
})
export class SeriesModule {}
