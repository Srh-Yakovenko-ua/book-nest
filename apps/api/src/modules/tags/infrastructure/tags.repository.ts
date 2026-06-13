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

@Injectable()
export class TagsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countOwned({ query, userId }: CountTagsInput): Promise<number> {
    return this.prisma.tag.count({ where: buildOwnedWhere(userId, query) });
  }

  create(userId: string, name: string, normalizedName: string): Promise<TagModel> {
    return this.prisma.tag.create({ data: { name, normalizedName, userId } });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<null | TagModel> {
    return this.prisma.tag.findFirst({ where: { normalizedName, userId } });
  }

  searchOwned({ query, skip, take, userId }: SearchTagsInput): Promise<TagModel[]> {
    return this.prisma.tag.findMany({
      orderBy: { name: "asc" },
      skip,
      take,
      where: buildOwnedWhere(userId, query),
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
