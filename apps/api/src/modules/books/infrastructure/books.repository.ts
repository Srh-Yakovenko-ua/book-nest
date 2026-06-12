import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";

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

export type BlockUpsert<TCreate, TUpdate> =
  | { create: TCreate; update: TUpdate }
  | { delete: true }
  | { skip: true };

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

export type UpdateBookData = {
  deliveryInfo: BlockUpsert<CreateDeliveryInfoData, UpdateDeliveryInfoData>;
  fields: Prisma.BookUncheckedUpdateManyInput;
  listIds?: string[];
  loanInfo: BlockUpsert<CreateLoanInfoData, UpdateLoanInfoData>;
  purchaseInfo: BlockUpsert<CreatePurchaseInfoData, UpdatePurchaseInfoData>;
  readingProgress: BlockUpsert<CreateReadingProgressData, UpdateReadingProgressData>;
  tagIds?: string[];
};

export type UpdateDeliveryInfoData = Partial<CreateDeliveryInfoData>;

export type UpdateLoanInfoData = Partial<CreateLoanInfoData>;

export type UpdatePurchaseInfoData = Partial<CreatePurchaseInfoData>;

export type UpdateReadingProgressData = Partial<CreateReadingProgressData>;

type BlockDelegate<TCreate, TUpdate> = {
  deleteMany: (args: { where: { bookId: string } }) => Promise<{ count: number }>;
  upsert: (args: {
    create: TCreate & { bookId: string };
    update: TUpdate;
    where: { bookId: string };
  }) => Promise<unknown>;
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

  updateOwned(userId: string, bookId: string, data: UpdateBookData): Promise<BookWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.book.updateMany({
        data: data.fields,
        where: { id: bookId, userId },
      });
      if (updated.count === 0) {
        throw new NotFoundError("Book not found");
      }

      await applyBlockUpsert(tx.bookReadingProgress, bookId, data.readingProgress);
      await applyBlockUpsert(tx.bookPurchaseInfo, bookId, data.purchaseInfo);
      await applyBlockUpsert(tx.bookDeliveryInfo, bookId, data.deliveryInfo);
      await applyBlockUpsert(tx.bookLoanInfo, bookId, data.loanInfo);

      if (data.tagIds !== undefined) {
        await tx.bookTag.deleteMany({ where: { bookId } });
        if (data.tagIds.length > 0) {
          await tx.bookTag.createMany({
            data: data.tagIds.map((tagId) => ({ bookId, tagId })),
          });
        }
      }

      if (data.listIds !== undefined) {
        await tx.bookListItem.deleteMany({ where: { bookId } });
        if (data.listIds.length > 0) {
          await tx.bookListItem.createMany({
            data: data.listIds.map((listId) => ({ bookId, listId })),
          });
        }
      }

      return tx.book.findFirstOrThrow({ include: withRelations, where: { id: bookId, userId } });
    });
  }
}

type ListBooksInput = {
  skip: number;
  sortDirection: Prisma.SortOrder;
  take: number;
  userId: string;
};

async function applyBlockUpsert<TCreate, TUpdate>(
  delegate: BlockDelegate<TCreate, TUpdate>,
  bookId: string,
  block: BlockUpsert<TCreate, TUpdate>,
): Promise<void> {
  if ("skip" in block) {
    return;
  }

  if ("delete" in block) {
    await delegate.deleteMany({ where: { bookId } });
    return;
  }

  await delegate.upsert({
    create: { ...block.create, bookId },
    update: block.update,
    where: { bookId },
  });
}
