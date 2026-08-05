import type {
  BookView,
  FavoritesSummaryView,
  LibraryBooksQuery,
  LibraryOverviewQuery,
  LibraryOverviewView,
  OwnershipStatus,
  Paginator,
  ReadingStatus,
  RecentPurchaseStores,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { ActiveReadingView } from "../domain/library-overview.js";
import type { LibraryFilter } from "../infrastructure/books.repository.js";

import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import { buildActiveReadingView, intersectOwnership } from "../domain/library-overview.js";
import { normalizeSearchQuery } from "../infrastructure/book-search.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

type LibraryOverviewConfig = {
  readonly borrowedStatuses: OwnershipStatus[];
  readonly finishedStatuses: ReadingStatus[];
  readonly inTransitStatuses: OwnershipStatus[];
  readonly physicalOwnershipStatuses: OwnershipStatus[];
  readonly readingInProgressStatuses: ReadingStatus[];
  readonly recentLimit: number;
  readonly topLimit: number;
  readonly wantToBuyStatuses: OwnershipStatus[];
  readonly wantToReadStatuses: ReadingStatus[];
};

const BORROWED_OWNERSHIP_STATUSES: OwnershipStatus[] = ["borrowed_from_someone", "lent_to_someone"];

const LIBRARY_OVERVIEW: LibraryOverviewConfig = {
  borrowedStatuses: BORROWED_OWNERSHIP_STATUSES,
  finishedStatuses: ["finished"],
  inTransitStatuses: ["in_transit"],
  physicalOwnershipStatuses: ["owned", ...BORROWED_OWNERSHIP_STATUSES],
  readingInProgressStatuses: ["reading", "rereading"],
  recentLimit: 3,
  topLimit: 3,
  wantToBuyStatuses: ["want_to_buy"],
  wantToReadStatuses: ["want_to_read"],
};

@Injectable()
export class BookLibraryReadService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly genresService: GenresService,
  ) {}

  favoritesSummary(userId: string): Promise<FavoritesSummaryView> {
    return this.booksRepository.favoritesSummary({
      finishedStatuses: LIBRARY_OVERVIEW.finishedStatuses,
      readingStatuses: LIBRARY_OVERVIEW.readingInProgressStatuses,
      userId,
      wantToReadStatuses: LIBRARY_OVERVIEW.wantToReadStatuses,
    });
  }

  async list({
    query,
    userId,
  }: {
    query: LibraryBooksQuery;
    userId: string;
  }): Promise<Paginator<BookView>> {
    const { pageNumber, pageSize, sort } = query;
    const search = normalizeSearchQuery(query.q);
    const searchGenreKeys =
      search === undefined
        ? undefined
        : await this.genresService.searchKeys({ query: search, userId });

    const filter: LibraryFilter = {
      ageCategories: query.ageCategory,
      authorIds: query.author,
      bookType: query.bookType,
      formats: query.format,
      genreKeys: query.genre,
      hasCover: query.hasCover,
      hasDedication: query.hasDedication,
      hasRating: query.hasRating,
      isFavorite: query.isFavorite,
      languages: query.language,
      ownershipStatuses: query.owner,
      pagesMax: query.pagesMax,
      pagesMin: query.pagesMin,
      publisherIds: query.publisher,
      publisherPresence: query.publisherPresence,
      ratingMax: query.ratingMax,
      ratingMin: query.ratingMin,
      readingStatuses: query.status,
      search,
      searchGenreKeys,
      tagIds: query.tag,
      userId,
      yearMax: query.yearMax,
      yearMin: query.yearMin,
    };

    const [books, totalCount] = await Promise.all([
      this.booksRepository.listForLibrary({
        filter,
        sort,
        ...pageSlice({ pageNumber, pageSize }),
      }),
      this.booksRepository.countForLibrary({ filter }),
    ]);

    return buildPaginator({
      items: books.map((book) => this.viewAssembler.viewOf(book)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async overview({
    query,
    userId,
  }: {
    query: LibraryOverviewQuery;
    userId: string;
  }): Promise<LibraryOverviewView> {
    const ownershipStatuses = query.owner;
    const [summary, activeReading, topGenreKeys, topTags, recentBooks] = await Promise.all([
      this.buildOverviewSummary({ ownershipStatuses, userId }),
      this.buildActiveReading({ ownershipStatuses, userId }),
      this.booksRepository.topGenreKeys({
        limit: LIBRARY_OVERVIEW.topLimit,
        ownershipStatuses,
        userId,
      }),
      this.booksRepository.topTags({ limit: LIBRARY_OVERVIEW.topLimit, ownershipStatuses, userId }),
      this.booksRepository.listRecentlyAdded({
        ownershipStatuses,
        take: LIBRARY_OVERVIEW.recentLimit,
        userId,
      }),
    ]);

    const genreNames = await this.genresService.findNamesByKeys({
      keys: topGenreKeys.map((genre) => genre.key),
      userId,
    });
    const nameByKey = new Map(genreNames.map((genre) => [genre.key, genre.name]));
    const topGenres = topGenreKeys.map((genre) => ({
      count: genre.count,
      key: genre.key,
      name: nameByKey.get(genre.key) ?? genre.key,
    }));

    return {
      activeReading,
      recentlyAdded: recentBooks.map((book) => this.viewAssembler.viewOf(book)),
      summary,
      topGenres,
      topTags,
    };
  }

  recentPurchaseStores({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<RecentPurchaseStores> {
    return this.booksRepository.recentPurchaseStores({ limit, userId });
  }

  private async buildActiveReading({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<ActiveReadingView> {
    const activeBooks = await this.booksRepository.listActiveReading({
      ownershipStatuses,
      statuses: LIBRARY_OVERVIEW.readingInProgressStatuses,
      userId,
    });
    return buildActiveReadingView(activeBooks);
  }

  private async buildOverviewSummary({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<LibraryOverviewView["summary"]> {
    const [
      total,
      reading,
      finished,
      favorites,
      wantToRead,
      series,
      solo,
      wantToBuy,
      inTransit,
      borrowed,
      authorsCount,
      physicallyAvailable,
      seriesCount,
    ] = await Promise.all([
      this.booksRepository.countByUser({ ownershipStatuses, userId }),
      this.booksRepository.countByReadingStatuses({
        ownershipStatuses,
        statuses: LIBRARY_OVERVIEW.readingInProgressStatuses,
        userId,
      }),
      this.booksRepository.countByReadingStatuses({
        ownershipStatuses,
        statuses: LIBRARY_OVERVIEW.finishedStatuses,
        userId,
      }),
      this.booksRepository.countFavorites({ ownershipStatuses, userId }),
      this.booksRepository.countByReadingStatuses({
        ownershipStatuses,
        statuses: LIBRARY_OVERVIEW.wantToReadStatuses,
        userId,
      }),
      this.booksRepository.countForLibrary({
        filter: { bookType: "series_part", ownershipStatuses, userId },
      }),
      this.booksRepository.countForLibrary({
        filter: { bookType: "solo", ownershipStatuses, userId },
      }),
      this.booksRepository.countByUser({
        ownershipStatuses: LIBRARY_OVERVIEW.wantToBuyStatuses,
        userId,
      }),
      this.booksRepository.countByUser({
        ownershipStatuses: LIBRARY_OVERVIEW.inTransitStatuses,
        userId,
      }),
      this.booksRepository.countByUser({
        ownershipStatuses: LIBRARY_OVERVIEW.borrowedStatuses,
        userId,
      }),
      this.booksRepository.countDistinctAuthors({ ownershipStatuses, userId }),
      this.booksRepository.countByUser({
        ownershipStatuses: intersectOwnership({
          allowed: LIBRARY_OVERVIEW.physicalOwnershipStatuses,
          scope: ownershipStatuses,
        }),
        userId,
      }),
      this.booksRepository.countDistinctSeries({ ownershipStatuses, userId }),
    ]);

    return {
      authorsCount,
      borrowed,
      favorites,
      finished,
      inTransit,
      physicallyAvailable,
      reading,
      series,
      seriesCount,
      solo,
      total,
      wantToBuy,
      wantToRead,
    };
  }
}
