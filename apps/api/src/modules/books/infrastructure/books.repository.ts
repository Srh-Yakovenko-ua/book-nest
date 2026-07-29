import type {
  AgeCategory,
  BookFormat,
  BookLanguage,
  BookType,
  DedicationFilter,
  DedicationSort,
  LibrarySort,
  LoanType,
  Nullable,
  OwnershipStatus,
  PublisherPresence,
  ReadingStatus,
} from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES, LoanTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { CreateDeliveryData, UpdateDeliveryData } from "./book-deliveries.repository.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { acquireUserQueueLock } from "../../../core/database/queue-lock.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { buildBookSearchConditions } from "./book-search.js";
import { ListMembershipRepository } from "./list-membership.repository.js";
import { enforceQueueInvariant } from "./queue-invariant.js";

const log = createLogger("books.repository");

const ACTIVE_BOOK_SQL = Prisma.sql`AND book.deleted_at IS NULL`;

const WISHLIST_MAX_BOOKS = 1000;
const READING_STATUS_FINISHED = "finished";

const CountRowSchema = z.object({ count: z.number() });

const GenreKeyRowSchema = z.object({ key: z.string() });

const GenreCountRowSchema = z.object({ count: z.bigint(), key: z.string() });

const AuthorCountRowSchema = z.object({ count: z.bigint(), name: z.string() });

const FavoriteGenreCountRowSchema = z.object({ count: z.bigint(), genre: z.string() });

const FavoriteTagCountRowSchema = z.object({ count: z.bigint(), tag: z.string() });

const StoreNameRowSchema = z.object({ storeName: z.string() });

const FavoritesSummaryCountsRowSchema = z.object({
  finished: z.number(),
  reading: z.number(),
  series: z.number(),
  solo: z.number(),
  total: z.number(),
  unrated: z.number(),
  wantToRead: z.number(),
});

const EMPTY_FAVORITES_COUNTS: z.infer<typeof FavoritesSummaryCountsRowSchema> = {
  finished: 0,
  reading: 0,
  series: 0,
  solo: 0,
  total: 0,
  unrated: 0,
  wantToRead: 0,
};

const DedicationsSummaryCountsRowSchema = z.object({
  favoriteCount: z.number(),
  finishedCount: z.number(),
  totalCount: z.number(),
  unfinishedCount: z.number(),
});

const EMPTY_DEDICATIONS_COUNTS: z.infer<typeof DedicationsSummaryCountsRowSchema> = {
  favoriteCount: 0,
  finishedCount: 0,
  totalCount: 0,
  unfinishedCount: 0,
};

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
      _count: { select: { books: { where: SOFT_DELETE_SCOPE.active } } },
      authors: { include: { author: true }, orderBy: { author: { name: "asc" } } },
      books: {
        select: {
          authors: { include: { author: true }, orderBy: { position: "asc" } },
          createdAt: true,
          id: true,
          partNumber: true,
          readingStatus: true,
          title: true,
          updatedAt: true,
        },
        where: SOFT_DELETE_SCOPE.active,
      },
    },
  },
  tags: { include: { tag: true } },
} satisfies Prisma.BookInclude;

