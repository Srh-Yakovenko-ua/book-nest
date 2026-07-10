import type {
  AgeCategory,
  BookFormat,
  BookLanguage,
  BookType,
  LibrarySort,
  LoanType,
  Nullable,
  OwnershipStatus,
  ReadingStatus,
} from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES, LoanTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { CreateDeliveryData, UpdateDeliveryData } from "./book-deliveries.repository.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildBookSearchConditions } from "./book-search.js";
import { ListMembershipRepository } from "./list-membership.repository.js";

export const withRelations = {
  authors: { include: { author: true }, orderBy: { position: "asc" } },
  coverMedia: true,
  deliveries: { orderBy: { createdAt: "desc" } },
  lists: { include: { list: true } },
  loans: { orderBy: { createdAt: "desc" }, take: 1, where: { status: "active" } },
  publisher: true,
  purchaseInfo: true,
  readingProgress: true,
  series: {
    include: {
      _count: { select: { books: true } },
      authors: { include: { author: true }, orderBy: { author: { name: "asc" } } },
      books: {
        select: {
          createdAt: true,
          id: true,
          partNumber: true,
          readingStatus: true,
          title: true,
          updatedAt: true,
        },
      },
    },
  },
  tags: { include: { tag: true } },
} satisfies Prisma.BookInclude;

export type BlockUpsert<TCreate, TUpdate> =
  | { create: TCreate; update: TUpdate }
  | { delete: true }
  | { skip: true };

export type BookWithRelations = Prisma.BookGetPayload<{
  include: typeof withRelations;
}>;

export type CreateLoanInfoData = {
  contact: Nullable<string>;
  expectedReturnDate: Nullable<Date>;
  loanDate: Nullable<Date>;
  note: Nullable<string>;
  personName: string;
  remindToReturn: boolean;
};

export type CreatePurchaseInfoData = {
  currency: Nullable<string>;
  expectedPrice: Nullable<number>;
  note: Nullable<string>;
  storeName: Nullable<string>;
  storeUrl: Nullable<string>;
};

export type CreateReadingProgressData = {
  abandonedAt: Nullable<Date>;
  currentPage: Nullable<number>;
  finishedAt: Nullable<Date>;
  impression: Nullable<string>;
  lastProgressUpdateAt: Nullable<Date>;
  note: Nullable<string>;
  pausedAt: Nullable<Date>;
  rating: Nullable<number>;
  startedAt: Nullable<Date>;
};

export type DeliveryBlockChange =
  | { cancelledAt: Date; kind: "cancel" }
  | { create: CreateDeliveryData; kind: "upsertActive"; update: UpdateDeliveryData }
  | { kind: "skip" };

export type LibraryFilter = {
  ageCategories?: AgeCategory[];
  authorIds?: string[];
  bookType?: BookType;
  formats?: BookFormat[];
  genreKeys?: string[];
  hasCover?: boolean;
  isFavorite?: boolean;
  languages?: BookLanguage[];
  ownershipStatuses?: OwnershipStatus[];
  pagesMax?: number;
  pagesMin?: number;
  publisherIds?: string[];
  ratingMax?: number;
  ratingMin?: number;
  readingStatuses?: ReadingStatus[];
  search?: string;
  searchGenreKeys?: string[];
  tagIds?: string[];
  userId: string;
  yearMax?: number;
  yearMin?: number;
};

export type LoanBlockChange =
  | { create: CreateLoanInfoData; kind: "upsertActive"; type: LoanType; update: UpdateLoanInfoData }
  | { kind: "return"; returnedAt: Date }
  | { kind: "syncType"; type: LoanType };

export type LoanChangePatch =
  | {
      book: { ownershipStatus?: OwnershipStatus };
      kind: "create";
      loan: CreateLoanInfoData & { type: LoanType };
    }
  | { book: { ownershipStatus?: OwnershipStatus }; kind: "return"; returnedAt: Date };

export type OwnershipChangePatch = {
  book: { ownershipStatus?: OwnershipStatus };
  purchaseInfo?: "delete" | OwnershipPurchaseInfoPatch;
};

export type OwnershipPurchaseInfoPatch = Partial<CreatePurchaseInfoData> & {
  purchasedAt?: Nullable<Date>;
};

export type QueueRemoval = {
  fromPosition: number;
};

