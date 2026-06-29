import type {
  BookAuthorReference,
  BookView,
  CreateBookInput,
  LibraryBooksQuery,
  LibraryOverviewView,
  MediaView,
  OwnershipStatus,
  Paginator,
  QueuePriority,
  ReadingStatus,
  RecentPurchaseStores,
  UpdateBookInput,
} from "@app/shared";

import {
  BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE,
  BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
  collapseSpaces,
  OwnershipStatusSchema,
  ReadingStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BlockUpsert,
  CreateDeliveryInfoData,
  CreateLoanInfoData,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
  LibraryFilter,
  UpdateDeliveryInfoData,
  UpdateLoanInfoData,
  UpdatePurchaseInfoData,
  UpdateReadingProgressData,
} from "../infrastructure/books.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator } from "../../../core/paginator.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { GenresService } from "../../genres/application/genres.service.js";
import { ListsService } from "../../lists/application/lists.service.js";
import { MediaService } from "../../media/application/media.service.js";
import { PublishersService } from "../../publishers/application/publishers.service.js";
import { SeriesService } from "../../series/application/series.service.js";
import { TagsService } from "../../tags/application/tags.service.js";
import {
  buildDeliveryInfoData,
  buildDeliveryInfoUpdateData,
  buildLoanInfoData,
  buildLoanInfoUpdateData,
  buildPurchaseInfoData,
  buildPurchaseInfoUpdateData,
  buildReadingProgressData,
  buildReadingProgressUpdateData,
  ownershipStatusUsesDelivery,
  ownershipStatusUsesLoan,
  ownershipStatusUsesPurchase,
  readingStatusUsesProgress,
} from "../domain/book-blocks.js";
import { toBookView } from "../domain/book.mapper.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";
const DUPLICATE_PART_NUMBER_MESSAGE = "A book with this part number already exists in this series";

const OVERVIEW_TOP_LIMIT = 3;
const OVERVIEW_RECENT_LIMIT = 3;
const READING_IN_PROGRESS_STATUSES: ReadingStatus[] = ["reading", "rereading"];
const FINISHED_STATUSES: ReadingStatus[] = ["finished"];

const log = createLogger("books");

type QueuePlacement = {
  queuePosition: null | number;
  queuePriority: null | QueuePriority;
};

type ScalarFieldKey = keyof Prisma.BookUncheckedUpdateManyInput & keyof UpdateBookInput;

type SeriesPlacement = {
  partNumber: null | number;
  seriesId: null | string;
};

const MIN_SEARCH_LENGTH = 2;
const ISBN_FRAGMENT_PATTERN = /^\d+$/;

function isIsbnFragment(value: string): boolean {
  return ISBN_FRAGMENT_PATTERN.test(value.replace(/[\s-]/g, ""));
}

function normalizeSearchQuery(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const collapsed = collapseSpaces(value);
  if (collapsed.length === 0) {
    return undefined;
  }
  if (collapsed.length < MIN_SEARCH_LENGTH && !isIsbnFragment(collapsed)) {
    return undefined;
  }
  return collapsed;
}

const SCALAR_KEYS = [
  "ageCategory",
  "dedication",
  "description",
  "formats",
  "genres",
  "illustrator",
  "isbn",
  "isFavorite",
  "language",
  "originalTitle",
  "ownershipStatus",
  "pagesCount",
  "publicationYear",
  "readingStatus",
  "title",
  "translator",
] as const satisfies readonly ScalarFieldKey[];

function assignScalarFields(
  fields: Prisma.BookUncheckedUpdateManyInput,
  input: UpdateBookInput,
): void {
  for (const key of SCALAR_KEYS) {
    const value = input[key];
    if (value !== undefined) {
      Object.assign(fields, { [key]: value });
    }
  }
}

function resolveDeliveryBlock(
  ownershipStatus: OwnershipStatus,
  deliveryInfo: UpdateBookInput["deliveryInfo"],
): BlockUpsert<CreateDeliveryInfoData, UpdateDeliveryInfoData> {
  if (!ownershipStatusUsesDelivery(ownershipStatus)) {
    return { delete: true };
  }
  if (deliveryInfo === undefined) {
    return { skip: true };
  }
  return {
    create: buildDeliveryInfoData(deliveryInfo),
    update: buildDeliveryInfoUpdateData(deliveryInfo),
  };
}

