import type {
  BookAuthorReference,
  BookView,
  CreateBookInput,
  DeliveryInfoInput,
  LoanInfoInput,
  OwnershipStatus,
  PaginationQuery,
  Paginator,
  PurchaseInfoInput,
  QueuePriority,
  ReadingProgressInput,
  ReadingStatus,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type {
  CreateDeliveryInfoData,
  CreateLoanInfoData,
  CreatePurchaseInfoData,
  CreateReadingProgressData,
} from "../infrastructure/books.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator } from "../../../core/paginator.js";
import { AuthorsService } from "../../authors/application/authors.service.js";
import { ListsService } from "../../lists/application/lists.service.js";
import { PublishersService } from "../../publishers/application/publishers.service.js";
import { SeriesService } from "../../series/application/series.service.js";
import { TagsService } from "../../tags/application/tags.service.js";
import { toBookView } from "../domain/book.mapper.js";
import { BooksRepository } from "../infrastructure/books.repository.js";

const STATUSES_WITH_READING_PROGRESS: ReadonlySet<ReadingStatus> = new Set([
  "dnf",
  "finished",
  "paused",
  "reading",
  "rereading",
]);

const OWNERSHIP_STATUSES_WITH_LOAN: ReadonlySet<OwnershipStatus> = new Set([
  "borrowed_from_someone",
  "lent_to_someone",
]);

const DEFAULT_DELIVERY_STATUS = "ordered";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";

type QueuePlacement = {
  queuePosition: null | number;
  queuePriority: null | QueuePriority;
};

const toDate = (value: string | undefined): Date | null =>
  value === undefined ? null : new Date(`${value}T00:00:00.000Z`);

function buildDeliveryInfoData(
  ownershipStatus: OwnershipStatus,
  deliveryInfo: DeliveryInfoInput,
): CreateDeliveryInfoData | null {
  if (ownershipStatus !== "in_transit" || deliveryInfo === undefined) {
    return null;
  }

  return {
    deliveryStatus: deliveryInfo.deliveryStatus ?? DEFAULT_DELIVERY_STATUS,
    expectedDeliveryDate: toDate(deliveryInfo.expectedDeliveryDate),
    note: deliveryInfo.note ?? null,
    orderDate: toDate(deliveryInfo.orderDate),
    orderNumber: deliveryInfo.orderNumber ?? null,
    storeName: deliveryInfo.storeName ?? null,
  };
}

function buildLoanInfoData(
  ownershipStatus: OwnershipStatus,
  loanInfo: LoanInfoInput,
): CreateLoanInfoData | null {
  if (!OWNERSHIP_STATUSES_WITH_LOAN.has(ownershipStatus) || loanInfo === undefined) {
    return null;
  }

  return {
    expectedReturnDate: toDate(loanInfo.expectedReturnDate),
    loanDate: toDate(loanInfo.loanDate),
    note: loanInfo.note ?? null,
    personName: loanInfo.personName,
  };
}

function buildPurchaseInfoData(
  ownershipStatus: OwnershipStatus,
  purchaseInfo: PurchaseInfoInput,
): CreatePurchaseInfoData | null {
  if (ownershipStatus !== "want_to_buy" || purchaseInfo === undefined) {
    return null;
  }

  return {
    currency: purchaseInfo.currency ?? null,
    expectedPrice: purchaseInfo.expectedPrice ?? null,
    note: purchaseInfo.note ?? null,
    storeName: purchaseInfo.storeName ?? null,
    storeUrl: purchaseInfo.storeUrl ?? null,
  };
}

function buildReadingProgressData(
  readingStatus: ReadingStatus,
  readingProgress: ReadingProgressInput,
): CreateReadingProgressData | null {
  if (readingProgress === undefined || !STATUSES_WITH_READING_PROGRESS.has(readingStatus)) {
    return null;
  }

  return {
    abandonedAt: toDate(readingProgress.abandonedAt),
    currentPage: readingProgress.currentPage ?? null,
    finishedAt: toDate(readingProgress.finishedAt),
    impression: readingProgress.impression ?? null,
    note: readingProgress.note ?? null,
    pausedAt: toDate(readingProgress.pausedAt),
    rating: readingProgress.rating ?? null,
    startedAt: toDate(readingProgress.startedAt),
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

    const book = await this.booksRepository.create(userId, {
      ageCategory: input.ageCategory,
      authorId,
      dedication: input.dedication ?? null,
      deliveryInfo: buildDeliveryInfoData(input.ownershipStatus, input.deliveryInfo),
      description: input.description ?? null,
      formats: input.formats,
      genres: input.genres,
      illustrator: input.illustrator ?? null,
      isbn: input.isbn ?? null,
      isFavorite: input.isFavorite,
      language: input.language,
      listIds,
      loanInfo: buildLoanInfoData(input.ownershipStatus, input.loanInfo),
      originalTitle: input.originalTitle ?? null,
      ownershipStatus: input.ownershipStatus,
      pagesCount: input.pagesCount ?? null,
      partNumber,
      publicationYear: input.publicationYear ?? null,
      publisherId,
      purchaseInfo: buildPurchaseInfoData(input.ownershipStatus, input.purchaseInfo),
      queuePosition: queuePlacement.queuePosition,
      queuePriority: queuePlacement.queuePriority,
      readingProgress: buildReadingProgressData(input.readingStatus, input.readingProgress),
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
