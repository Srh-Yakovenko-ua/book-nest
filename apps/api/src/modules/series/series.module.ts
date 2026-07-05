import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { AuthorsModule } from "../authors/index.js";
import { SeriesController } from "./api/series.controller.js";
import { SeriesService } from "./application/series.service.js";
import { SeriesRepository } from "./infrastructure/series.repository.js";

@Module({
  controllers: [SeriesController],
  exports: [SeriesService],
  imports: [AuthModule, AuthorsModule],
  providers: [SeriesService, SeriesRepository],
})
export class SeriesModule {}
