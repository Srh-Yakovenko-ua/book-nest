import type { GenresOverviewView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { toIsoDate } from "../../../core/iso-date.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { buildGenresOverview } from "../domain/genres-overview.js";
import { GenreStatsRepository } from "../infrastructure/genre-stats.repository.js";

@Injectable()
export class GenresOverviewService {
  constructor(
    private readonly genreStatsRepository: GenreStatsRepository,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async overview({ userId }: { userId: string }): Promise<GenresOverviewView> {
    const [{ timeZone, today }, genres] = await Promise.all([
      this.userSettingsContextService.calendar({ now: new Date(), userId }),
      this.genreStatsRepository.aggregateGenreOverview(userId),
    ]);
    return buildGenresOverview({ genres, timeZone, todayIsoDate: toIsoDate(today) });
  }
}
