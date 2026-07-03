import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { SeriesModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";

export type CreateSeriesData = {
  description: null | string;
  name: string;
  normalizedName: string;
  status: string;
  totalBooks: null | number;
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
} satisfies Prisma.SeriesDefaultArgs;

export type SeriesWithBookCount = Prisma.SeriesGetPayload<typeof seriesWithBookCountArgs>;

const seriesDetailsArgs = {
  include: {
    _count: { select: { books: true } },
    authors: { include: { author: true }, orderBy: { author: { name: "asc" } } },
    books: {
      include: {
        authors: { include: { author: true }, orderBy: { position: "asc" } },
        readingProgress: { select: { currentPage: true, rating: true } },
      },
    },
  },
} satisfies Prisma.SeriesDefaultArgs;

export type SeriesWithDetails = Prisma.SeriesGetPayload<typeof seriesDetailsArgs>;

type CountSeriesInput = {
  authorIds: string[] | undefined;
  query: string | undefined;
  userId: string;
};

type OwnedWhereInput = {
  authorIds: string[] | undefined;
  query: string | undefined;
  userId: string;
};

type SearchSeriesInput = {
  authorIds: string[] | undefined;
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

@Injectable()
export class SeriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  countBooksInSeries(userId: string): Promise<number> {
    return this.prisma.book.count({ where: { seriesId: { not: null }, userId } });
  }

  countOwned({ authorIds, query, userId }: CountSeriesInput): Promise<number> {
    return this.prisma.series.count({ where: buildOwnedWhere({ authorIds, query, userId }) });
  }

  create({ authorIds, data, userId }: CreateSeriesInput): Promise<SeriesWithBookCount> {
    return this.prisma.series.create({
      data: {
        ...data,
        authors: { create: authorIds.map((authorId) => ({ authorId })) },
        userId,
      },
      ...seriesWithBookCountArgs,
    });
  }

  deleteOwned(userId: string, id: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await tx.book.updateMany({
        data: { partNumber: null, seriesId: null },
        where: { seriesId: id, userId },
      });
      const deleted = await tx.series.deleteMany({ where: { id, userId } });
      if (deleted.count === 0) {
        throw new NotFoundError("Series not found");
      }
    });
  }

  findAllOwned(userId: string): Promise<SeriesWithBookCount[]> {
    return this.prisma.series.findMany({ where: { userId }, ...seriesWithBookCountArgs });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<null | SeriesModel> {
    return this.prisma.series.findFirst({ where: { normalizedName, userId } });
  }

  findOwnedById(userId: string, id: string): Promise<null | SeriesModel> {
    return this.prisma.series.findFirst({ where: { id, userId } });
  }

  findOwnedDetailsById(userId: string, id: string): Promise<null | SeriesWithDetails> {
    return this.prisma.series.findFirst({ where: { id, userId }, ...seriesDetailsArgs });
  }

  findOwnedWithCountById(userId: string, id: string): Promise<null | SeriesWithBookCount> {
    return this.prisma.series.findFirst({ where: { id, userId }, ...seriesWithBookCountArgs });
  }

  searchOwned({
    authorIds,
    query,
    skip,
    take,
    userId,
  }: SearchSeriesInput): Promise<SeriesWithBookCount[]> {
    return this.prisma.series.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      where: buildOwnedWhere({ authorIds, query, userId }),
      ...seriesWithBookCountArgs,
    });
  }

  updateOwned(userId: string, id: string, data: UpdateSeriesData): Promise<SeriesWithBookCount> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.series.updateMany({ data: data.fields, where: { id, userId } });
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

      return tx.series.findFirstOrThrow({ where: { id, userId }, ...seriesWithBookCountArgs });
    });
  }
}

function buildOwnedWhere({ authorIds, query, userId }: OwnedWhereInput): Prisma.SeriesWhereInput {
  const where: Prisma.SeriesWhereInput = { userId };

  if (query !== undefined && query.length > 0) {
    where.name = { contains: query, mode: "insensitive" };
  }

  if (authorIds !== undefined && authorIds.length > 0) {
    where.OR = [{ authors: { some: { authorId: { in: authorIds } } } }, { authors: { none: {} } }];
  }

  return where;
}
