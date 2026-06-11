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

type SearchSeriesInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

@Injectable()
export class SeriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.series.count({ where: buildVisibleWhere(userId, query) });
  }

  create(userId: string, data: CreateSeriesData): Promise<SeriesModel> {
    return this.prisma.series.create({ data: { ...data, userId } });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<null | SeriesModel> {
    return this.prisma.series.findFirst({ where: { normalizedName, userId } });
  }

  findOwnedById(userId: string, id: string): Promise<null | SeriesModel> {
    return this.prisma.series.findFirst({ where: { id, userId } });
  }

  searchVisible({ query, skip, take, userId }: SearchSeriesInput): Promise<SeriesModel[]> {
    return this.prisma.series.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      where: buildVisibleWhere(userId, query),
    });
  }
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.SeriesWhereInput {
  if (query === undefined || query.length === 0) {
    return { userId };
  }

  return { name: { contains: query, mode: "insensitive" }, userId };
}
