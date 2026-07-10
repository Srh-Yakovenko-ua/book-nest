import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { TagModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CountTagsInput = {
  query: string | undefined;
  userId: string;
};

type SearchTagsInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

type UpsertTagInput = {
  name: string;
  normalizedName: string;
  userId: string;
};

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countOwned({ query, userId }: CountTagsInput): Promise<number> {
    return this.prisma.tag.count({ where: buildOwnedWhere(userId, query) });
  }

  deleteOwned(userId: string, id: string): Promise<number> {
    return this.prisma.tag.deleteMany({ where: { id, userId } }).then((result) => result.count);
  }

  findByNormalized(
    userId: string,
    normalizedName: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<TagModel>> {
    return client.tag.findFirst({ where: { normalizedName, userId } });
  }

  searchOwned({ query, skip, take, userId }: SearchTagsInput): Promise<TagModel[]> {
    return this.prisma.tag.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      where: buildOwnedWhere(userId, query),
    });
  }

  upsertByNormalized(
    { name, normalizedName, userId }: UpsertTagInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<TagModel> {
    return client.tag.upsert({
      create: { name, normalizedName, userId },
      update: { normalizedName },
      where: { userId_normalizedName: { normalizedName, userId } },
    });
  }
}

function buildOwnedWhere(userId: string, query: string | undefined): Prisma.TagWhereInput {
  const nameFilter: Prisma.TagWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { name: { contains: query, mode: "insensitive" } };

  return { ...nameFilter, userId };
}
