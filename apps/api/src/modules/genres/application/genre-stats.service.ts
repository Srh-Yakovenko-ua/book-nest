import type {
  GenreFacetsQuery,
  GenreFacetsView,
  GenresQuery,
  PaginatedGenreStats,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { GenreCoverPreviewRow } from "../infrastructure/genre-stats.repository.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { MediaService } from "../../media/index.js";
import {
  applyGenresDatasetCriteria,
  countGenreQuickFilters,
  listGenreGroups,
  selectGenresResult,
} from "../domain/genre-list.js";
import { toGenreStatsView } from "../domain/genre-stats.mapper.js";
import { GenreStatsRepository } from "../infrastructure/genre-stats.repository.js";

const GENRE_COVER_PREVIEW_LIMIT = 4;

@Injectable()
export class GenreStatsService {
  constructor(
    private readonly genreStatsRepository: GenreStatsRepository,
    private readonly mediaService: MediaService,
  ) {}

  async facets({
    query,
    userId,
  }: {
    query: GenreFacetsQuery;
    userId: string;
  }): Promise<GenreFacetsView> {
    const genres = await this.genreStatsRepository.aggregateGenres(userId);
    return {
      groups: listGenreGroups(genres),
      quickCounts: countGenreQuickFilters(applyGenresDatasetCriteria({ criteria: query, genres })),
    };
  }

  async list({
    query,
    userId,
  }: {
    query: GenresQuery;
    userId: string;
  }): Promise<PaginatedGenreStats> {
    const genres = await this.genreStatsRepository.aggregateGenres(userId);
    const result = selectGenresResult({
      filter: query.filter,
      genres: applyGenresDatasetCriteria({ criteria: query, genres }),
      sort: query.sort,
    });
    const { skip, take } = pageSlice(query);
    const page = result.slice(skip, skip + take);

    const coverRows = await this.genreStatsRepository.listCoverPreviews({
      keys: page.map((genre) => genre.key),
      limitPerGenre: GENRE_COVER_PREVIEW_LIMIT,
      userId,
    });
    const coverUrlsByKey = this.buildCoverUrlsByKey(coverRows);

    return buildPaginator({
      items: page.map((genre) =>
        toGenreStatsView({ coverUrls: coverUrlsByKey.get(genre.key) ?? [], genre }),
      ),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount: result.length,
    });
  }

  private buildCoverUrlsByKey(coverRows: GenreCoverPreviewRow[]): Map<string, string[]> {
    const urlsByKey = new Map<string, string[]>();
    for (const row of coverRows) {
      const thumbUrl = this.mediaService.buildThumbUrlOrNull(row.coverMedia);
      if (thumbUrl === null) {
        continue;
      }
      urlsByKey.set(row.genreKey, [...(urlsByKey.get(row.genreKey) ?? []), thumbUrl]);
    }
    return urlsByKey;
  }
}
