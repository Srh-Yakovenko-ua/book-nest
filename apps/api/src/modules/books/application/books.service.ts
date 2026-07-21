import type {
  BookView,
  CreateBookInput,
  FavoritesSummaryView,
  LibraryBooksQuery,
  LibraryOverviewQuery,
  LibraryOverviewView,
  Nullable,
  OwnershipStatus,
  Paginator,
  ReadingStatus,
  RecentPurchaseStores,
  UpdateBookInput,
} from "@app/shared";

import { LoanTypeSchema, OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ActiveReadingRow,
  BlockUpsert,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
  DeliveryBlockChange,
  LibraryFilter,
  LoanBlockChange,
  UpdatePurchaseInfoData,
  UpdateReadingProgressData,
} from "../infrastructure/books.repository.js";

import {
  HEAVY_TRANSACTION_OPTIONS,
  TransactionRunner,
} from "../../../core/database/transaction-runner.js";
import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator } from "../../../core/paginator.js";
import { GenresService } from "../../genres/index.js";
import {
  buildDeliveryInfoData,
  buildDeliveryInfoUpdateData,
  buildLoanInfoData,
  buildLoanInfoUpdateData,
  buildPurchaseInfoData,
  buildPurchaseInfoUpdateData,
  buildReadingProgressData,
  buildReadingProgressUpdateData,
  ownershipStatusKeepsPurchase,
  ownershipStatusUsesDelivery,
  ownershipStatusUsesLoan,
  readingStatusUsesProgress,
} from "../domain/book-blocks.js";
import { resolveFavoriteChange } from "../domain/favorite.js";
import { normalizeSearchQuery } from "../infrastructure/book-search.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookCoverCleanup } from "./book-cover-cleanup.js";
import { BookRelationsResolver, type SeriesPlacement } from "./book-relations-resolver.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const OVERVIEW_TOP_LIMIT = 3;
const OVERVIEW_RECENT_LIMIT = 3;
const READING_IN_PROGRESS_STATUSES: ReadingStatus[] = ["reading", "rereading"];
const FINISHED_STATUSES: ReadingStatus[] = ["finished"];
const WANT_TO_READ_STATUSES: ReadingStatus[] = ["want_to_read"];
const WANT_TO_BUY_STATUSES: OwnershipStatus[] = ["want_to_buy"];
const IN_TRANSIT_STATUSES: OwnershipStatus[] = ["in_transit"];
const BORROWED_STATUSES: OwnershipStatus[] = ["borrowed_from_someone", "lent_to_someone"];
const PHYSICAL_OWNERSHIP_STATUSES: OwnershipStatus[] = ["owned", ...BORROWED_STATUSES];

type ScalarFieldKey = keyof Prisma.BookUncheckedUpdateManyInput & keyof UpdateBookInput;

const SCALAR_KEYS = [
  "ageCategory",
  "description",
  "formats",
  "genres",
  "illustrator",
  "isbn",
  "language",
  "originalTitle",
  "ownershipStatus",
  "pagesCount",
  "publicationYear",
  "readingStatus",
  "title",
  "translator",
] as const satisfies readonly ScalarFieldKey[];

type ActiveReadingBook = NonNullable<ActiveReadingView>["book"];

type ActiveReadingView = LibraryOverviewView["activeReading"];