function resolveLoanBlock(
  ownershipStatus: OwnershipStatus,
  loanInfo: UpdateBookInput["loanInfo"],
): BlockUpsert<CreateLoanInfoData, UpdateLoanInfoData> {
  if (!ownershipStatusUsesLoan(ownershipStatus)) {
    return { delete: true };
  }
  if (loanInfo === undefined) {
    return { skip: true };
  }
  return {
    create: buildLoanInfoData(loanInfo),
    update: buildLoanInfoUpdateData(loanInfo),
  };
}

function resolvePurchaseBlock(
  ownershipStatus: OwnershipStatus,
  purchaseInfo: UpdateBookInput["purchaseInfo"],
): BlockUpsert<CreatePurchaseInfoData, UpdatePurchaseInfoData> {
  if (!ownershipStatusUsesPurchase(ownershipStatus)) {
    return { delete: true };
  }
  if (purchaseInfo === undefined) {
    return { skip: true };
  }
  return {
    create: buildPurchaseInfoData(purchaseInfo),
    update: buildPurchaseInfoUpdateData(purchaseInfo),
  };
}

function resolveReadingProgressBlock(
  readingStatus: ReadingStatus,
  readingProgress: UpdateBookInput["readingProgress"],
): BlockUpsert<CreateReadingProgressData, UpdateReadingProgressData> {
  if (!readingStatusUsesProgress(readingStatus)) {
    return { delete: true };
  }
  if (readingProgress === undefined) {
    return { skip: true };
  }
  return {
    create: buildReadingProgressData(readingProgress),
    update: buildReadingProgressUpdateData(readingProgress),
  };
}