export type ReadingChangePatch = {
  book: Nullable<{ readingStatus?: ReadingStatus }>;
  progress: Partial<CreateReadingProgressData>;
};

export type UpdateActiveLoanData = {
  contact: Nullable<string>;
  expectedReturnDate: Nullable<Date>;
  loanDate: Nullable<Date>;
  note: Nullable<string>;
  personName: string;
  remindToReturn: boolean;
};

export type UpdateBookData = {
  authorIds?: string[];
  deliveryInfo: DeliveryBlockChange;
  fields: Prisma.BookUncheckedUpdateManyInput;
  listIds?: string[];
  loanInfo: LoanBlockChange;
  purchaseInfo: BlockUpsert<CreatePurchaseInfoData, UpdatePurchaseInfoData>;
  queueRemoval: Nullable<QueueRemoval>;
  readingProgress: BlockUpsert<CreateReadingProgressData, UpdateReadingProgressData>;
  tagIds?: string[];
};

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
  authorIds: string[];
  coverMediaId: Nullable<string>;
  dedication: Nullable<string>;
  deliveryInfo: Nullable<CreateDeliveryData>;
  description: Nullable<string>;
  favoriteAddedAt: Nullable<Date>;
  firstAuthorName: string;
  formats: string[];
  genres: string[];
  illustrator: Nullable<string>;
  isbn: Nullable<string>;
  isFavorite: boolean;
  language: string;
  listIds: string[];
  loanInfo: Nullable<CreateLoanInfoData>;
  originalTitle: Nullable<string>;
  ownershipStatus: string;
  pagesCount: Nullable<number>;
  partNumber: Nullable<number>;
  publicationYear: Nullable<number>;
  publisherId: Nullable<string>;
  purchaseInfo: Nullable<CreatePurchaseInfoData>;
  queuePosition: Nullable<number>;
  queuePriority: Nullable<string>;
  readingProgress: Nullable<CreateReadingProgressData>;
  readingStatus: string;
  seriesId: Nullable<string>;
  tagIds: string[];
  title: string;
  translator: Nullable<string>;
};

