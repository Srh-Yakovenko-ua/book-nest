import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { GenresController } from "./api/genres.controller.js";
import { GenreStatsService } from "./application/genre-stats.service.js";
import { GenreSummaryService } from "./application/genre-summary.service.js";
import { GenresOverviewService } from "./application/genres-overview.service.js";
import { GenresService } from "./application/genres.service.js";
import { GenreStatsRepository } from "./infrastructure/genre-stats.repository.js";
import { GenresRepository } from "./infrastructure/genres.repository.js";

@Module({
  controllers: [GenresController],
  exports: [GenresService],
  imports: [AuthModule, MediaModule],
  providers: [
    GenresService,
    GenresRepository,
    GenreStatsService,
    GenreStatsRepository,
    GenreSummaryService,
    GenresOverviewService,
  ],
})
export class GenresModule {}