@Injectable()
export class BooksService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly authorsService: AuthorsService,
    private readonly publishersService: PublishersService,
    private readonly tagsService: TagsService,
    private readonly seriesService: SeriesService,
    private readonly listsService: ListsService,
    private readonly genresService: GenresService,
    private readonly mediaService: MediaService,
  ) {}

  async create(userId: string, input: CreateBookInput): Promise<BookView> {
    const authorId = await this.resolveAuthorId(userId, input.author);

    const publisherId = await this.publishersService.resolveOrCreate(userId, {
      id: input.publisherId,
      name: input.publisherName,
    });

    const tagIds = await this.tagsService.resolveOrCreateMany(userId, input.tags);

    const listIds = await this.listsService.resolveListsForBook(userId, {
      listIds: input.listIds,
      newLists: input.newLists,
    });

    const queuePlacement = await this.resolveQueuePlacement(userId, input);

    const series =
      input.bookType === "series_part"
        ? await this.seriesService.resolveForBook(userId, {
            newSeries: input.newSeries,
            seriesId: input.seriesId,
          })
        : null;
    const seriesId = series?.id ?? null;
    const partNumber = input.bookType === "series_part" ? (input.partNumber ?? null) : null;

    if (input.seriesId !== undefined && series !== null) {
      this.assertPartNumberWithinSeriesTotal({ partNumber, totalBooks: series.totalBooks });
    }
    await this.assertSeriesPartNumberUnique(userId, null, { partNumber, seriesId });
    await this.genresService.assertGenresSelectable(userId, input.genres);

    if (input.coverMediaId != null) {
      await this.mediaService.assertOwned({ id: input.coverMediaId, userId });
    }

    const deliveryInfo =
      ownershipStatusUsesDelivery(input.ownershipStatus) && input.deliveryInfo !== undefined
        ? buildDeliveryInfoData(input.deliveryInfo)
        : null;
    const loanInfo =
      ownershipStatusUsesLoan(input.ownershipStatus) && input.loanInfo !== undefined
        ? buildLoanInfoData(input.loanInfo)
        : null;
    const purchaseInfo =
      ownershipStatusUsesPurchase(input.ownershipStatus) && input.purchaseInfo !== undefined
        ? buildPurchaseInfoData(input.purchaseInfo)
        : null;
    const readingProgress =
      readingStatusUsesProgress(input.readingStatus) && input.readingProgress !== undefined
        ? buildReadingProgressData(input.readingProgress)
        : null;

    const book = await this.booksRepository.create(userId, {
      ageCategory: input.ageCategory,
      authorId,
      coverMediaId: input.coverMediaId ?? null,
      dedication: input.dedication ?? null,
      deliveryInfo,
      description: input.description ?? null,
      formats: input.formats,
      genres: input.genres,
      illustrator: input.illustrator ?? null,
      isbn: input.isbn ?? null,
      isFavorite: input.isFavorite,
      language: input.language,
      listIds,
      loanInfo,
      originalTitle: input.originalTitle ?? null,
      ownershipStatus: input.ownershipStatus,
      pagesCount: input.pagesCount ?? null,
      partNumber,
      publicationYear: input.publicationYear ?? null,
      publisherId,
      purchaseInfo,
      queuePosition: queuePlacement.queuePosition,
      queuePriority: queuePlacement.queuePriority,
      readingProgress,
      readingStatus: input.readingStatus,
      seriesId,
      tagIds,
      title: input.title,
      translator: input.translator ?? null,
    });

    return toBookView(book, this.coverViewOf(book));
  }

  async delete(userId: string, bookId: string): Promise<void> {
    const book = await this.booksRepository.findOwnedById(userId, bookId);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }
    await this.booksRepository.deleteOwned(userId, bookId);
    if (book.coverMediaId !== null) {
      await this.deleteCoverMedia(userId, book.coverMediaId);
    }
  }

  async getById(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedById(userId, bookId);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return toBookView(book, this.coverViewOf(book));
  }

  async list(userId: string, query: LibraryBooksQuery): Promise<Paginator<BookView>> {
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
      isFavorite: query.isFavorite,
      languages: query.language,
      ownershipStatuses: query.owner,
      pagesMax: query.pagesMax,
      pagesMin: query.pagesMin,
      publisherIds: query.publisher,
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
        skip: (pageNumber - 1) * pageSize,
        sort,
        take: pageSize,
      }),
      this.booksRepository.countForLibrary({ filter }),
    ]);

    return buildPaginator({
      items: books.map((book) => toBookView(book, this.coverViewOf(book))),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async overview(userId: string): Promise<LibraryOverviewView> {
    const [total, reading, finished, favorites, topGenreKeys, topTags, recentBooks] =
      await Promise.all([
        this.booksRepository.countByUser(userId),
        this.booksRepository.countByReadingStatuses({
          statuses: READING_IN_PROGRESS_STATUSES,
          userId,
        }),
        this.booksRepository.countByReadingStatuses({ statuses: FINISHED_STATUSES, userId }),
        this.booksRepository.countFavorites(userId),
        this.booksRepository.topGenreKeys({ limit: OVERVIEW_TOP_LIMIT, userId }),
        this.booksRepository.topTags({ limit: OVERVIEW_TOP_LIMIT, userId }),
        this.booksRepository.listRecentlyAdded({ take: OVERVIEW_RECENT_LIMIT, userId }),
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
      recentlyAdded: recentBooks.map((book) => toBookView(book, this.coverViewOf(book))),
      summary: { favorites, finished, reading, total },
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

  async update(userId: string, bookId: string, input: UpdateBookInput): Promise<BookView> {
    const current = await this.booksRepository.findOwnedById(userId, bookId);
    if (current === null) {
      throw new NotFoundError("Book not found");
    }

    const readingStatus = input.readingStatus ?? ReadingStatusSchema.parse(current.readingStatus);
    const ownershipStatus =
      input.ownershipStatus ?? OwnershipStatusSchema.parse(current.ownershipStatus);

    this.assertCurrentPageWithinPages(current, readingStatus, input);
    this.assertLoanPersonNamePresent(current, ownershipStatus, input);

    const fields: Prisma.BookUncheckedUpdateManyInput = {};

    if (input.author !== undefined) {
      fields.authorId = await this.resolveAuthorId(userId, input.author);
    }

    if (input.publisherId !== undefined || input.publisherName !== undefined) {
      fields.publisherId = await this.publishersService.resolveOrCreate(userId, {
        id: input.publisherId,
        name: input.publisherName,
      });
    }

    if (input.coverMediaId !== undefined) {
      if (input.coverMediaId !== null) {
        await this.mediaService.assertOwned({ id: input.coverMediaId, userId });
      }
      fields.coverMediaId = input.coverMediaId;
    }

    const tagIds =
      input.tags === undefined
        ? undefined
        : await this.tagsService.resolveOrCreateMany(userId, input.tags);

    const listIds =
      input.listIds === undefined && input.newLists === undefined
        ? undefined
        : await this.listsService.resolveListsForBook(userId, {
            listIds: input.listIds,
            newLists: input.newLists,
          });

    const seriesPlacement = await this.applySeriesFields(userId, fields, input, current);
    await this.applyQueueFields(userId, current, fields, input);
    await this.assertSeriesPartNumberUnique(userId, bookId, seriesPlacement);

    if (input.genres !== undefined) {
      await this.genresService.assertGenresSelectable(userId, input.genres);
    }

    assignScalarFields(fields, input);

    const book = await this.booksRepository.updateOwned(userId, bookId, {
      deliveryInfo: resolveDeliveryBlock(ownershipStatus, input.deliveryInfo),
      fields,
      listIds,
      loanInfo: resolveLoanBlock(ownershipStatus, input.loanInfo),
      purchaseInfo: resolvePurchaseBlock(ownershipStatus, input.purchaseInfo),
      readingProgress: resolveReadingProgressBlock(readingStatus, input.readingProgress),
      tagIds,
    });

    if (
      input.coverMediaId !== undefined &&
      current.coverMediaId !== null &&
      current.coverMediaId !== input.coverMediaId
    ) {
      await this.deleteCoverMedia(userId, current.coverMediaId);
    }

    return toBookView(book, this.coverViewOf(book));
  }

  private async applyQueueFields(
    userId: string,
    current: BookWithRelations,
    fields: Prisma.BookUncheckedUpdateManyInput,
    input: UpdateBookInput,
  ): Promise<void> {
    const isQueued = current.queuePosition !== null;

    if (input.addToReadingQueue === false) {
      fields.queuePosition = null;
      fields.queuePriority = null;
      return;
    }

    if (input.addToReadingQueue === true && !isQueued) {
      const lastPosition = await this.booksRepository.maxQueuePosition(userId);
      fields.queuePosition = lastPosition + 1;
      fields.queuePriority = input.queuePriority ?? DEFAULT_QUEUE_PRIORITY;
      return;
    }

    if (isQueued && input.queuePriority !== undefined) {
      fields.queuePriority = input.queuePriority;
    }
  }

  private async applySeriesFields(
    userId: string,
    fields: Prisma.BookUncheckedUpdateManyInput,
    input: UpdateBookInput,
    current: BookWithRelations,
  ): Promise<SeriesPlacement> {
    if (input.bookType === undefined) {
      if (current.seriesId !== null && input.partNumber !== undefined) {
        this.assertPartNumberWithinSeriesTotal({
          partNumber: input.partNumber,
          totalBooks: current.series?.totalBooks ?? null,
        });
        fields.partNumber = input.partNumber;
        return { partNumber: input.partNumber, seriesId: current.seriesId };
      }
      return { partNumber: current.partNumber, seriesId: current.seriesId };
    }

    if (input.bookType === "solo") {
      fields.seriesId = null;
      fields.partNumber = null;
      return { partNumber: null, seriesId: null };
    }

    const series = await this.seriesService.resolveForBook(userId, {
      newSeries: input.newSeries,
      seriesId: input.seriesId,
    });
    const partNumber = input.partNumber ?? null;
    if (input.seriesId !== undefined) {
      this.assertPartNumberWithinSeriesTotal({ partNumber, totalBooks: series.totalBooks });
    }
    fields.seriesId = series.id;
    fields.partNumber = partNumber;
    return { partNumber, seriesId: series.id };
  }

  private assertCurrentPageWithinPages(
    current: BookWithRelations,
    readingStatus: ReadingStatus,
    input: UpdateBookInput,
  ): void {
    if (!readingStatusUsesProgress(readingStatus)) {
      return;
    }

    const currentPage =
      input.readingProgress?.currentPage ?? current.readingProgress?.currentPage ?? null;
    const pagesCount = input.pagesCount === undefined ? current.pagesCount : input.pagesCount;

    if (currentPage !== null && pagesCount !== null && currentPage > pagesCount) {
      throw new BadRequestError("Current page cannot exceed the page count", {
        fields: [
          {
            field: "readingProgress.currentPage",
            message: "Current page cannot exceed the page count",
          },
        ],
      });
    }
  }

  private assertLoanPersonNamePresent(
    current: BookWithRelations,
    ownershipStatus: OwnershipStatus,
    input: UpdateBookInput,
  ): void {
    if (!ownershipStatusUsesLoan(ownershipStatus)) {
      return;
    }

    const payloadPersonName = input.loanInfo?.personName ?? "";
    const existingPersonName = current.loanInfo?.personName ?? "";
    if (payloadPersonName.length > 0 || existingPersonName.length > 0) {
      return;
    }

    throw new BadRequestError("Enter the person's name", {
      fields: [{ field: "loanInfo.personName", message: "Enter the person's name" }],
    });
  }

  private assertPartNumberWithinSeriesTotal({
    partNumber,
    totalBooks,
  }: {
    partNumber: null | number;
    totalBooks: null | number;
  }): void {
    if (totalBooks === null || partNumber === null) {
      return;
    }
    if (partNumber > totalBooks) {
      throw new BadRequestError(BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE, {
        fields: [{ field: "partNumber", message: BOOK_PART_NUMBER_EXCEEDS_TOTAL_MESSAGE }],
      });
    }
  }

  private async assertSeriesPartNumberUnique(
    userId: string,
    excludeBookId: null | string,
    placement: SeriesPlacement,
  ): Promise<void> {
    if (placement.seriesId === null || placement.partNumber === null) {
      return;
    }

    const conflict = await this.booksRepository.findSeriesPartNumberConflict(userId, {
      excludeBookId,
      partNumber: placement.partNumber,
      seriesId: placement.seriesId,
    });
    if (conflict !== null) {
      throw new BadRequestError(DUPLICATE_PART_NUMBER_MESSAGE, {
        fields: [
          {
            code: BOOK_SERIES_PART_NUMBER_TAKEN_CODE,
            field: "partNumber",
            message: DUPLICATE_PART_NUMBER_MESSAGE,
            meta: {
              bookId: conflict.id,
              bookTitle: conflict.title,
              partNumber: String(placement.partNumber),
            },
          },
        ],
      });
    }
  }

  private coverViewOf(book: BookWithRelations): MediaView | null {
    if (book.coverMedia === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(book.coverMedia);
    } catch (error) {
      log.warn({ bookId: book.id, err: error }, "failed to build cover view");
      return null;
    }
  }

  private async deleteCoverMedia(userId: string, mediaId: string): Promise<void> {
    try {
      const referencingBooks = await this.booksRepository.countByCoverMediaId(mediaId);
      if (referencingBooks > 0) {
        return;
      }
      await this.mediaService.delete({ id: mediaId, userId });
    } catch (error) {
      log.warn({ err: error, mediaId }, "failed to delete cover media");
    }
  }

  private async resolveAuthorId(userId: string, author: BookAuthorReference): Promise<string> {
    if ("id" in author) {
      return this.authorsService.resolveOrCreate(userId, { id: author.id });
    }

    if ("openLibraryKey" in author) {
      const materialized = await this.authorsService.materializeFromOpenLibrary(
        author.openLibraryKey,
      );
      return materialized.id;
    }

    return this.authorsService.resolveOrCreate(userId, { name: author.name });
  }

  private async resolveQueuePlacement(
    userId: string,
    input: CreateBookInput,
  ): Promise<QueuePlacement> {
    if (!input.addToReadingQueue) {
      return { queuePosition: null, queuePriority: null };
    }

    const lastPosition = await this.booksRepository.maxQueuePosition(userId);
    return {
      queuePosition: lastPosition + 1,
      queuePriority: input.queuePriority ?? DEFAULT_QUEUE_PRIORITY,
    };
  }
}
