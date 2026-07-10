import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { AuthorModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const primaryNamesArgs = {
  include: { names: { where: { isPrimary: true } } },
} satisfies Prisma.AuthorDefaultArgs;

export type AuthorNameSeed = {
  isPrimary: boolean;
  locale: string;
  name: string;
  normalizedName: string;
};

export type AuthorWithPrimaryNames = Prisma.AuthorGetPayload<typeof primaryNamesArgs>;

export type CreateGlobalAuthorData = {
  bio: null | string;
  birthYear: null | number;
  countryCode: null | string;
  deathYear: null | number;
  name: string;
  normalizedName: string;
  openLibraryKey: string;
  photoUrl: null | string;
  searchText: string;
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

type RecentAuthorsInput = {
  limit: number;
  userId: string;
};

type SearchAuthorsInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

type UpsertCustomAuthorInput = {
  locale: string;
  name: string;
  normalizedName: string;
  userId: string;
};

type VisibleByIdsInput = {
  ids: string[];
  userId: string;
};

@Injectable()
export class AuthorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.author.count({ where: buildVisibleWhere(userId, query) });
  }

  createGlobal(data: CreateGlobalAuthorData, names: AuthorNameSeed[]): Promise<AuthorModel> {
    return this.prisma.author.create({
      data: { ...data, names: { create: names }, userId: null },
    });
  }

  findBaseByIds({ ids, userId }: VisibleByIdsInput): Promise<{ id: string; name: string }[]> {
    return this.prisma.author.findMany({
      select: { id: true, name: true },
      where: { id: { in: ids }, OR: [{ userId: null }, { userId }] },
    });
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

  findVisibleByIdsWithNames({ ids, userId }: VisibleByIdsInput): Promise<AuthorWithPrimaryNames[]> {
    return this.prisma.author.findMany({
      where: { id: { in: ids }, OR: [{ userId: null }, { userId }] },
      ...primaryNamesArgs,
    });
  }

  findVisibleByIdWithNames(userId: string, id: string): Promise<AuthorWithPrimaryNames | null> {
    return this.prisma.author.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
      ...primaryNamesArgs,
    });
  }

  async recentAuthorIds({ limit, userId }: RecentAuthorsInput): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ authorId: string }[]>`
      SELECT book_author.author_id AS "authorId"
      FROM book_authors book_author
      JOIN books book ON book.id = book_author.book_id
      WHERE book.user_id = ${userId}::uuid
      GROUP BY book_author.author_id
      ORDER BY max(book.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.authorId);
  }

  searchVisible({
    query,
    skip,
    take,
    userId,
  }: SearchAuthorsInput): Promise<AuthorWithPrimaryNames[]> {
    return this.prisma.author.findMany({
      orderBy: [{ userId: { nulls: "last", sort: "desc" } }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
      ...primaryNamesArgs,
    });
  }

  async upsertByNormalized({
    locale,
    name,
    normalizedName,
    userId,
  }: UpsertCustomAuthorInput): Promise<AuthorModel> {
    const author = await this.prisma.author.upsert({
      create: { name, normalizedName, searchText: normalizedName, userId },
      update: { normalizedName },
      where: { userId_normalizedName: { normalizedName, userId } },
    });
    await this.prisma.authorName.upsert({
      create: { authorId: author.id, isPrimary: true, locale, name, normalizedName },
      update: { normalizedName },
      where: { authorId_locale_normalizedName: { authorId: author.id, locale, normalizedName } },
    });
    return author;
  }
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.AuthorWhereInput {
  const searchFilter: Prisma.AuthorWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { searchText: { contains: query, mode: "insensitive" } };

  return { ...searchFilter, OR: [{ userId: null }, { userId }] };
}
