import type {
  BookAuthorReference,
  FavoriteSeriesContinuationsQuery,
  FavoriteSeriesContinuationsView,
  MediaView,
  NewSeriesInput,
  Nullable,
  Paginator,
  SeriesCoverPreview,
  SeriesDetailsView,
  SeriesOverviewView,
  SeriesSearchQuery,
  SeriesStatus,
  SeriesView,
  UpdateSeriesInput,
} from "@app/shared";

import {
  normalizeName,
  OwnershipStatusSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
  SeriesStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { differenceInMilliseconds } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ContinuationBook,
  ContinuationSeriesGroup,
} from "../domain/favorite-continuations.js";
import type { SeriesBookPreview } from "../domain/series-preview.js";
import type {
  FavoriteContinuationBookRow,
  SeriesWithBookCount,
} from "../infrastructure/series.repository.js";

import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { startOfUtcDay } from "../../../core/iso-date.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { AuthorsService } from "../../authors/index.js";
import { GenresService } from "../../genres/index.js";
import { MediaService } from "../../media/index.js";
import { assembleContinuations } from "../domain/favorite-continuations.js";
import {
  compareByPartThenCreated,
  computeSeriesLastActivityAt,
  countFinishedBooks,
  toSeriesBookPreview,
} from "../domain/series-preview.js";
import {
  computeSeriesProgress,
  isSeriesFullyRead,
  isSeriesUnfinished,
} from "../domain/series-progress.js";
import { toSeriesDetailsView, toSeriesView } from "../domain/series.mapper.js";
import { SeriesRepository } from "../infrastructure/series.repository.js";

const SERIES_NAME_TAKEN_MESSAGE = "Series with this name already exists";
const SERIES_TOTAL_BELOW_BOOKS_MESSAGE =
  "Total books cannot be less than the number of books already in the series";
const SERIES_TOTAL_BELOW_PART_MESSAGE = "Total books cannot be less than an existing part number";
const SERIES_LIST_LIMITS = {
  coverPreview: 3,
  overviewTop: 3,
} as const;

type DecoratedSeries = {
  books: SeriesBookPreview[];
  series: SeriesWithBookCount;
};

