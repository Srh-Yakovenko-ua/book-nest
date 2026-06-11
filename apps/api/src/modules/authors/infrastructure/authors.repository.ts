import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuthorModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type CreateGlobalAuthorData = {
  bio: null | string;
  birthYear: null | number;
  countryCode: null | string;
  deathYear: null | number;
  name: string;
  normalizedName: string;
  openLibraryKey: string;
  photoUrl: null | string;
  wikidataId: null | string;
};

type AuthorLookupMatch = {
  normalizedName: string;
  openLibraryKey: null | string;
};

type FindExistingByLookupInput = {
  normalizedNames: string[];
  openLibraryKeys: string[];
  userId: string;
};

type SearchAuthorsInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

@Injectable()
export class AuthorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.author.count({ where: buildVisibleWhere(userId, query) });
  }

  create(userId: string, name: string, normalizedName: string): Promise<AuthorModel> {
    return this.prisma.author.create({ data: { name, normalizedName, userId } });
  }

  createGlobal(data: CreateGlobalAuthorData): Promise<AuthorModel> {
    return this.prisma.author.create({ data: { ...data, userId: null } });
  }

  findByNormalized(userId: string, normalizedName: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({
      where: { normalizedName, OR: [{ userId: null }, { userId }] },
    });
  }

  findExistingByLookup({
    normalizedNames,
    openLibraryKeys,
    userId,
  }: FindExistingByLookupInput): Promise<AuthorLookupMatch[]> {
    const candidateMatches: Prisma.AuthorWhereInput[] = [
      { openLibraryKey: { in: openLibraryKeys } },
      { normalizedName: { in: normalizedNames } },
    ];
    const visibilityClauses: Prisma.AuthorWhereInput[] = [{ userId: null }, { userId }];

    return this.prisma.author.findMany({
      select: { normalizedName: true, openLibraryKey: true },
      where: { AND: [{ OR: candidateMatches }, { OR: visibilityClauses }] },
    });
  }

  findGlobalByNormalizedName(normalizedName: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({ where: { normalizedName, userId: null } });
  }

  findGlobalByOpenLibraryKey(openLibraryKey: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({ where: { openLibraryKey, userId: null } });
  }

  findGlobalByWikidataId(wikidataId: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({ where: { userId: null, wikidataId } });
  }

  findVisibleById(userId: string, id: string): Promise<AuthorModel | null> {
    return this.prisma.author.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
  }

  searchVisible({ query, skip, take, userId }: SearchAuthorsInput): Promise<AuthorModel[]> {
    return this.prisma.author.findMany({
      orderBy: [{ userId: { nulls: "last", sort: "desc" } }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
    });
  }
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.AuthorWhereInput {
  const nameFilter: Prisma.AuthorWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { name: { contains: query, mode: "insensitive" } };

  return { ...nameFilter, OR: [{ userId: null }, { userId }] };
}
