import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { AuthorsModule } from "../authors/index.js";
import { GenresModule } from "../genres/index.js";
import { MediaModule } from "../media/index.js";
import { SeriesController } from "./api/series.controller.js";
import { SeriesLifecycleService } from "./application/series-lifecycle.service.js";
import { SeriesPurgeProcessor } from "./application/series-purge.processor.js";
import { SeriesPurgeReconciler } from "./application/series-purge.reconciler.js";
import { SeriesPurgeScheduler } from "./application/series-purge.scheduler.js";
import { SeriesService } from "./application/series.service.js";
import { SERIES_PURGE_QUEUE_NAME } from "./domain/series-purge.js";
import { SeriesRepository } from "./infrastructure/series.repository.js";

@Module({
  controllers: [SeriesController],
  exports: [SeriesService],
  imports: [
    AuthModule,
    AuthorsModule,
    GenresModule,
    MediaModule,
    BullModule.registerQueue({ name: SERIES_PURGE_QUEUE_NAME }),
  ],
  providers: [
    SeriesService,
    SeriesLifecycleService,
    SeriesPurgeScheduler,
    SeriesPurgeProcessor,
    SeriesPurgeReconciler,
    SeriesRepository,
  ],
})
export class SeriesModule {}
