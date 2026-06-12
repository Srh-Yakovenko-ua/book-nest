import type {
  BookAuthorReference,
  BookView,
  CreateBookInput,
  OwnershipStatus,
  PaginationQuery,
  Paginator,
  QueuePriority,
  ReadingStatus,
  UpdateBookInput,
} from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BlockUpsert,
  CreateDeliveryInfoData,
  CreateLoanInfoData,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
  UpdateDeliveryInfoData,
  UpdateLoanInfoData,
  UpdatePurchaseInfoData,
  UpdateReadingProgressData,
} from "../infrastructure/books.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator } from "../../../core/paginator.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { ListsService } from "../../lists/application/lists.service.js";
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
  ownershipStatusUsesLoan,
  readingStatusUsesProgress,
} from "../domain/book-blocks.js";
import { toBookView } from "../domain/book.mapper.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";

type QueuePlacement = {
  queuePosition: null | number;
  queuePriority: null | QueuePriority;
};

function assignScalarFields(
  fields: Prisma.BookUncheckedUpdateManyInput,
  input: UpdateBookInput,
): void {
  if (input.ageCategory !== undefined) {
    fields.ageCategory = input.ageCategory;
  }
  if (input.dedication !== undefined) {
    fields.dedication = input.dedication;
  }
  if (input.description !== undefined) {
    fields.description = input.description;
  }
  if (input.formats !== undefined) {
    fields.formats = input.formats;
  }
  if (input.genres !== undefined) {
    fields.genres = input.genres;
  }
  if (input.illustrator !== undefined) {
    fields.illustrator = input.illustrator;
  }
  if (input.isbn !== undefined) {
    fields.isbn = input.isbn;
  }
  if (input.isFavorite !== undefined) {
    fields.isFavorite = input.isFavorite;
  }
  if (input.language !== undefined) {
    fields.language = input.language;
  }
  if (input.originalTitle !== undefined) {
    fields.originalTitle = input.originalTitle;
  }
  if (input.ownershipStatus !== undefined) {
    fields.ownershipStatus = input.ownershipStatus;
  }
  if (input.pagesCount !== undefined) {
    fields.pagesCount = input.pagesCount;
  }
  if (input.publicationYear !== undefined) {
    fields.publicationYear = input.publicationYear;
  }
  if (input.readingStatus !== undefined) {
    fields.readingStatus = input.readingStatus;
  }
  if (input.title !== undefined) {
    fields.title = input.title;
  }
  if (input.translator !== undefined) {
    fields.translator = input.translator;
  }
}

function resolveDeliveryBlock(
  ownershipStatus: OwnershipStatus,
  deliveryInfo: UpdateBookInput["deliveryInfo"],
): BlockUpsert<CreateDeliveryInfoData, UpdateDeliveryInfoData> {
  if (ownershipStatus !== "in_transit") {
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
  if (ownershipStatus !== "want_to_buy") {
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

    const seriesId =
      input.bookType === "series_part"
        ? await this.seriesService.resolveForBook(userId, {
            newSeries: input.newSeries,
            seriesId: input.seriesId,
          })
        : null;
    const partNumber = input.bookType === "series_part" ? (input.partNumber ?? null) : null;

    const deliveryInfo =
      input.ownershipStatus === "in_transit" && input.deliveryInfo !== undefined
        ? buildDeliveryInfoData(input.deliveryInfo)
        : null;
    const loanInfo =
      ownershipStatusUsesLoan(input.ownershipStatus) && input.loanInfo !== undefined
        ? buildLoanInfoData(input.loanInfo)
        : null;
    const purchaseInfo =
      input.ownershipStatus === "want_to_buy" && input.purchaseInfo !== undefined
        ? buildPurchaseInfoData(input.purchaseInfo)
        : null;
    const readingProgress =
      readingStatusUsesProgress(input.readingStatus) && input.readingProgress !== undefined
        ? buildReadingProgressData(input.readingProgress)
        : null;

    const book = await this.booksRepository.create(userId, {
      ageCategory: input.ageCategory,
      authorId,
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

    return toBookView(book);
  }

  async delete(userId: string, bookId: string): Promise<void> {
    const deletedCount = await this.booksRepository.deleteOwned(userId, bookId);
    if (deletedCount === 0) {
      throw new NotFoundError("Book not found");
    }
  }

  async getById(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedById(userId, bookId);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return toBookView(book);
  }

  async list(userId: string, pagination: PaginationQuery): Promise<Paginator<BookView>> {
    const { pageNumber, pageSize, sortDirection } = pagination;

    const [books, totalCount] = await Promise.all([
      this.booksRepository.listByUser({
        skip: (pageNumber - 1) * pageSize,
        sortDirection,
        take: pageSize,
        userId,
      }),
      this.booksRepository.countByUser(userId),
    ]);

    return buildPaginator({
      items: books.map(toBookView),
      pageNumber,
      pageSize,
      totalCount,
    });
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

    await this.applySeriesFields(userId, fields, input);

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

    return toBookView(book);
  }

  private async applySeriesFields(
    userId: string,
    fields: Prisma.BookUncheckedUpdateManyInput,
    input: UpdateBookInput,
  ): Promise<void> {
    if (input.bookType === undefined) {
      return;
    }

    if (input.bookType === "solo") {
      fields.seriesId = null;
      fields.partNumber = null;
      return;
    }

    fields.seriesId = await this.seriesService.resolveForBook(userId, {
      newSeries: input.newSeries,
      seriesId: input.seriesId,
    });
    fields.partNumber = input.partNumber ?? null;
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
