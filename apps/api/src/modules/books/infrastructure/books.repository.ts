import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const withRelations = {
  author: true,
  deliveryInfo: true,
  lists: { include: { list: true } },
  loanInfo: true,
  publisher: true,
  purchaseInfo: true,
  readingProgress: true,
  series: true,
  tags: { include: { tag: true } },
} satisfies Prisma.BookInclude;

export type BookWithRelations = Prisma.BookGetPayload<{
  include: typeof withRelations;
}>;

export type CreateDeliveryInfoData = {
  deliveryStatus: null | string;
  expectedDeliveryDate: Date | null;
  note: null | string;
  orderDate: Date | null;
  orderNumber: null | string;
  storeName: null | string;
};

export type CreateLoanInfoData = {
  expectedReturnDate: Date | null;
  loanDate: Date | null;
  note: null | string;
  personName: string;
};

export type CreatePurchaseInfoData = {
  currency: null | string;
  expectedPrice: null | number;
  note: null | string;
  storeName: null | string;
  storeUrl: null | string;
};

export type CreateReadingProgressData = {
  abandonedAt: Date | null;
  currentPage: null | number;
  finishedAt: Date | null;
  impression: null | string;
  note: null | string;
  pausedAt: Date | null;
  rating: null | number;
  startedAt: Date | null;
};

type CreateBookData = {
  ageCategory: string;
  authorId: string;
  dedication: null | string;
  deliveryInfo: CreateDeliveryInfoData | null;
  description: null | string;
  formats: string[];
  genres: string[];
  illustrator: null | string;
  isbn: null | string;
  isFavorite: boolean;
  language: string;
  listIds: string[];
  loanInfo: CreateLoanInfoData | null;
  originalTitle: null | string;
  ownershipStatus: string;
  pagesCount: null | number;
  partNumber: null | number;
  publicationYear: null | number;
  publisherId: null | string;
  purchaseInfo: CreatePurchaseInfoData | null;
  queuePosition: null | number;
  queuePriority: null | string;
  readingProgress: CreateReadingProgressData | null;
  readingStatus: string;
  seriesId: null | string;
  tagIds: string[];
  title: string;
  translator: null | string;
};

type ListBooksInput = {
  skip: number;
  sortDirection: Prisma.SortOrder;
  take: number;
  userId: string;
};

@Injectable()
export class BooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  countByUser(userId: string): Promise<number> {
    return this.prisma.book.count({ where: { userId } });
  }

  create(userId: string, data: CreateBookData): Promise<BookWithRelations> {
    const { deliveryInfo, listIds, loanInfo, purchaseInfo, readingProgress, tagIds, ...bookData } =
      data;
    return this.prisma.book.create({
      data: {
        ...bookData,
        deliveryInfo: deliveryInfo === null ? undefined : { create: deliveryInfo },
        lists: { create: listIds.map((listId) => ({ listId })) },
        loanInfo: loanInfo === null ? undefined : { create: loanInfo },
        purchaseInfo: purchaseInfo === null ? undefined : { create: purchaseInfo },
        readingProgress: readingProgress === null ? undefined : { create: readingProgress },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        userId,
      },
      include: withRelations,
    });
  }

  deleteOwned(userId: string, id: string): Promise<number> {
    return this.prisma.book.deleteMany({ where: { id, userId } }).then((result) => result.count);
  }

  findOwnedById(userId: string, id: string): Promise<BookWithRelations | null> {
    return this.prisma.book.findFirst({
      include: withRelations,
      where: { id, userId },
    });
  }

  listByUser({ skip, sortDirection, take, userId }: ListBooksInput): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: { createdAt: sortDirection },
      skip,
      take,
      where: { userId },
    });
  }

  async maxQueuePosition(userId: string): Promise<number> {
    const result = await this.prisma.book.aggregate({
      _max: { queuePosition: true },
      where: { userId },
    });
    return result._max.queuePosition ?? 0;
  }
}
