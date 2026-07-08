import type {
  BookView,
  CreateBookInput,
  FavoritesSummaryView,
  LibraryBooksQuery,
  LibraryOverviewView,
  OwnershipStatus,
  Paginator,
  ReadingStatus,
  RecentPurchaseStores,
  UpdateBookInput,
} from "@app/shared";

import {
  collapseSpaces,
  LoanTypeSchema,
  OwnershipStatusSchema,
  ReadingStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BlockUpsert,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
  DeliveryBlockChange,
  LibraryFilter,
  LoanBlockChange,
  UpdatePurchaseInfoData,
  UpdateReadingProgressData,
} from "../infrastructure/books.repository.js";

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
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookCoverCleanup } from "./book-cover-cleanup.js";
import { BookRelationsResolver } from "./book-relations-resolver.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const OVERVIEW_TOP_LIMIT = 3;
const OVERVIEW_RECENT_LIMIT = 3;
const READING_IN_PROGRESS_STATUSES: ReadingStatus[] = ["reading", "rereading"];
const FINISHED_STATUSES: ReadingStatus[] = ["finished"];

type ScalarFieldKey = keyof Prisma.BookUncheckedUpdateManyInput & keyof UpdateBookInput;

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

@Injectable()
export class BooksService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly relationsResolver: BookRelationsResolver,
    private readonly viewAssembler: BookViewAssembler,
    private readonly coverCleanup: BookCoverCleanup,
    private readonly genresService: GenresService,
  ) {}

  async create(userId: string, input: CreateBookInput): Promise<BookView> {
    const resolved = await this.relationsResolver.resolveForCreate({ input, userId });

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

    let book: BookWithRelations;
    try {
      book = await this.booksRepository.create(userId, {
        ageCategory: input.ageCategory,
        authorIds: resolved.authorIds,
        coverMediaId: input.coverMediaId ?? null,
        dedication: input.dedication ?? null,
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
        readingProgress,
        readingStatus: input.readingStatus,
        seriesId: resolved.seriesId,
        tagIds: resolved.tagIds,
        title: input.title,
        translator: input.translator ?? null,
      });
    } catch (error) {
      throw await this.relationsResolver.mapSeriesPartNumberWriteError({
        error,
        excludeBookId: null,
        placement: { partNumber: resolved.partNumber, seriesId: resolved.seriesId },
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
      recentlyAdded: recentBooks.map((book) => this.viewAssembler.viewOf(book)),
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

    this.assertCurrentPageWithinPages({ current, input, readingStatus });
    this.assertLoanPersonNamePresent({ current, input, ownershipStatus });

    const resolved = await this.relationsResolver.resolveForUpdate({
      bookId,
      current,
      input,
      userId,
    });
    const fields = resolved.fields;
    assignScalarFields(fields, input);

    const now = new Date();
    this.applyFavoriteFields({ current, fields, input, now });

    let book: BookWithRelations;
    try {
      book = await this.booksRepository.updateOwned(userId, bookId, {
        authorIds: resolved.authorIds,
        deliveryInfo: resolveDeliveryBlock(ownershipStatus, input.deliveryInfo, now),
        fields,
        listIds: resolved.listIds,
        loanInfo: resolveLoanBlock(ownershipStatus, input.loanInfo, now),
        purchaseInfo: resolvePurchaseBlock(ownershipStatus, input.purchaseInfo),
        queueRemoval: resolved.queueRemoval,
        readingProgress: resolveReadingProgressBlock(readingStatus, input.readingProgress),
        tagIds: resolved.tagIds,
      });
    } catch (error) {
      throw await this.relationsResolver.mapSeriesPartNumberWriteError({
        error,
        excludeBookId: bookId,
        placement: resolved.seriesPlacement,
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
}
