import type { GenreSummaryView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { buildGenreSummary } from "../domain/genre-summary.js";
import { GenreStatsRepository } from "../infrastructure/genre-stats.repository.js";

@Injectable()
export class GenreSummaryService {
  constructor(private readonly genreStatsRepository: GenreStatsRepository) {}

  async summary({ userId }: { userId: string }): Promise<GenreSummaryView> {
    const [genres, libraryCounts] = await Promise.all([
      this.genreStatsRepository.aggregateGenres(userId),
      this.genreStatsRepository.countLibraryBooks(userId),
    ]);
    return buildGenreSummary({ genres, libraryCounts });
  }
}
