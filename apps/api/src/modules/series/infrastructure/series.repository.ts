import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { SeriesModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type CreateSeriesData = {
  description: null | string;
  name: string;
  normalizedName: string;
  status: string;
  totalBooks: null | number;
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
      },
    },
  },
} satisfies Prisma.SeriesDefaultArgs;

export type SeriesWithBookCount = Prisma.SeriesGetPayload<typeof seriesWithBookCountArgs>;

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

  countOwned({ authorIds, query, userId }: CountSeriesInput): Promise<number> {
    return this.prisma.series.count({ where: buildOwnedWhere({ authorIds, query, userId }) });
  }

  create({ authorIds, data, userId }: CreateSeriesInput): Promise<SeriesModel> {
    return this.prisma.series.create({
      data: {
        ...data,
        authors: { create: authorIds.map((authorId) => ({ authorId })) },
        userId,
      },
    });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<null | SeriesModel> {
    return this.prisma.series.findFirst({ where: { normalizedName, userId } });
  }

  findOwnedById(userId: string, id: string): Promise<null | SeriesModel> {
    return this.prisma.series.findFirst({ where: { id, userId } });
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
