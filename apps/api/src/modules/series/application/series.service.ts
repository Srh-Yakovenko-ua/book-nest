import type {
  BookAuthorReference,
  NewSeriesInput,
  Paginator,
  SeriesSearchQuery,
  SeriesView,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { toSeriesView } from "../domain/series.mapper.js";
import { SeriesRepository } from "../infrastructure/series.repository.js";

type ResolvedSeries = {
  id: string;
  totalBooks: null | number;
};

type ResolveSeriesAuthorIdsInput = {
  fallbackAuthorIds: string[] | undefined;
  references: BookAuthorReference[] | undefined;
  userId: string;
};

type ResolveSeriesInput = {
  fallbackAuthorIds?: string[];
  newSeries?: NewSeriesInput;
  seriesId?: string;
  userId: string;
};

@Injectable()
export class SeriesService {
  constructor(
    private readonly seriesRepository: SeriesRepository,
    private readonly authorsService: AuthorsService,
  ) {}

  async resolveForBook(input: ResolveSeriesInput): Promise<ResolvedSeries> {
    const { fallbackAuthorIds, newSeries, seriesId, userId } = input;

    if (seriesId !== undefined) {
      const series = await this.seriesRepository.findOwnedById(userId, seriesId);
      if (series === null) {
        throw new NotFoundError("Series not found");
      }
      return { id: series.id, totalBooks: series.totalBooks };
    }

    if (newSeries === undefined) {
      throw new NotFoundError("Series not found");
    }

    const normalizedName = normalizeName(newSeries.name);
    const existing = await this.seriesRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      return { id: existing.id, totalBooks: existing.totalBooks };
    }

    const authorIds = await this.resolveSeriesAuthorIds({
      fallbackAuthorIds,
      references: newSeries.authors,
      userId,
    });

    try {
      const created = await this.seriesRepository.create({
        authorIds,
        data: {
          description: newSeries.description ?? null,
          name: newSeries.name,
          normalizedName,
          status: newSeries.status,
          totalBooks: newSeries.totalBooks ?? null,
        },
        userId,
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

  async search(userId: string, query: SeriesSearchQuery): Promise<Paginator<SeriesView>> {
    const { authorIds, pageNumber, pageSize, search } = query;

    const [series, totalCount] = await Promise.all([
      this.seriesRepository.searchOwned({
        authorIds,
        query: search,
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
        userId,
      }),
      this.seriesRepository.countOwned({ authorIds, query: search, userId }),
    ]);

    return buildPaginator({
      items: series.map(toSeriesView),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  private async resolveSeriesAuthorIds({
    fallbackAuthorIds,
    references,
    userId,
  }: ResolveSeriesAuthorIdsInput): Promise<string[]> {
    const resolved = await this.authorsService.resolveReferences({
      references: references ?? [],
      userId,
    });
    if (resolved.length > 0) {
      return resolved.map((author) => author.id);
    }

    return fallbackAuthorIds ?? [];
  }
}