export const wishlistWithRelations = {
  ...withRelations,
  storeLinks: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.BookInclude;

const trashedSelect = {
  authors: { include: { author: true }, orderBy: { position: "asc" } },
  coverMedia: true,
  deletedAt: true,
  id: true,
  series: { select: { name: true } },
  title: true,
} satisfies Prisma.BookSelect;

const purgeSelect = {
  bookCharacters: { select: { portraitMediaId: true } },
  coverMediaId: true,
  deletedAt: true,
} satisfies Prisma.BookSelect;

const readingSnapshotSelect = {
  pagesCount: true,
  readingProgress: {
    select: {
      abandonedAt: true,
      currentPage: true,
      finishedAt: true,
      lastProgressUpdateAt: true,
      pausedAt: true,
      startedAt: true,
    },
  },
  readingStatus: true,
} satisfies Prisma.BookSelect;

export type ActiveReadingRow = {
  currentPage: Nullable<number>;
  id: string;
  pagesCount: Nullable<number>;
  title: string;
};

export type BlockUpsert<TCreate, TUpdate> =
  { create: TCreate; update: TUpdate } | { delete: true } | { skip: true };

export type BookPurgeRow = Prisma.BookGetPayload<{ select: typeof purgeSelect }>;

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

export type DedicationsFilter = {
  filter: DedicationFilter;
  genreKey?: string;
  search?: string;
  searchGenreKeys?: string[];
  userId: string;
};

export type DeliveryBlockChange =
  | { cancelledAt: Date; kind: "cancel" }
  | { create: CreateDeliveryData; kind: "upsertActive"; update: UpdateDeliveryData }
  | { kind: "skip" };

export type GuardedChangeOutcome = "applied" | "not-found" | "status-conflict";

export type LibraryFilter = {
  ageCategories?: AgeCategory[];
  authorIds?: string[];
  bookType?: BookType;
  formats?: BookFormat[];
  genreKeys?: string[];
  hasCover?: boolean;
  hasRating?: boolean;
  isFavorite?: boolean;
  languages?: BookLanguage[];
  ownershipStatuses?: OwnershipStatus[];
  pagesMax?: number;
  pagesMin?: number;
  publisherIds?: string[];
  publisherPresence?: PublisherPresence;
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

export type ReadingProgressEventData = {
  date: Date;
  page: number;
  pagesRead: number;
};

export type ReadingSnapshotRow = Prisma.BookGetPayload<{ select: typeof readingSnapshotSelect }>;

export type StatusGuard = { expectedStatuses: OwnershipStatus[] };

export type TrashedBookRow = TrashedBookSelection & { deletedAt: Date };

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

export type WishlistBookRow = Prisma.BookGetPayload<{
  include: typeof wishlistWithRelations;
}>;

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
  queuePriorityReason: Nullable<string>;
  queuePriorityReasonCustomText: Nullable<string>;
  queuePriorityTargetDate: Nullable<Date>;
  readingProgress: Nullable<CreateReadingProgressData>;
  readingStatus: string;
  seriesId: Nullable<string>;
  tagIds: string[];
  title: string;
  translator: Nullable<string>;
};

type DedicationsSummaryResult = {
  availableGenres: string[];
  favoriteCount: number;
  finishedCount: number;
  topAuthor: Nullable<{ count: number; name: string }>;
  topGenre: Nullable<{ count: number; genre: string }>;
  totalCount: number;
  unfinishedCount: number;
};

type FavoritesSummaryQuery = {
  finishedStatuses: ReadingStatus[];
  readingStatuses: ReadingStatus[];
  userId: string;
  wantToReadStatuses: ReadingStatus[];
};

type FavoritesSummaryResult = {
  averageRating: Nullable<number>;
  finished: number;
  reading: number;
  series: number;
  solo: number;
  topGenres: { count: number; genre: string }[];
  topTags: { count: number; tag: string }[];
  total: number;
  unrated: number;
  wantToRead: number;
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

type TrashedBookSelection = Prisma.BookGetPayload<{ select: typeof trashedSelect }>;

@Injectable()
export class BooksRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipRepository: ListMembershipRepository,
  ) {}

  async acquireBookLock(
    bookId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.reading, key: bookId }, client);
  }

  async acquireUserQueueLock(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await acquireUserQueueLock(userId, client);
  }

  applyLoanChange(
    userId: string,
    bookId: string,
    patch: LoanChangePatch,
    guard: StatusGuard,
    client?: Prisma.TransactionClient,
  ): Promise<GuardedChangeOutcome> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const guarded = await this.applyGuardedStatusChange(tx, {
        bookId,
        expectedStatuses: guard.expectedStatuses,
        fields: patch.book,
        userId,
      });
      if (guarded !== "applied") {
        return guarded;
      }

      if (patch.kind === "create") {
        await tx.bookLoan.create({ data: { ...patch.loan, bookId, status: "active", userId } });
        return "applied";
      }

      await tx.bookLoan.updateMany({
        data: { returnedAt: patch.returnedAt, status: "returned" },
        where: { bookId, status: "active" },
      });
      return "applied";
    });
  }

  applyOwnershipChange(
    userId: string,
    bookId: string,
    patch: OwnershipChangePatch,
    guard: StatusGuard,
    client?: Prisma.TransactionClient,
  ): Promise<GuardedChangeOutcome> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const guarded = await this.applyGuardedStatusChange(tx, {
        bookId,
        expectedStatuses: guard.expectedStatuses,
        fields: patch.book,
        userId,
      });
      if (guarded !== "applied") {
        return guarded;
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
      return "applied";
    });
  }

  applyReadingChange(
    userId: string,
    bookId: string,
    patch: ReadingChangePatch,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const owned = await tx.book.findFirst({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
      if (owned === null) {
        throw new NotFoundError("Book not found");
      }

      if (patch.book !== null) {
        await tx.book.update({ data: patch.book, where: { id: bookId } });
      }

      await enforceQueueInvariant(tx, { readingStatus: patch.book?.readingStatus, userId });

      if (Object.keys(patch.progress).length > 0) {
        await tx.bookReadingProgress.upsert({
          create: { ...patch.progress, bookId },
          update: patch.progress,
          where: { bookId },
        });
      }
    });
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

  countDedicationsForQuery({ filter }: { filter: DedicationsFilter }): Promise<number> {
    return this.prisma.book.count({ where: buildDedicationsWhere(filter) });
  }

  async countDistinctAuthors({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    const ownershipFilter =
      ownershipStatuses === undefined
        ? Prisma.empty
        : Prisma.sql`AND book.ownership_status IN (${Prisma.join(ownershipStatuses)})`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(DISTINCT book_author.author_id))::int AS "count"
      FROM book_authors book_author
      JOIN books book ON book.id = book_author.book_id
      WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
        ${ownershipFilter}
    `);
    return z.array(CountRowSchema).parse(rows)[0]?.count ?? 0;
  }

  async countDistinctSeries({
    ownershipStatuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    userId: string;
  }): Promise<number> {
    const ownershipFilter =
      ownershipStatuses === undefined
        ? Prisma.empty
        : Prisma.sql`AND book.ownership_status IN (${Prisma.join(ownershipStatuses)})`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(DISTINCT book.series_id))::int AS "count"
      FROM books book
      WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
        AND book.series_id IS NOT NULL
        ${ownershipFilter}
    `);
    return z.array(CountRowSchema).parse(rows)[0]?.count ?? 0;
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

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.book.count({ where: { ...SOFT_DELETE_SCOPE.trashed, userId } });
  }

  async create(
    userId: string,
    data: CreateBookData,
    now: Date,
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

  async dedicationsSummary({ userId }: { userId: string }): Promise<DedicationsSummaryResult> {
    const [countsRows, genreRows, topGenreRows, topAuthorRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "totalCount",
          (count(*) FILTER (WHERE book.is_favorite_dedication = true))::int AS "favoriteCount",
          (count(*) FILTER (WHERE book.reading_status = ${READING_STATUS_FINISHED}))::int AS "finishedCount",
          (count(*) FILTER (WHERE book.reading_status <> ${READING_STATUS_FINISHED}))::int AS "unfinishedCount"
        FROM books book
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
      `),
      this.prisma.$queryRaw`
        SELECT DISTINCT genre AS key
        FROM books book, unnest(book.genres) AS genre
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
        ORDER BY key ASC
      `,
      this.prisma.$queryRaw`
        SELECT genre AS key, count(*) AS count
        FROM books book, unnest(book.genres) AS genre
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
        GROUP BY genre
        ORDER BY count DESC, key ASC
        LIMIT 1
      `,
      this.prisma.$queryRaw`
        SELECT author.name AS name, count(*) AS count
        FROM book_authors book_author
        JOIN authors author ON author.id = book_author.author_id
        JOIN books book ON book.id = book_author.book_id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.dedication IS NOT NULL
          AND book.dedication <> ''
        GROUP BY author.name
        ORDER BY count DESC, name ASC
        LIMIT 1
      `,
    ]);

    const counts =
      z.array(DedicationsSummaryCountsRowSchema).parse(countsRows)[0] ?? EMPTY_DEDICATIONS_COUNTS;
    const availableGenreRows = z.array(GenreKeyRowSchema).parse(genreRows);
    const topGenre = z.array(GenreCountRowSchema).parse(topGenreRows)[0];
    const topAuthor = z.array(AuthorCountRowSchema).parse(topAuthorRows)[0];

    return {
      availableGenres: availableGenreRows.map((row) => row.key),
      favoriteCount: counts.favoriteCount,
      finishedCount: counts.finishedCount,
      topAuthor:
        topAuthor === undefined ? null : { count: Number(topAuthor.count), name: topAuthor.name },
      topGenre:
        topGenre === undefined ? null : { count: Number(topGenre.count), genre: topGenre.key },
      totalCount: counts.totalCount,
      unfinishedCount: counts.unfinishedCount,
    };
  }

  async existsOwned({ bookId, userId }: { bookId: string; userId: string }): Promise<boolean> {
    const book = await this.prisma.book.findFirst({
      select: { id: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
    return book !== null;
  }

  async favoritesSummary({
    finishedStatuses,
    readingStatuses,
    userId,
    wantToReadStatuses,
  }: FavoritesSummaryQuery): Promise<FavoritesSummaryResult> {
    const [countsRows, ratingAggregate, topGenreRows, topTagRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "total",
          (count(*) FILTER (WHERE book.reading_status IN (${Prisma.join(readingStatuses)})))::int AS "reading",
          (count(*) FILTER (WHERE book.reading_status IN (${Prisma.join(finishedStatuses)})))::int AS "finished",
          (count(*) FILTER (WHERE book.reading_status IN (${Prisma.join(wantToReadStatuses)})))::int AS "wantToRead",
          (count(*) FILTER (WHERE book.series_id IS NOT NULL))::int AS "series",
          (count(*) FILTER (WHERE book.series_id IS NULL))::int AS "solo",
          (count(*) FILTER (
            WHERE book.reading_status IN (${Prisma.join(finishedStatuses)})
              AND progress.rating IS NULL
          ))::int AS "unrated"
        FROM books book
        LEFT JOIN book_reading_progress progress ON progress.book_id = book.id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.is_favorite = true
      `),
      this.prisma.bookReadingProgress.aggregate({
        _avg: { rating: true },
        where: { book: { isFavorite: true, userId }, rating: { not: null } },
      }),
      this.prisma.$queryRaw`
        SELECT g AS genre, count(*) AS count
        FROM books book, unnest(book.genres) AS g
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND book.is_favorite = true
        GROUP BY g
        ORDER BY count DESC, genre ASC
        LIMIT ${FAVORITE_TOP_LIMIT}
      `,
      this.prisma.$queryRaw`
        SELECT tag.name AS tag, count(*) AS count
        FROM book_tags book_tag
        JOIN tags tag ON tag.id = book_tag.tag_id
        JOIN books book ON book.id = book_tag.book_id
        WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
          AND tag.user_id = ${userId}::uuid
          AND book.is_favorite = true
        GROUP BY tag.name
        ORDER BY count DESC, tag ASC
        LIMIT ${FAVORITE_TOP_LIMIT}
      `,
    ]);

    const counts =
      z.array(FavoritesSummaryCountsRowSchema).parse(countsRows)[0] ?? EMPTY_FAVORITES_COUNTS;
    const topGenres = z.array(FavoriteGenreCountRowSchema).parse(topGenreRows);
    const topTags = z.array(FavoriteTagCountRowSchema).parse(topTagRows);

    return {
      averageRating: ratingAggregate._avg.rating,
      finished: counts.finished,
      reading: counts.reading,
      series: counts.series,
      solo: counts.solo,
      topGenres: topGenres.map((row) => ({ count: Number(row.count), genre: row.genre })),
      topTags: topTags.map((row) => ({ count: Number(row.count), tag: row.tag })),
      total: counts.total,
      unrated: counts.unrated,
      wantToRead: counts.wantToRead,
    };
  }

  findForPurge({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<BookPurgeRow>> {
    return this.prisma.book.findFirst({
      select: purgeSelect,
      where: { id: bookId, userId },
    });
  }

  findOwnedById(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookWithRelations>> {
    return client.book.findFirst({
      include: withRelations,
      where: { ...SOFT_DELETE_SCOPE.active, id, userId },
    });
  }

  async findOwnedByIdOrThrow(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookWithRelations> {
    const book = await this.findOwnedById(userId, id, client);
    if (book === null) {
      throw new NotFoundError("Book not found");
    }

    return book;
  }

  findPurgeCandidates({
    deletedBefore,
    limit,
  }: {
    deletedBefore: Date;
    limit: number;
  }): Promise<{ id: string; userId: string }[]> {
    return this.prisma.book.findMany({
      orderBy: { deletedAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: { deletedAt: { lt: deletedBefore } },
    });
  }

  findReadingEvents(args: {
    bookId: string;
  }): Promise<Array<{ createdAt: Date; date: Date; id: string; page: number; pagesRead: number }>> {
    return this.prisma.bookReadingProgressEvent.findMany({
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { createdAt: true, date: true, id: true, page: true, pagesRead: true },
      where: { book: SOFT_DELETE_SCOPE.active, bookId: args.bookId },
    });
  }

  async findReadingSnapshotOrThrow(userId: string, bookId: string): Promise<ReadingSnapshotRow> {
    const book = await this.prisma.book.findFirst({
      select: readingSnapshotSelect,
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
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
        ...SOFT_DELETE_SCOPE.active,
        id: excludeBookId === null ? undefined : { not: excludeBookId },
        partNumber,
        seriesId,
        userId,
      },
    });
  }

  async hardDeleteIfTrashed({
    bookId,
    deletedBefore,
    userId,
  }: {
    bookId: string;
    deletedBefore: Date;
    userId: string;
  }): Promise<number> {
    const purged = await this.prisma.book.deleteMany({
      where: { deletedAt: { lt: deletedBefore }, id: bookId, userId },
    });
    return purged.count;
  }

  async listActiveReading({
    ownershipStatuses,
    statuses,
    userId,
  }: {
    ownershipStatuses?: OwnershipStatus[];
    statuses: ReadingStatus[];
    userId: string;
  }): Promise<ActiveReadingRow[]> {
    const rows = await this.prisma.book.findMany({
      select: {
        id: true,
        pagesCount: true,
        readingProgress: { select: { currentPage: true } },
        title: true,
      },
      where: buildLibraryWhere({ ownershipStatuses, readingStatuses: statuses, userId }),
    });
    return rows.map((row) => ({
      currentPage: row.readingProgress?.currentPage ?? null,
      id: row.id,
      pagesCount: row.pagesCount,
      title: row.title,
    }));
  }

  listDedicationsForQuery({
    filter,
    skip,
    sort,
    take,
  }: {
    filter: DedicationsFilter;
    skip: number;
    sort: DedicationSort;
    take: number;
  }): Promise<BookWithRelations[]> {
    return this.prisma.book.findMany({
      include: withRelations,
      orderBy: DEDICATIONS_ORDER_BY[sort],
      skip,
      take,
      where: buildDedicationsWhere(filter),
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

  async listTrashed({
    skip,
    take,
    userId,
  }: {
    skip: number;
    take: number;
    userId: string;
  }): Promise<TrashedBookRow[]> {
    const rows = await this.prisma.book.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedSelect,
      skip,
      take,
      where: { ...SOFT_DELETE_SCOPE.trashed, userId },
    });
    return rows.filter(isTrashed);
  }

  async listWishlistBooks({
    client,
    userId,
  }: {
    client?: Prisma.TransactionClient;
    userId: string;
  }): Promise<WishlistBookRow[]> {
    const db = client ?? this.prisma;
    const rows = await db.book.findMany({
      include: wishlistWithRelations,
      orderBy: LIBRARY_ORDER_BY.created_desc,
      take: WISHLIST_MAX_BOOKS,
      where: { ...SOFT_DELETE_SCOPE.active, ownershipStatus: "want_to_buy", userId },
    });
    if (rows.length === WISHLIST_MAX_BOOKS) {
      log.warn({ cap: WISHLIST_MAX_BOOKS, userId }, "wishlist truncated at the safety cap");
    }
    return rows;
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
    const rows = await this.prisma.$queryRaw`
      SELECT purchase.store_name AS "storeName"
      FROM book_purchase_info purchase
      JOIN books book ON book.id = purchase.book_id
      WHERE book.user_id = ${userId}::uuid
          ${ACTIVE_BOOK_SQL}
        AND purchase.store_name IS NOT NULL
        AND btrim(purchase.store_name) <> ''
      GROUP BY purchase.store_name
      ORDER BY max(book.created_at) DESC
      LIMIT ${limit}
    `;
    return z
      .array(StoreNameRowSchema)
      .parse(rows)
      .map((row) => row.storeName);
  }

  recordReadingProgress(
    args: {
      bookId: string;
      event: Nullable<ReadingProgressEventData>;
      patch: ReadingChangePatch;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await this.applyReadingChange(args.userId, args.bookId, args.patch, tx);

      if (args.event !== null) {
        await tx.bookReadingProgressEvent.create({
          data: {
            bookId: args.bookId,
            date: args.event.date,
            page: args.event.page,
            pagesRead: args.event.pagesRead,
          },
        });
      }
    });
  }

  recordReadingStatusChange(
    args: {
      bookId: string;
      clearEvents: boolean;
      event: Nullable<ReadingProgressEventData>;
      patch: ReadingChangePatch;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      await this.applyReadingChange(args.userId, args.bookId, args.patch, tx);

      if (args.clearEvents) {
        await tx.bookReadingProgressEvent.deleteMany({ where: { bookId: args.bookId } });
      }

      if (args.event !== null) {
        await tx.bookReadingProgressEvent.create({
          data: {
            bookId: args.bookId,
            date: args.event.date,
            page: args.event.page,
            pagesRead: args.event.pagesRead,
          },
        });
      }
    });
  }

  async restore({ bookId, userId }: { bookId: string; userId: string }): Promise<number> {
    const restored = await this.prisma.book.updateMany({
      data: { deletedAt: null },
      where: { ...SOFT_DELETE_SCOPE.trashed, id: bookId, userId },
    });
    return restored.count;
  }

  async shiftQueueUpAfter(
    userId: string,
    position: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.book.updateMany({
      data: { queuePosition: { decrement: 1 } },
      where: { ...SOFT_DELETE_SCOPE.active, queuePosition: { gt: position }, userId },
    });
  }

  async softDelete({
    bookId,
    deletedAt,
    userId,
  }: {
    bookId: string;
    deletedAt: Date;
    userId: string;
  }): Promise<number> {
    const deleted = await this.prisma.book.updateMany({
      data: { deletedAt },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
    return deleted.count;
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
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT unnest(genres) AS key, count(*) AS count
      FROM books
      WHERE user_id = ${userId}::uuid
        AND deleted_at IS NULL
        ${ownershipFilter}
      GROUP BY key
      ORDER BY count DESC, key ASC
      LIMIT ${limit}
    `);
    return z
      .array(GenreCountRowSchema)
      .parse(rows)
      .map((row) => ({ count: Number(row.count), key: row.key }));
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
      where: { book: { ...SOFT_DELETE_SCOPE.active, userId }, bookId, status: "active" },
    });
    if (updated.count === 0) {
      throw new NotFoundError("Loan not found");
    }
  }

  updateOwned(
    userId: string,
    bookId: string,
    data: UpdateBookData,
    now: Date,
    client?: Prisma.TransactionClient,
  ): Promise<BookWithRelations> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      if (data.queueRemoval !== null) {
        await acquireUserQueueLock(userId, tx);
      }

      const updated = await tx.book.updateMany({
        data: data.fields,
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
      if (updated.count === 0) {
        throw new NotFoundError("Book not found");
      }

      if (data.queueRemoval !== null) {
        await this.shiftQueueUpAfter(userId, data.queueRemoval.fromPosition, tx);
      }

      const nextReadingStatus =
        typeof data.fields.readingStatus === "string" ? data.fields.readingStatus : undefined;
      await enforceQueueInvariant(tx, { readingStatus: nextReadingStatus, userId });

      await applyBlockUpsert(tx.bookReadingProgress, bookId, data.readingProgress);
      await applyBlockUpsert(tx.bookPurchaseInfo, bookId, data.purchaseInfo);
      await applyDeliveryBlock(tx, bookId, userId, data.deliveryInfo);
      await applyLoanBlock(tx, bookId, userId, data.loanInfo);

      if (data.authorIds !== undefined) {
        await tx.bookAuthor.deleteMany({ where: { bookId } });
        await tx.bookAuthor.createMany({
          data: data.authorIds.map((authorId, position) => ({ authorId, bookId, position })),
        });
      }

      if (data.tagIds !== undefined) {
        await tx.bookTag.deleteMany({ where: { bookId } });
        if (data.tagIds.length > 0) {
          await tx.bookTag.createMany({
            data: data.tagIds.map((tagId) => ({ bookId, tagId })),
          });
        }
      }

      if (data.listIds !== undefined) {
        const targetListIds = new Set(data.listIds);
        const current = await tx.bookListItem.findMany({
          select: { listId: true },
          where: { bookId },
        });
        const currentListIds = new Set(current.map((item) => item.listId));

        const toRemove = current
          .map((item) => item.listId)
          .filter((listId) => !targetListIds.has(listId));
        const toAdd = data.listIds.filter((listId) => !currentListIds.has(listId));

        if (toAdd.length > 0 || toRemove.length > 0) {
          const affectedListIds = [...new Set([...toAdd, ...toRemove])].sort();
          for (const listId of affectedListIds) {
            await this.membershipRepository.acquireListLock(tx, { listId });
          }

          for (const listId of toRemove) {
            const membership = await this.membershipRepository.findMembership(tx, {
              bookId,
              listId,
            });
            if (membership === null) {
              continue;
            }
            await this.membershipRepository.deleteMembership(tx, { bookId, listId });
            await this.membershipRepository.shiftUpAfter(tx, {
              listId,
              position: membership.position,
            });
          }

          for (const listId of toAdd) {
            await this.membershipRepository.append(tx, { bookId, listId });
          }

          for (const listId of affectedListIds) {
            await this.membershipRepository.touchList(tx, { listId, now, userId });
          }
        }
      }

      return tx.book.findFirstOrThrow({
        include: withRelations,
        where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
      });
    });
  }

  private async applyGuardedStatusChange(
    client: Prisma.TransactionClient,
    {
      bookId,
      expectedStatuses,
      fields,
      userId,
    }: {
      bookId: string;
      expectedStatuses: OwnershipStatus[];
      fields: { ownershipStatus?: OwnershipStatus };
      userId: string;
    },
  ): Promise<GuardedChangeOutcome> {
    const updated = await client.book.updateMany({
      data: fields,
      where: {
        ...SOFT_DELETE_SCOPE.active,
        id: bookId,
        ownershipStatus: { in: expectedStatuses },
        userId,
      },
    });
    if (updated.count > 0) {
      return "applied";
    }

    const exists = await client.book.findFirst({
      select: { id: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
    return exists === null ? "not-found" : "status-conflict";
  }
}

const FAVORITE_TOP_LIMIT = 3;

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

export const DEDICATIONS_ORDER_BY: Record<DedicationSort, Prisma.BookOrderByWithRelationInput[]> = {
  author_asc: [{ firstAuthorName: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  book_title_asc: [{ title: "asc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  favorites_first: [{ isFavoriteDedication: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
  newest: [{ createdAt: "desc" }, ID_TIEBREAKER],
  publication_year_desc: [
    { publicationYear: { nulls: "last", sort: "desc" } },
    CREATED_AT_TIEBREAKER,
    ID_TIEBREAKER,
  ],
  recently_updated: [{ updatedAt: "desc" }, CREATED_AT_TIEBREAKER, ID_TIEBREAKER],
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

function applyDedicationStatusFilter(where: Prisma.BookWhereInput, filter: DedicationFilter): void {
  switch (filter) {
    case "all":
      return;
    case "favorites":
      where.isFavoriteDedication = true;
      return;
    case "finished":
      where.readingStatus = "finished";
      return;
    case "unfinished":
      where.readingStatus = { not: "finished" };
      return;
    case "without_favorites":
      where.isFavoriteDedication = false;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
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

function buildDedicationsWhere(input: DedicationsFilter): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = {
    AND: [{ dedication: { not: null } }, { dedication: { not: "" } }],
    ...SOFT_DELETE_SCOPE.active,
    userId: input.userId,
  };

  applyDedicationStatusFilter(where, input.filter);

  if (input.genreKey !== undefined) {
    where.genres = { hasSome: [input.genreKey] };
  }

  const searchConditions = buildBookSearchConditions({
    includeDedication: true,
    search: input.search,
    searchGenreKeys: input.searchGenreKeys,
  });
  if (searchConditions !== undefined) {
    where.OR = searchConditions;
  }

  return where;
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
  const where: Prisma.BookWhereInput = { ...SOFT_DELETE_SCOPE.active, userId: filter.userId };

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
  if (filter.publisherPresence === "missing") {
    where.publisherId = null;
  } else if (filter.publisherPresence === "assigned") {
    where.publisherId = { not: null };
  } else if (filter.publisherIds !== undefined) {
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
    where.readingProgress = { is: { rating } };
  } else if (filter.hasRating === true) {
    where.readingProgress = { is: { rating: { not: null } } };
  }
  if (filter.hasRating === false) {
    where.NOT = { readingProgress: { is: { rating: { not: null } } } };
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

function isTrashed(row: TrashedBookSelection): row is TrashedBookRow {
  return row.deletedAt !== null;
}
