import type {
  NewSeriesInput,
  Paginator,
  SeriesView,
  TaxonomySearchPaginationQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toSeriesView } from "../domain/series.mapper.js";
import { SeriesRepository } from "../infrastructure/series.repository.js";

type ResolvedSeries = {
  id: string;
  totalBooks: null | number;
};

type ResolveSeriesInput = {
  newSeries?: NewSeriesInput;
  seriesId?: string;
};

@Injectable()
export class SeriesService {
  constructor(private readonly seriesRepository: SeriesRepository) {}

  async resolveForBook(userId: string, input: ResolveSeriesInput): Promise<ResolvedSeries> {
    if (input.seriesId !== undefined) {
      const series = await this.seriesRepository.findOwnedById(userId, input.seriesId);
      if (series === null) {
        throw new NotFoundError("Series not found");
      }
      return { id: series.id, totalBooks: series.totalBooks };
    }

    if (input.newSeries === undefined) {
      throw new NotFoundError("Series not found");
    }

    const newSeries = input.newSeries;
    const normalizedName = normalizeName(newSeries.name);
    const existing = await this.seriesRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      return { id: existing.id, totalBooks: existing.totalBooks };
    }

    try {
      const created = await this.seriesRepository.create(userId, {
        description: newSeries.description ?? null,
        name: newSeries.name,
        normalizedName,
        status: newSeries.status,
        totalBooks: newSeries.totalBooks ?? null,
      });
      return { id: created.id, totalBooks: created.totalBooks };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      const winner = await this.seriesRepository.findByNormalized(userId, normalizedName);
      if (winner === null) {
        throw error;
      }
      return { id: winner.id, totalBooks: winner.totalBooks };
    }
  }

  async search(
    userId: string,
    query: TaxonomySearchPaginationQuery,
  ): Promise<Paginator<SeriesView>> {
    const { pageNumber, pageSize, search } = query;

    const [series, totalCount] = await Promise.all([
      this.seriesRepository.searchOwned({
        query: search,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        userId,
      }),
      this.seriesRepository.countOwned(userId, search),
    ]);

    return buildPaginator({
      items: series.map(toSeriesView),
      pageNumber,
      pageSize,
      totalCount,
    });
  }
}
