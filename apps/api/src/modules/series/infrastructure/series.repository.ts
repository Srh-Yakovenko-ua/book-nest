import type { Nullable, SeriesSearchQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { TrashStamp } from "../../../core/trash-retention.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { SeriesModel } from "../../../generated/prisma/models.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { isTrashed, SOFT_DELETE_SCOPE, type Trashed } from "../../../core/database/soft-delete.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildSeriesCountQuery, buildSeriesPageQuery } from "./series-search-sql.js";

export type CreateSeriesData = {
  description: Nullable<string>;
  genres: string[];
  name: string;
  normalizedName: string;
  status: string;
  totalBooks: Nullable<number>;
};

export type UpdateSeriesData = {
  authorIds?: string[];
  fields: Prisma.SeriesUncheckedUpdateManyInput;
};

type CreateSeriesInput = {
  authorIds: string[];
  data: CreateSeriesData;
  userId: string;
};

const seriesWithBookCountArgs = {
  include: {
    _count: { select: { books: { where: SOFT_DELETE_SCOPE.active } } },
    authors: { include: { author: true }, orderBy: { author: { name: "asc" } } },
    books: {
      select: {
        ageCategory: true,
        authors: { include: { author: true }, orderBy: { position: "asc" } },
        coverMedia: true,
        createdAt: true,
        formats: true,
        id: true,
        isFavorite: true,
        language: true,
        ownershipStatus: true,
        pagesCount: true,
        partNumber: true,
        publicationYear: true,
        publisherId: true,
        readingProgress: { select: { rating: true } },
        readingStatus: true,
        tags: { select: { tag: { select: { id: true, name: true } } } },
        title: true,
        updatedAt: true,
      },
      where: SOFT_DELETE_SCOPE.active,
    },
  },
} satisfies Prisma.SeriesDefaultArgs;

export type SeriesWithBookCount = Prisma.SeriesGetPayload<typeof seriesWithBookCountArgs>;

const seriesDetailsArgs = {
  include: {
    _count: { select: { books: { where: SOFT_DELETE_SCOPE.active } } },
    authors: { include: { author: true }, orderBy: { author: { name: "asc" } } },
    books: {
      include: {
        authors: { include: { author: true }, orderBy: { position: "asc" } },
        coverMedia: true,
        deliveries: { orderBy: { createdAt: "desc" } },
        loans: { orderBy: { createdAt: "desc" }, take: 1, where: { status: "active" } },
        publisher: true,
        readingProgress: {
          select: { currentPage: true, finishedAt: true, rating: true, startedAt: true },
        },
        tags: { include: { tag: true } },
      },
      where: SOFT_DELETE_SCOPE.active,
    },
  },
} satisfies Prisma.SeriesDefaultArgs;

export type SeriesWithDetails = Prisma.SeriesGetPayload<typeof seriesDetailsArgs>;

const favoriteContinuationBookArgs = {
  select: {
    authors: { include: { author: true }, orderBy: { position: "asc" } },
    coverMedia: true,
    createdAt: true,
    favoriteAddedAt: true,
    id: true,
    isFavorite: true,
    ownershipStatus: true,
    pagesCount: true,
    partNumber: true,
    queuePosition: true,
    queuePriority: true,
    readingProgress: { select: { currentPage: true } },
    readingStatus: true,
    series: { select: { id: true, name: true, status: true, totalBooks: true } },
    title: true,
  },
} satisfies Prisma.BookDefaultArgs;

export type FavoriteContinuationBookRow = Prisma.BookGetPayload<
  typeof favoriteContinuationBookArgs
>;

type CountSeriesInput = {
  query: SeriesSearchQuery;
  userId: string;
};

type SearchSeriesInput = CountSeriesInput & {
  skip: number;
  take: number;
};

const trashedSeriesSelect = {
  _count: { select: { books: { where: SOFT_DELETE_SCOPE.active } } },
  deletedAt: true,
  id: true,
  name: true,
  purgeAt: true,
} satisfies Prisma.SeriesSelect;

export type TrashedSeriesRow = Trashed<TrashedSeriesSelection>;

type TrashedSeriesSelection = Prisma.SeriesGetPayload<{ select: typeof trashedSeriesSelect }>;

@Injectable()
export class SeriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireCreateLock(userId: string, client: Prisma.TransactionClient): Promise<void> {
    await acquireAdvisoryLock(
      { classId: ADVISORY_LOCK_CLASS.series, key: `series:create:${userId}` },
      client,
    );
  }

  countBooksInSeries(userId: string): Promise<number> {
    return this.prisma.book.count({
      where: { ...SOFT_DELETE_SCOPE.active, seriesId: { not: null }, userId },
    });
  }

  async countOwned({ query, userId }: CountSeriesInput): Promise<number> {
    const rows = await this.prisma.$queryRaw(buildSeriesCountQuery({ query, userId }));
    const [row] = z.array(z.object({ total: z.number().int() })).parse(rows);
    return row?.total ?? 0;
  }

  countTrashed({ userId }: { userId: string }): Promise<number> {
    return this.prisma.series.count({ where: { ...SOFT_DELETE_SCOPE.trashed, userId } });
  }

  create(
    { authorIds, data, userId }: CreateSeriesInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SeriesWithBookCount> {
    return client.series.create({
      data: {
        ...data,
        authors: { create: authorIds.map((authorId) => ({ authorId })) },
        userId,
      },
      ...seriesWithBookCountArgs,
    });
  }

  async createByNormalized(
    { authorIds, data, userId }: CreateSeriesInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SeriesModel> {
    const series = await client.series.create({ data: { ...data, userId } });
    if (authorIds.length > 0) {
      await client.seriesAuthor.createMany({
        data: authorIds.map((authorId) => ({ authorId, seriesId: series.id })),
        skipDuplicates: true,
      });
    }
    return series;
  }

  findAllOwned(userId: string): Promise<SeriesWithBookCount[]> {
    return this.prisma.series.findMany({
      where: { ...SOFT_DELETE_SCOPE.active, userId },
      ...seriesWithBookCountArgs,
    });
  }

  findByNormalized(
    userId: string,
    normalizedName: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<SeriesModel>> {
    return client.series.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, normalizedName, userId },
    });
  }

  findFavoriteContinuationBooks(userId: string): Promise<FavoriteContinuationBookRow[]> {
    return this.prisma.book.findMany({
      where: {
        ...SOFT_DELETE_SCOPE.active,
        series: { books: { some: { ...SOFT_DELETE_SCOPE.active, isFavorite: true, userId } } },
        seriesId: { not: null },
        userId,
      },
      ...favoriteContinuationBookArgs,
    });
  }

  findForPurge({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<Nullable<{ deletedAt: Nullable<Date> }>> {
    return this.prisma.series.findFirst({
      select: { deletedAt: true },
      where: { id: seriesId, userId },
    });
  }

  findOwnedById(
    userId: string,
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<SeriesModel>> {
    return client.series.findFirst({ where: { ...SOFT_DELETE_SCOPE.active, id, userId } });
  }

  findOwnedDetailsById(userId: string, id: string): Promise<Nullable<SeriesWithDetails>> {
    return this.prisma.series.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, id, userId },
      ...seriesDetailsArgs,
    });
  }

  findOwnedWithCountById(userId: string, id: string): Promise<Nullable<SeriesWithBookCount>> {
    return this.prisma.series.findFirst({
      where: { ...SOFT_DELETE_SCOPE.active, id, userId },
      ...seriesWithBookCountArgs,
    });
  }

  findPurgeCandidates({
    limit,
    now,
  }: {
    limit: number;
    now: Date;
  }): Promise<{ id: string; userId: string }[]> {
    return this.prisma.series.findMany({
      orderBy: { purgeAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: SOFT_DELETE_SCOPE.overdue(now),
    });
  }

  hardDeleteIfTrashed(
    { now, seriesId, userId }: { now: Date; seriesId: string; userId: string },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const purgeable = await tx.series.findFirst({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.overdue(now), id: seriesId, userId },
      });
      if (purgeable === null) {
        return 0;
      }
      await tx.book.updateMany({
        data: { partNumber: null, seriesId: null },
        where: { seriesId, userId },
      });
      const purged = await tx.series.deleteMany({
        where: { ...SOFT_DELETE_SCOPE.overdue(now), id: seriesId, userId },
      });
      return purged.count;
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
  }): Promise<TrashedSeriesRow[]> {
    const rows = await this.prisma.series.findMany({
      orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
      select: trashedSeriesSelect,
      skip,
      take,
      where: { ...SOFT_DELETE_SCOPE.trashed, userId },
    });
    return rows.filter(isTrashed);
  }

  async restore({ seriesId, userId }: { seriesId: string; userId: string }): Promise<number> {
    const restored = await this.prisma.series.updateMany({
      data: SOFT_DELETE_SCOPE.restored,
      where: { ...SOFT_DELETE_SCOPE.trashed, id: seriesId, userId },
    });
    return restored.count;
  }

  async searchOwned({
    query,
    skip,
    take,
    userId,
  }: SearchSeriesInput): Promise<SeriesWithBookCount[]> {
    const rows = await this.prisma.$queryRaw(buildSeriesPageQuery({ query, skip, take, userId }));
    const orderedIds = z
      .array(z.object({ id: z.uuid() }))
      .parse(rows)
      .map((row) => row.id);
    if (orderedIds.length === 0) {
      return [];
    }

    const series = await this.prisma.series.findMany({
      where: { id: { in: orderedIds } },
      ...seriesWithBookCountArgs,
    });
    const seriesById = new Map(series.map((row) => [row.id, row]));

    return orderedIds.flatMap((id) => {
      const row = seriesById.get(id);
      return row === undefined ? [] : [row];
    });
  }

  async softDelete({
    seriesId,
    stamp,
    userId,
  }: {
    seriesId: string;
    stamp: TrashStamp;
    userId: string;
  }): Promise<number> {
    const deleted = await this.prisma.series.updateMany({
      data: stamp,
      where: { ...SOFT_DELETE_SCOPE.active, id: seriesId, userId },
    });
    return deleted.count;
  }

  updateOwned(
    userId: string,
    id: string,
    data: UpdateSeriesData,
    client?: Prisma.TransactionClient,
  ): Promise<SeriesWithBookCount> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const updated = await tx.series.updateMany({
        data: data.fields,
        where: { ...SOFT_DELETE_SCOPE.active, id, userId },
      });
      if (updated.count === 0) {
        throw new NotFoundError("Series not found");
      }

      if (data.authorIds !== undefined) {
        await tx.seriesAuthor.deleteMany({ where: { seriesId: id } });
        if (data.authorIds.length > 0) {
          await tx.seriesAuthor.createMany({
            data: data.authorIds.map((authorId) => ({ authorId, seriesId: id })),
          });
        }
      }

      return tx.series.findFirstOrThrow({
        where: { ...SOFT_DELETE_SCOPE.active, id, userId },
        ...seriesWithBookCountArgs,
      });
    });
  }
}
