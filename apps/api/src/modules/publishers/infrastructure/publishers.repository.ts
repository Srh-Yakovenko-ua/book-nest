import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { PublisherModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type SearchPublishersInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

@Injectable()
export class PublishersRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.publisher.count({ where: buildVisibleWhere(userId, query) });
  }

  create(userId: string, name: string, normalizedName: string): Promise<PublisherModel> {
    return this.prisma.publisher.create({ data: { name, normalizedName, userId } });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<null | PublisherModel> {
    return this.prisma.publisher.findFirst({
      where: { normalizedName, OR: [{ userId: null }, { userId }] },
    });
  }

  findVisibleById(userId: string, id: string): Promise<null | PublisherModel> {
    return this.prisma.publisher.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
  }

  searchVisible({ query, skip, take, userId }: SearchPublishersInput): Promise<PublisherModel[]> {
    return this.prisma.publisher.findMany({
      orderBy: [{ userId: { nulls: "last", sort: "desc" } }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
    });
  }
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.PublisherWhereInput {
  const nameFilter: Prisma.PublisherWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { name: { contains: query, mode: "insensitive" } };

  return { ...nameFilter, OR: [{ userId: null }, { userId }] };
}