type ResolvedSeries = {
  id: string;
  totalBooks: Nullable<number>;
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
    private readonly genresService: GenresService,
    private readonly mediaService: MediaService,
  ) {}

  async create(userId: string, input: NewSeriesInput): Promise<SeriesView> {
    const normalizedName = normalizeName(input.name);
    const existing = await this.seriesRepository.findByNormalized(userId, normalizedName);
    if (existing !== null) {
      throw new ConflictError(SERIES_NAME_TAKEN_MESSAGE);
    }

    await this.genresService.assertGenresSelectable(userId, input.genres);

    const authorIds = await this.resolveSeriesAuthorIds({
      fallbackAuthorIds: undefined,
      references: input.authors,
      userId,
    });

    try {
      const created = await this.seriesRepository.create({
        authorIds,
        data: {
          description: input.description ?? null,
          genres: input.genres,
          name: input.name,
          normalizedName,
          status: input.status,
          totalBooks: input.totalBooks ?? null,
        },
        userId,
      });
      return toSeriesView({
        covers: this.buildSeriesCoverPreviews(created.books),
        series: created,
      });
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError(SERIES_NAME_TAKEN_MESSAGE),
      });
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.seriesRepository.deleteOwned(userId, id);
  }

  async existsOwned({ seriesId, userId }: { seriesId: string; userId: string }): Promise<boolean> {
    const series = await this.seriesRepository.findOwnedById(userId, seriesId);
    return series !== null;
  }

  async favoriteContinuations(
    userId: string,
    query: FavoriteSeriesContinuationsQuery,
  ): Promise<FavoriteSeriesContinuationsView> {
    const rows = await this.seriesRepository.findFavoriteContinuationBooks(userId);
    const items = assembleContinuations(this.toContinuationGroups(rows));

    return {
      items: items.slice(0, query.limit),
      nextCursor: null,
      total: items.length,
    };
  }

  async getById(userId: string, id: string): Promise<SeriesDetailsView> {
    const series = await this.seriesRepository.findOwnedDetailsById(userId, id);
    if (series === null) {
      throw new NotFoundError("Series not found");
    }
    const covers = new Map<string, Nullable<MediaView>>(
      series.books.map((book) => [book.id, this.mediaService.buildViewOrNull(book.coverMedia)]),
    );
    return toSeriesDetailsView({ covers, series, today: startOfUtcDay(new Date()) });
  }

  async overview(userId: string): Promise<SeriesOverviewView> {
    const [allSeries, booksInSeries] = await Promise.all([
      this.seriesRepository.findAllOwned(userId),
      this.seriesRepository.countBooksInSeries(userId),
    ]);

    const decorated = allSeries.map((series) => ({
      books: series.books.map(toSeriesBookPreview),
      series,
    }));

    const unfinished = decorated.filter((entry) =>
      isSeriesUnfinished({ books: entry.books, totalBooks: entry.series.totalBooks }),
    );

    const finishedBooksInSeries = decorated.reduce(
      (sum, entry) => sum + countFinishedBooks(entry.books),
      0,
    );
    const booksLeftInUnfinishedSeries = unfinished.reduce(
      (sum, entry) => sum + (entry.books.length - countFinishedBooks(entry.books)),
      0,
    );

    const statusCounts: Record<SeriesStatus, number> = { completed: 0, ongoing: 0, unknown: 0 };
    for (const series of allSeries) {
      statusCounts[SeriesStatusSchema.parse(series.status)] += 1;
    }

    const topUnfinished = [...unfinished]
      .sort(compareByUnfinishedRank)
      .slice(0, SERIES_LIST_LIMITS.overviewTop)
      .map((entry) =>
        toSeriesView({
          covers: this.buildSeriesCoverPreviews(entry.series.books),
          series: entry.series,
        }),
      );

    return {
      booksInSeries,
      booksLeftInUnfinishedSeries,
      finishedBooksInSeries,
      fullyReadSeries: decorated.filter((entry) =>
        isSeriesFullyRead({ books: entry.books, totalBooks: entry.series.totalBooks }),
      ).length,
      statusCounts,
      topUnfinished,
      totalSeries: allSeries.length,
      unfinishedSeries: unfinished.length,
    };
  }

  async resolveForBook(
    input: ResolveSeriesInput,
    client?: Prisma.TransactionClient,
  ): Promise<ResolvedSeries> {
    const { fallbackAuthorIds, newSeries, seriesId, userId } = input;

    if (seriesId !== undefined) {
      const series = await this.seriesRepository.findOwnedById(userId, seriesId, client);
      if (series === null) {
        throw new NotFoundError("Series not found");
      }
      return { id: series.id, totalBooks: series.totalBooks };
    }

    if (newSeries === undefined) {
      throw new NotFoundError("Series not found");
    }

    const normalizedName = normalizeName(newSeries.name);
    const existing = await this.seriesRepository.findByNormalized(userId, normalizedName, client);
    if (existing !== null) {
      return { id: existing.id, totalBooks: existing.totalBooks };
    }

    await this.genresService.assertGenresSelectable(userId, newSeries.genres);

    const authorIds = await this.resolveSeriesAuthorIds({
      fallbackAuthorIds,
      references: newSeries.authors,
      userId,
    });

    const created = await this.seriesRepository.upsertByNormalized(
      {
        authorIds,
        data: {
          description: newSeries.description ?? null,
          genres: newSeries.genres,
          name: newSeries.name,
          normalizedName,
          status: newSeries.status,
          totalBooks: newSeries.totalBooks ?? null,
        },
        userId,
      },
      client,
    );
    return { id: created.id, totalBooks: created.totalBooks };
  }

  async search(userId: string, query: SeriesSearchQuery): Promise<Paginator<SeriesView>> {
    const { authorIds, pageNumber, pageSize, search } = query;

    const [series, totalCount] = await Promise.all([
      this.seriesRepository.searchOwned({
        authorIds,
        query: search,
        userId,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.seriesRepository.countOwned({ authorIds, query: search, userId }),
    ]);

    return buildPaginator({
      items: series.map((seriesRow) =>
        toSeriesView({
          covers: this.buildSeriesCoverPreviews(seriesRow.books),
          series: seriesRow,
        }),
      ),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async update(userId: string, id: string, input: UpdateSeriesInput): Promise<SeriesView> {
    const current = await this.seriesRepository.findOwnedWithCountById(userId, id);
    if (current === null) {
      throw new NotFoundError("Series not found");
    }

    if (input.totalBooks !== undefined && input.totalBooks !== null) {
      this.assertTotalBooksNotBelowExisting({ series: current, totalBooks: input.totalBooks });
    }

    const fields: Prisma.SeriesUncheckedUpdateManyInput = {};

    if (input.name !== undefined) {
      const normalizedName = normalizeName(input.name);
      await this.assertNameAvailable({ excludeId: id, normalizedName, userId });
      fields.name = input.name;
      fields.normalizedName = normalizedName;
    }
    if (input.status !== undefined) {
      fields.status = input.status;
    }
    if (input.totalBooks !== undefined) {
      fields.totalBooks = input.totalBooks;
    }
    if (input.description !== undefined) {
      fields.description = input.description;
    }
    if (input.genres !== undefined) {
      await this.genresService.assertGenresSelectable(userId, input.genres);
      fields.genres = input.genres;
    }

    let authorIds: string[] | undefined;
    if (input.authors !== undefined) {
      const authors = await this.authorsService.resolveReferences({
        references: input.authors,
        userId,
      });
      authorIds = authors.map((author) => author.id);
    }

    try {
      const updated = await this.seriesRepository.updateOwned(userId, id, { authorIds, fields });
      return toSeriesView({
        covers: this.buildSeriesCoverPreviews(updated.books),
        series: updated,
      });
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError(SERIES_NAME_TAKEN_MESSAGE),
      });
    }
  }

  private async assertNameAvailable({
    excludeId,
    normalizedName,
    userId,
  }: {
    excludeId: string;
    normalizedName: string;
    userId: string;
  }): Promise<void> {
    const existing = await this.seriesRepository.findByNormalized(userId, normalizedName);
    if (existing !== null && existing.id !== excludeId) {
      throw new ConflictError(SERIES_NAME_TAKEN_MESSAGE);
    }
  }

  private assertTotalBooksNotBelowExisting({
    series,
    totalBooks,
  }: {
    series: SeriesWithBookCount;
    totalBooks: number;
  }): void {
    if (totalBooks < series._count.books) {
      throw new ValidationError(SERIES_TOTAL_BELOW_BOOKS_MESSAGE);
    }

    const maxPartNumber = series.books.reduce(
      (max, book) => (book.partNumber !== null && book.partNumber > max ? book.partNumber : max),
      0,
    );
    if (totalBooks < maxPartNumber) {
      throw new ValidationError(SERIES_TOTAL_BELOW_PART_MESSAGE);
    }
  }

  private buildSeriesCoverPreviews(books: SeriesWithBookCount["books"]): SeriesCoverPreview[] {
    return [...books]
      .sort(compareByPartThenCreated)
      .flatMap((book) => {
        const cover = this.mediaService.buildViewOrNull(book.coverMedia);
        return cover === null ? [] : [{ bookId: book.id, cover, title: book.title }];
      })
      .slice(0, SERIES_LIST_LIMITS.coverPreview);
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

  private toContinuationBook(row: FavoriteContinuationBookRow): ContinuationBook {
    return {
      authors: row.authors.map((bookAuthor) => ({
        id: bookAuthor.author.id,
        name: bookAuthor.author.name,
      })),
      cover: this.mediaService.buildViewOrNull(row.coverMedia),
      createdAt: row.createdAt,
      currentPage: row.readingProgress?.currentPage ?? null,
      favoriteAddedAt: row.favoriteAddedAt,
      id: row.id,
      isFavorite: row.isFavorite,
      ownershipStatus: OwnershipStatusSchema.parse(row.ownershipStatus),
      pagesCount: row.pagesCount,
      partNumber: row.partNumber,
      queuePosition: row.queuePosition,
      queuePriority:
        row.queuePriority === null ? null : QueuePrioritySchema.parse(row.queuePriority),
      readingStatus: ReadingStatusSchema.parse(row.readingStatus),
      title: row.title,
    };
  }

  private toContinuationGroups(rows: FavoriteContinuationBookRow[]): ContinuationSeriesGroup[] {
    const groups = new Map<string, ContinuationSeriesGroup>();

    for (const row of rows) {
      if (row.series === null) {
        continue;
      }

      const book = this.toContinuationBook(row);
      const existing = groups.get(row.series.id);
      if (existing === undefined) {
        groups.set(row.series.id, {
          books: [book],
          series: {
            id: row.series.id,
            status: SeriesStatusSchema.parse(row.series.status),
            title: row.series.name,
            totalBooks: row.series.totalBooks,
          },
        });
        continue;
      }

      existing.books.push(book);
    }

    return [...groups.values()];
  }
}

function compareByUnfinishedRank(first: DecoratedSeries, second: DecoratedSeries): number {
  const progressDiff =
    computeSeriesProgress({ books: second.books, totalBooks: second.series.totalBooks }) -
    computeSeriesProgress({ books: first.books, totalBooks: first.series.totalBooks });
  if (progressDiff !== 0) {
    return progressDiff;
  }

  return differenceInMilliseconds(
    computeSeriesLastActivityAt({
      books: second.books,
      seriesUpdatedAt: second.series.updatedAt,
    }),
    computeSeriesLastActivityAt({
      books: first.books,
      seriesUpdatedAt: first.series.updatedAt,
    }),
  );
}