@Injectable()
export class BooksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepository: ListMembershipRepository,
  ) {}

  async applyLoanChange(userId: string, bookId: string, patch: LoanChangePatch): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const owned = await tx.book.findFirst({
        select: { id: true },
        where: { id: bookId, userId },
      });
      if (owned === null) {
        throw new NotFoundError("Book not found");
      }

      if (Object.keys(patch.book).length > 0) {
        await tx.book.update({ data: patch.book, where: { id: bookId } });
      }

      if (patch.kind === "create") {
        await tx.bookLoan.create({ data: { ...patch.loan, bookId, status: "active", userId } });
        return;
      }

      await tx.bookLoan.updateMany({
        data: { returnedAt: patch.returnedAt, status: "returned" },
        where: { bookId, status: "active" },
      });
    });
  }

  async applyOwnershipChange(
    userId: string,
    bookId: string,
    patch: OwnershipChangePatch,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const owned = await tx.book.findFirst({
        select: { id: true },
        where: { id: bookId, userId },
      });
      if (owned === null) {
        throw new NotFoundError("Book not found");
      }

      if (Object.keys(patch.book).length > 0) {
        await tx.book.update({ data: patch.book, where: { id: bookId } });
      }

      if (patch.purchaseInfo === "delete") {
        await tx.bookPurchaseInfo.deleteMany({ where: { bookId } });
      } else if (patch.purchaseInfo !== undefined && Object.keys(patch.purchaseInfo).length > 0) {
        await tx.bookPurchaseInfo.upsert({
          create: { ...patch.purchaseInfo, bookId },
          update: patch.purchaseInfo,
          where: { bookId },
        });
      }
    });
  }

  async applyReadingChange(
    userId: string,
    bookId: string,
    patch: ReadingChangePatch,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    if (client === undefined) {
      await this.prisma.$transaction((tx) => this.applyReadingChange(userId, bookId, patch, tx));
      return;
    }

    const owned = await client.book.findFirst({
      select: { id: true },
      where: { id: bookId, userId },
    });
    if (owned === null) {
      throw new NotFoundError("Book not found");
    }

    if (patch.book !== null) {
      await client.book.update({ data: patch.book, where: { id: bookId } });
    }

    if (Object.keys(patch.progress).length > 0) {
      await client.bookReadingProgress.upsert({
        create: { ...patch.progress, bookId },
        update: patch.progress,
        where: { bookId },
      });
    }
  }

  countByCoverMediaId(coverMediaId: string): Promise<number> {
    return this.prisma.book.count({ where: { coverMediaId } });
  }

  countByReadingStatuses({
    isFavorite,
    ownershipStatuses,
    statuses,
    userId,
  }: {
    isFavorite?: boolean;
    ownershipStatuses?: OwnershipStatus[];
    statuses: ReadingStatus[];
    userId: string;
  }): Promise<number> {
    return this.prisma.book.count({
      where: buildLibraryWhere({
        isFavorite,
        ownershipStatuses,
        readingStatuses: statuses,
        userId,
      }),
    });
  }

  countByUser({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    return this.prisma.book.count({ where: buildLibraryWhere({ ownershipStatuses, userId }) });
  }

  countFavorites({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    return this.prisma.book.count({
      where: buildLibraryWhere({ isFavorite: true, ownershipStatuses, userId }),
    });
  }

  countForLibrary({ filter }: { filter: LibraryFilter }): Promise<number> {
    return this.prisma.book.count({ where: buildLibraryWhere(filter) });
  }

  async create(
    userId: string,
    data: CreateBookData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookWithRelations> {
    const {
      authorIds,
      deliveryInfo,
      listIds,
      loanInfo,
      purchaseInfo,
      readingProgress,
      tagIds,
      ...bookData
    } = data;

    const created = await client.book.create({
      data: {
        ...bookData,
        authors: {
          create: authorIds.map((authorId, position) => ({ authorId, position })),
        },
        deliveries: deliveryInfo === null ? undefined : { create: { ...deliveryInfo, userId } },
        loans:
          loanInfo === null
            ? undefined
            : {
                create: {
                  ...loanInfo,
                  status: "active",
                  type: LoanTypeSchema.parse(bookData.ownershipStatus),
                  userId,
                },
              },
        purchaseInfo: purchaseInfo === null ? undefined : { create: purchaseInfo },
        readingProgress: readingProgress === null ? undefined : { create: readingProgress },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        userId,
      },
      select: { id: true },
    });

    if (listIds.length > 0) {
      const now = new Date();
      const sortedListIds = [...new Set(listIds)].sort();
      for (const listId of sortedListIds) {
        await this.membershipRepository.acquireListLock(client, { listId });
      }
      for (const listId of sortedListIds) {
        await this.membershipRepository.append(client, { bookId: created.id, listId });
      }
      for (const listId of sortedListIds) {
        await this.membershipRepository.touchList(client, { listId, now, userId });
      }
    }

    return client.book.findFirstOrThrow({ include: withRelations, where: { id: created.id } });
  }

  deleteOwned(userId: string, id: string): Promise<number> {
    return this.prisma.book.deleteMany({ where: { id, userId } }).then((result) => result.count);
  }

  async favoritesSummary({
    finishedStatuses,
    readingStatuses,
    userId,
  }: FavoritesSummaryQuery): Promise<FavoritesSummaryResult> {
    const [total, reading, finished, ratingAggregate] = await Promise.all([
      this.countFavorites({ userId }),
      this.countByReadingStatuses({ isFavorite: true, statuses: readingStatuses, userId }),
      this.countByReadingStatuses({ isFavorite: true, statuses: finishedStatuses, userId }),
      this.prisma.bookReadingProgress.aggregate({
        _avg: { rating: true },
        where: { book: { isFavorite: true, userId }, rating: { not: null } },
      }),
    ]);

    return { averageRating: ratingAggregate._avg.rating, finished, reading, total };
  }

  findOwnedById(userId: string, id: string): Promise<Nullable<BookWithRelations>> {
    return this.prisma.book.findFirst({
      include: withRelations,
      where: { id, userId },
    });
  }

  async findOwnedByIdOrThrow(userId: string, id: string): Promise<BookWithRelations> {
    const book = await this.findOwnedById(userId, id);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return book;
  }

  findSeriesPartNumberConflict(
    userId: string,
    { excludeBookId, partNumber, seriesId }: SeriesPartNumberQuery,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<SeriesPartNumberConflict>> {
    return client.book.findFirst({
      select: { id: true, title: true },
      where: {
        id: excludeBookId === null ? undefined : { not: excludeBookId },
        partNumber,
        seriesId,
        userId,
      },
    });
  }

  listForLibrary({ filter, skip, sort, take }: ListForLibraryInput): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: LIBRARY_ORDER_BY[sort],
      skip,
      take,
      where: buildLibraryWhere(filter),
    });
  }

  listRecentlyAdded({
    ownershipStatuses,
    take,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    take: number;
    userId: string;
  }): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: { createdAt: "desc" },
      take,
      where: buildLibraryWhere({ ownershipStatuses, userId }),
    });
  }

  async maxQueuePosition(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.book.aggregate({
      _max: { queuePosition: true },
      where: { userId },
    });
    return result._max.queuePosition ?? 0;
  }

  async recentPurchaseStores({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ storeName: string }[]>`
      SELECT purchase.store_name AS "storeName"
      FROM book_purchase_info purchase
      JOIN books book ON book.id = purchase.book_id
      WHERE book.user_id = ${userId}::uuid
        AND purchase.store_name IS NOT NULL
        AND btrim(purchase.store_name) <> ''
      GROUP BY purchase.store_name
      ORDER BY max(book.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.storeName);
  }

  async shiftQueueUpAfter(
    userId: string,
    position: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: { decrement: 1 } },
      where: { queuePosition: { gt: position }, userId },
    });
  }

  async topGenreKeys({
    limit,
    ownershipStatuses,
    userId,
  }: {
    limit: number;
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<{ count: number; key: string }[]> {
    const ownershipFilter =
      ownershipStatuses === undefined
        ? Prisma.empty
        : Prisma.sql`AND ownership_status IN (${Prisma.join(ownershipStatuses)})`;
    const rows = await this.prisma.$queryRaw<{ count: bigint; key: string }[]>(Prisma.sql`
      SELECT unnest(genres) AS key, count(*) AS count
      FROM books
      WHERE user_id = ${userId}::uuid
        ${ownershipFilter}
      GROUP BY key
      ORDER BY count DESC, key ASC
      LIMIT ${limit}
    `);
    return rows.map((row) => ({ count: Number(row.count), key: row.key }));
  }

  async topTags({
    limit,
    ownershipStatuses,
    userId,
  }: {
    limit: number;
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<{ count: number; id: string; name: string }[]> {
    const grouped = await this.prisma.bookTag.groupBy({
      _count: { tagId: true },
      by: ["tagId"],
      orderBy: { _count: { tagId: "desc" } },
      take: limit,
      where: { book: buildLibraryWhere({ ownershipStatuses, userId }) },
    });
    if (grouped.length === 0) {
      return [];
    }
    const tags = await this.prisma.tag.findMany({
      select: { id: true, name: true },
      where: { id: { in: grouped.map((entry) => entry.tagId) } },
    });
    const nameById = new Map(tags.map((tag) => [tag.id, tag.name]));
    return grouped.flatMap((entry) => {
      const name = nameById.get(entry.tagId);
      return name === undefined ? [] : [{ count: entry._count.tagId, id: entry.tagId, name }];
    });
  }

  async updateActiveLoan(
    userId: string,
    bookId: string,
    data: UpdateActiveLoanData,
  ): Promise<void> {
    const updated = await this.prisma.bookLoan.updateMany({
      data,
      where: { book: { userId }, bookId, status: "active" },
    });
    if (updated.count === 0) {
      throw new NotFoundError("Loan not found");
    }
  }

  async updateOwned(
    userId: string,
    bookId: string,
    data: UpdateBookData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookWithRelations> {
    const updated = await client.book.updateMany({
      data: data.fields,
      where: { id: bookId, userId },
    });
    if (updated.count === 0) {
      throw new NotFoundError("Book not found");
    }

    if (data.queueRemoval !== null) {
      await this.shiftQueueUpAfter(userId, data.queueRemoval.fromPosition, client);
    }

    await applyBlockUpsert(client.bookReadingProgress, bookId, data.readingProgress);
    await applyBlockUpsert(client.bookPurchaseInfo, bookId, data.purchaseInfo);
    await applyDeliveryBlock(client, bookId, userId, data.deliveryInfo);
    await applyLoanBlock(client, bookId, userId, data.loanInfo);

    if (data.authorIds !== undefined) {
      await client.bookAuthor.deleteMany({ where: { bookId } });
      await client.bookAuthor.createMany({
        data: data.authorIds.map((authorId, position) => ({ authorId, bookId, position })),
      });
    }

    if (data.tagIds !== undefined) {
      await client.bookTag.deleteMany({ where: { bookId } });
      if (data.tagIds.length > 0) {
        await client.bookTag.createMany({
          data: data.tagIds.map((tagId) => ({ bookId, tagId })),
        });
      }
    }

    if (data.listIds !== undefined) {
      const targetListIds = new Set(data.listIds);
      const current = await client.bookListItem.findMany({
        select: { listId: true },
        where: { bookId },
      });
      const currentListIds = new Set(current.map((item) => item.listId));

      const toRemove = current
        .map((item) => item.listId)
        .filter((listId) => !targetListIds.has(listId));
      const toAdd = data.listIds.filter((listId) => !currentListIds.has(listId));

      if (toAdd.length > 0 || toRemove.length > 0) {
        const now = new Date();
        const affectedListIds = [...new Set([...toAdd, ...toRemove])].sort();
        for (const listId of affectedListIds) {
          await this.membershipRepository.acquireListLock(client, { listId });
        }

        for (const listId of toRemove) {
          const membership = await this.membershipRepository.findMembership(client, {
            bookId,
            listId,
          });
          if (membership === null) {
            continue;
          }
          await this.membershipRepository.deleteMembership(client, { bookId, listId });
          await this.membershipRepository.shiftUpAfter(client, {
            listId,
            position: membership.position,
          });
        }

        for (const listId of toAdd) {
          await this.membershipRepository.append(client, { bookId, listId });
        }

        for (const listId of affectedListIds) {
          await this.membershipRepository.touchList(client, { listId, now, userId });
        }
      }
    }

    return client.book.findFirstOrThrow({ include: withRelations, where: { id: bookId, userId } });
  }
}

type FavoritesSummaryQuery = {
  finishedStatuses: ReadingStatus[];
  readingStatuses: ReadingStatus[];
  userId: string;
};

type FavoritesSummaryResult = {
  averageRating: Nullable<number>;
  finished: number;
  reading: number;
  total: number;
};

type ListForLibraryInput = {
  filter: LibraryFilter;
  skip: number;
  sort: LibrarySort;
  take: number;
};

type SeriesPartNumberConflict = {
  id: string;
  title: string;
};

type SeriesPartNumberQuery = {
  excludeBookId: Nullable<string>;
  partNumber: number;
  seriesId: string;
};

const CREATED_AT_TIEBREAKER: Prisma.BookOrderByWithRelationInput = { createdAt: "desc" };

const ID_TIEBREAKER: Prisma.BookOrderByWithRelationInput = { id: "asc" };

export const LIBRARY_ORDER_BY: Record<LibrarySort, Prisma.BookOrderByWithRelationInput[]> = {
  author_asc: [{ firstAuthorName: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  author_desc: [{ firstAuthorName: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  created_asc: [{ createdAt: "asc" }, ID_TIEBREAKER],
  created_desc: [{ createdAt: "desc" }, ID_TIEBREAKER],
  favorite_added_asc: [
    { favoriteAddedAt: { nulls: "last", sort: "asc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  favorite_added_desc: [
    { favoriteAddedAt: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  pages_asc: [{ pagesCount: { nulls: "last", sort: "asc" } }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  pages_desc: [
    { pagesCount: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  rating_asc: [
    { readingProgress: { rating: { nulls: "last", sort: "asc" } } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  rating_desc: [
    { readingProgress: { rating: { nulls: "last", sort: "desc" } } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  title_asc: [{ title: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  title_desc: [{ title: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  updated_desc: [{ updatedAt: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  year_asc: [
    { publicationYear: { nulls: "last", sort: "asc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  year_desc: [
    { publicationYear: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
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

async function applyDeliveryBlock(
  tx: Prisma.TransactionClient,
  bookId: string,
  userId: string,
  change: DeliveryBlockChange,
): Promise<void> {
  if (change.kind === "skip") {
    return;
  }

  if (change.kind === "cancel") {
    await tx.bookDelivery.updateMany({
      data: { cancelledAt: change.cancelledAt, status: "cancelled" },
      where: { bookId, status: { in: [...DELIVERY_ACTIVE_STATUSES] } },
    });
    return;
  }

  const active = await tx.bookDelivery.findFirst({
    select: { id: true },
    where: { bookId, status: { in: [...DELIVERY_ACTIVE_STATUSES] } },
  });
  if (active === null) {
    await tx.bookDelivery.create({ data: { ...change.create, bookId, userId } });
    return;
  }

  await tx.bookDelivery.update({ data: change.update, where: { id: active.id } });
}

async function applyLoanBlock(
  tx: Prisma.TransactionClient,
  bookId: string,
  userId: string,
  change: LoanBlockChange,
): Promise<void> {
  if (change.kind === "return") {
    await tx.bookLoan.updateMany({
      data: { returnedAt: change.returnedAt, status: "returned" },
      where: { bookId, status: "active" },
    });
    return;
  }

  const active = await tx.bookLoan.findFirst({
    select: { id: true, type: true },
    where: { bookId, status: "active" },
  });

  if (change.kind === "syncType") {
    if (active !== null && active.type !== change.type) {
      await tx.bookLoan.update({ data: { type: change.type }, where: { id: active.id } });
    }
    return;
  }

  if (active === null) {
    await tx.bookLoan.create({
      data: { ...change.create, bookId, status: "active", type: change.type, userId },
    });
    return;
  }

  await tx.bookLoan.update({
    data: { ...change.update, type: change.type },
    where: { id: active.id },
  });
}

function buildIntRange({
  max,
  min,
}: {
  max?: number;
  min?: number;
}): undefined | { gte?: number; lte?: number } {
  if (min === undefined && max === undefined) {
    return undefined;
  }
  const range: { gte?: number; lte?: number } = {};
  if (min !== undefined) {
    range.gte = min;
  }
  if (max !== undefined) {
    range.lte = max;
  }
  return range;
}

function buildLibraryWhere(filter: LibraryFilter): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = { userId: filter.userId };

  if (filter.readingStatuses !== undefined) {
    where.readingStatus = { in: filter.readingStatuses };
  }
  if (filter.ownershipStatuses !== undefined) {
    where.ownershipStatus = { in: filter.ownershipStatuses };
  }
  if (filter.formats !== undefined) {
    where.formats = { hasSome: filter.formats };
  }
  if (filter.genreKeys !== undefined) {
    where.genres = { hasSome: filter.genreKeys };
  }
  if (filter.tagIds !== undefined) {
    where.tags = { some: { tagId: { in: filter.tagIds } } };
  }
  if (filter.authorIds !== undefined) {
    where.authors = { some: { authorId: { in: filter.authorIds } } };
  }
  if (filter.publisherIds !== undefined) {
    where.publisherId = { in: filter.publisherIds };
  }
  if (filter.ageCategories !== undefined) {
    where.ageCategory = { in: filter.ageCategories };
  }
  if (filter.languages !== undefined) {
    where.language = { in: filter.languages };
  }
  if (filter.bookType === "solo") {
    where.seriesId = null;
  }
  if (filter.bookType === "series_part") {
    where.seriesId = { not: null };
  }
  if (filter.isFavorite !== undefined) {
    where.isFavorite = filter.isFavorite;
  }
  if (filter.hasCover === true) {
    where.coverMediaId = { not: null };
  }
  if (filter.hasCover === false) {
    where.coverMediaId = null;
  }

  const rating = buildIntRange({ max: filter.ratingMax, min: filter.ratingMin });
  if (rating !== undefined) {
    where.readingProgress = { rating };
  }
  const publicationYear = buildIntRange({ max: filter.yearMax, min: filter.yearMin });
  if (publicationYear !== undefined) {
    where.publicationYear = publicationYear;
  }
  const pagesCount = buildIntRange({ max: filter.pagesMax, min: filter.pagesMin });
  if (pagesCount !== undefined) {
    where.pagesCount = pagesCount;
  }

  const searchConditions = buildBookSearchConditions({
    search: filter.search,
    searchGenreKeys: filter.searchGenreKeys,
  });
  if (searchConditions !== undefined) {
    where.OR = searchConditions;
  }

  return where;
}
