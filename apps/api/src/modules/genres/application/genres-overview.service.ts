import type { GenresOverviewView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { buildGenresOverview } from "../domain/genres-overview.js";
import { GenreStatsRepository } from "../infrastructure/genre-stats.repository.js";

@Injectable()
export class GenresOverviewService {
  constructor(private readonly genreStatsRepository: GenreStatsRepository) {}

  async overview({ userId }: { userId: string }): Promise<GenresOverviewView> {
    const now = new Date();
    const genres = await this.genreStatsRepository.aggregateGenreOverview(userId);
    return buildGenresOverview({ genres, now });
  }
}