@Injectable()
export class BooksService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly relationsResolver: BookRelationsResolver,
    private readonly viewAssembler: BookViewAssembler,
    private readonly coverCleanup: BookCoverCleanup,
    private readonly genresService: GenresService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async create(userId: string, input: CreateBookInput): Promise<BookView> {
    const now = new Date();
    const favoriteChange = resolveFavoriteChange({ current: false, next: input.isFavorite, now });

    const deliveryInfo =
      ownershipStatusUsesDelivery(input.ownershipStatus) && input.deliveryInfo !== undefined
        ? buildDeliveryInfoData(input.deliveryInfo)
        : null;
    const loanInfo =
      ownershipStatusUsesLoan(input.ownershipStatus) && input.loanInfo !== undefined
        ? buildLoanInfoData(input.loanInfo)
        : null;
    const purchaseInfo =
      ownershipStatusKeepsPurchase(input.ownershipStatus) && input.purchaseInfo !== undefined
        ? buildPurchaseInfoData(input.purchaseInfo)
        : null;
    const readingProgress =
      readingStatusUsesProgress(input.readingStatus) && input.readingProgress !== undefined
        ? buildReadingProgressData(input.readingProgress)
        : null;

    const resolvedAuthors = await this.relationsResolver.resolveAuthors({
      references: input.authors,
      userId,
    });

    let placement: SeriesPlacement = { partNumber: null, seriesId: null };
    let book: BookWithRelations;
    try {
      book = await this.transactionRunner.run(async (client) => {
        const resolved = await this.relationsResolver.resolveForCreate(
          { input, resolvedAuthors, userId },
          client,
        );
        placement = { partNumber: resolved.partNumber, seriesId: resolved.seriesId };

        return this.booksRepository.create(
          userId,
          {
            ageCategory: input.ageCategory,
            authorIds: resolved.authorIds,
            coverMediaId: input.coverMediaId ?? null,
            dedication: normalizeDedication(input.dedication ?? null),
            deliveryInfo,
            description: input.description ?? null,
            favoriteAddedAt: favoriteChange?.favoriteAddedAt ?? null,
            firstAuthorName: resolved.firstAuthorName,
            formats: input.formats,
            genres: input.genres,
            illustrator: input.illustrator ?? null,
            isbn: input.isbn ?? null,
            isFavorite: input.isFavorite,
            language: input.language,
            listIds: resolved.listIds,
            loanInfo,
            originalTitle: input.originalTitle ?? null,
            ownershipStatus: input.ownershipStatus,
            pagesCount: input.pagesCount ?? null,
            partNumber: resolved.partNumber,
            publicationYear: input.publicationYear ?? null,
            publisherId: resolved.publisherId,
            purchaseInfo,
            queuePosition: resolved.queuePosition,
            queuePriority: resolved.queuePriority,
            queuePriorityReason: resolved.queuePriorityReason,
            queuePriorityReasonCustomText: resolved.queuePriorityReasonCustomText,
            queuePriorityTargetDate: resolved.queuePriorityTargetDate,
            readingProgress,
            readingStatus: input.readingStatus,
            seriesId: resolved.seriesId,
            tagIds: resolved.tagIds,
            title: input.title,
            translator: input.translator ?? null,
          },
          client,
        );
      }, HEAVY_TRANSACTION_OPTIONS);
    } catch (error) {
      throw await this.relationsResolver.mapSeriesPartNumberWriteError({
        error,
        excludeBookId: null,
        placement,
        userId,
      });
    }

    return this.viewAssembler.viewOf(book);
  }

  async delete(userId: string, bookId: string): Promise<void> {
    const book = await this.booksRepository.findOwnedById(userId, bookId);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }
    await this.booksRepository.deleteOwned(userId, bookId);
    if (book.coverMediaId !== null) {
      await this.coverCleanup.deleteIfOrphaned({ mediaId: book.coverMediaId, userId });
    }
  }

  favoritesSummary(userId: string): Promise<FavoritesSummaryView> {
    return this.booksRepository.favoritesSummary({
      finishedStatuses: FINISHED_STATUSES,
      readingStatuses: READING_IN_PROGRESS_STATUSES,
      userId,
      wantToReadStatuses: WANT_TO_READ_STATUSES,
    });
  }

  async getById(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedById(userId, bookId);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return this.viewAssembler.viewOf(book);
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
      hasRating: query.hasRating,
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
      items: books.map((book) => this.viewAssembler.viewOf(book)),
      pageNumber,
      pageSize,
      totalCount,
    });
  }

  async overview(userId: string, query: LibraryOverviewQuery): Promise<LibraryOverviewView> {
    const ownershipStatuses = query.owner;
    const [summary, activeReading, topGenreKeys, topTags, recentBooks] = await Promise.all([
      this.buildOverviewSummary({ ownershipStatuses, userId }),
      this.buildActiveReading({ ownershipStatuses, userId }),
      this.booksRepository.topGenreKeys({ limit: OVERVIEW_TOP_LIMIT, ownershipStatuses, userId }),
      this.booksRepository.topTags({ limit: OVERVIEW_TOP_LIMIT, ownershipStatuses, userId }),
      this.booksRepository.listRecentlyAdded({
        ownershipStatuses,
        take: OVERVIEW_RECENT_LIMIT,
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

  async update(userId: string, bookId: string, input: UpdateBookInput): Promise<BookView> {
    const current = await this.booksRepository.findOwnedById(userId, bookId);
    if (current === null) {
      throw new NotFoundError("Book not found");
    }

    const readingStatus = input.readingStatus ?? ReadingStatusSchema.parse(current.readingStatus);
    const ownershipStatus =
      input.ownershipStatus ?? OwnershipStatusSchema.parse(current.ownershipStatus);

    this.assertCurrentPageWithinPages({ current, input, readingStatus });
    this.assertLoanPersonNamePresent({ current, input, ownershipStatus });

    const now = new Date();

    const resolvedAuthors =
      input.authors === undefined
        ? undefined
        : await this.relationsResolver.resolveAuthors({ references: input.authors, userId });

    let seriesPlacement: SeriesPlacement = { partNumber: null, seriesId: null };
    let book: BookWithRelations;
    try {
      book = await this.transactionRunner.run(async (client) => {
        const resolved = await this.relationsResolver.resolveForUpdate(
          { bookId, current, input, resolvedAuthors, userId },
          client,
        );
        seriesPlacement = resolved.seriesPlacement;

        const fields = resolved.fields;
        assignScalarFields(fields, input);
        this.applyFavoriteFields({ current, fields, input, now });
        this.applyFavoriteDedicationFields({ fields, input });
        this.applyDedicationFields({ current, fields, input });

        return this.booksRepository.updateOwned(
          userId,
          bookId,
          {
            authorIds: resolved.authorIds,
            deliveryInfo: resolveDeliveryBlock(ownershipStatus, input.deliveryInfo, now),
            fields,
            listIds: resolved.listIds,
            loanInfo: resolveLoanBlock(ownershipStatus, input.loanInfo, now),
            purchaseInfo: resolvePurchaseBlock(ownershipStatus, input.purchaseInfo),
            queueRemoval: resolved.queueRemoval,
            readingProgress: resolveReadingProgressBlock(readingStatus, input.readingProgress),
            tagIds: resolved.tagIds,
          },
          client,
        );
      }, HEAVY_TRANSACTION_OPTIONS);
    } catch (error) {
      throw await this.relationsResolver.mapSeriesPartNumberWriteError({
        error,
        excludeBookId: bookId,
        placement: seriesPlacement,
        userId,
      });
    }

    if (
      input.coverMediaId !== undefined &&
      current.coverMediaId !== null &&
      current.coverMediaId !== input.coverMediaId
    ) {
      await this.coverCleanup.deleteIfOrphaned({ mediaId: current.coverMediaId, userId });
    }

    return this.viewAssembler.viewOf(book);
  }

  private applyDedicationFields({
    current,
    fields,
    input,
  }: {
    current: BookWithRelations;
    fields: Prisma.BookUncheckedUpdateManyInput;
    input: UpdateBookInput;
  }): void {
    const dedication =
      input.dedication === undefined ? current.dedication : normalizeDedication(input.dedication);

    if (input.dedication !== undefined) {
      fields.dedication = dedication;
    }

    if (dedication !== null) {
      return;
    }

    const favoriteAfterPatch = input.isFavoriteDedication ?? current.isFavoriteDedication;
    if (favoriteAfterPatch) {
      fields.isFavoriteDedication = false;
    }
  }

  private applyFavoriteDedicationFields({
    fields,
    input,
  }: {
    fields: Prisma.BookUncheckedUpdateManyInput;
    input: UpdateBookInput;
  }): void {
    if (input.isFavoriteDedication === undefined) {
      return;
    }

    fields.isFavoriteDedication = input.isFavoriteDedication;
  }

  private applyFavoriteFields({
    current,
    fields,
    input,
    now,
  }: {
    current: BookWithRelations;
    fields: Prisma.BookUncheckedUpdateManyInput;
    input: UpdateBookInput;
    now: Date;
  }): void {
    if (input.isFavorite === undefined) {
      return;
    }

    const change = resolveFavoriteChange({
      current: current.isFavorite,
      next: input.isFavorite,
      now,
    });
    if (change === null) {
      return;
    }

    fields.isFavorite = change.isFavorite;
    fields.favoriteAddedAt = change.favoriteAddedAt;
  }

  private assertCurrentPageWithinPages({
    current,
    input,
    readingStatus,
  }: {
    current: BookWithRelations;
    input: UpdateBookInput;
    readingStatus: ReadingStatus;
  }): void {
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

  private assertLoanPersonNamePresent({
    current,
    input,
    ownershipStatus,
  }: {
    current: BookWithRelations;
    input: UpdateBookInput;
    ownershipStatus: OwnershipStatus;
  }): void {
    if (!ownershipStatusUsesLoan(ownershipStatus)) {
      return;
    }

    const payloadPersonName = input.loanInfo?.personName ?? "";
    const existingPersonName = current.loans[0]?.personName ?? "";
    if (payloadPersonName.length > 0 || existingPersonName.length > 0) {
      return;
    }

    throw new BadRequestError("Enter the person's name", {
      fields: [{ field: "loanInfo.personName", message: "Enter the person's name" }],
    });
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
      statuses: READING_IN_PROGRESS_STATUSES,
      userId,
    });
    return buildActiveReading(activeBooks);
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
        statuses: READING_IN_PROGRESS_STATUSES,
        userId,
      }),
      this.booksRepository.countByReadingStatuses({
        ownershipStatuses,
        statuses: FINISHED_STATUSES,
        userId,
      }),
      this.booksRepository.countFavorites({ ownershipStatuses, userId }),
      this.booksRepository.countByReadingStatuses({
        ownershipStatuses,
        statuses: WANT_TO_READ_STATUSES,
        userId,
      }),
      this.booksRepository.countForLibrary({
        filter: { bookType: "series_part", ownershipStatuses, userId },
      }),
      this.booksRepository.countForLibrary({
        filter: { bookType: "solo", ownershipStatuses, userId },
      }),
      this.booksRepository.countByUser({ ownershipStatuses: WANT_TO_BUY_STATUSES, userId }),
      this.booksRepository.countByUser({ ownershipStatuses: IN_TRANSIT_STATUSES, userId }),
      this.booksRepository.countByUser({ ownershipStatuses: BORROWED_STATUSES, userId }),
      this.booksRepository.countDistinctAuthors({ ownershipStatuses, userId }),
      this.booksRepository.countByUser({
        ownershipStatuses: intersectOwnership({
          allowed: PHYSICAL_OWNERSHIP_STATUSES,
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

function buildActiveReading(activeBooks: ActiveReadingRow[]): ActiveReadingView {
  if (activeBooks.length === 0) {
    return undefined;
  }
  const pagesAhead = activeBooks.reduce((total, activeBook) => {
    if (activeBook.pagesCount === null || activeBook.currentPage === null) {
      return total;
    }
    return total + Math.max(0, activeBook.pagesCount - activeBook.currentPage);
  }, 0);
  return { book: resolveSingleActiveBook(activeBooks), pagesAhead };
}

function intersectOwnership({
  allowed,
  scope,
}: {
  allowed: OwnershipStatus[];
  scope?: OwnershipStatus[];
}): OwnershipStatus[] {
  if (scope === undefined) {
    return allowed;
  }
  return allowed.filter((status) => scope.includes(status));
}

function normalizeDedication(value: Nullable<string>): Nullable<string> {
  if (value === null || value.length === 0) {
    return null;
  }
  return value;
}

function resolveDeliveryBlock(
  ownershipStatus: OwnershipStatus,
  deliveryInfo: UpdateBookInput["deliveryInfo"],
  now: Date,
): DeliveryBlockChange {
  if (!ownershipStatusUsesDelivery(ownershipStatus)) {
    return { cancelledAt: now, kind: "cancel" };
  }
  if (deliveryInfo === undefined) {
    return { kind: "skip" };
  }
  return {
    create: buildDeliveryInfoData(deliveryInfo),
    kind: "upsertActive",
    update: buildDeliveryInfoUpdateData(deliveryInfo),
  };
}

function resolveLoanBlock(
  ownershipStatus: OwnershipStatus,
  loanInfo: UpdateBookInput["loanInfo"],
  now: Date,
): LoanBlockChange {
  if (!ownershipStatusUsesLoan(ownershipStatus)) {
    return { kind: "return", returnedAt: now };
  }
  const type = LoanTypeSchema.parse(ownershipStatus);
  if (loanInfo === undefined) {
    return { kind: "syncType", type };
  }
  return {
    create: buildLoanInfoData(loanInfo),
    kind: "upsertActive",
    type,
    update: buildLoanInfoUpdateData(loanInfo),
  };
}

function resolvePurchaseBlock(
  ownershipStatus: OwnershipStatus,
  purchaseInfo: UpdateBookInput["purchaseInfo"],
): BlockUpsert<CreatePurchaseInfoData, UpdatePurchaseInfoData> {
  if (!ownershipStatusKeepsPurchase(ownershipStatus)) {
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

function resolveSingleActiveBook(activeBooks: ActiveReadingRow[]): ActiveReadingBook {
  if (activeBooks.length !== 1) {
    return null;
  }
  const [onlyBook] = activeBooks;
  if (onlyBook === undefined || onlyBook.pagesCount === null) {
    return null;
  }
  return {
    currentPage: onlyBook.currentPage ?? 0,
    id: onlyBook.id,
    pagesCount: onlyBook.pagesCount,
    title: onlyBook.title,
  };
}
