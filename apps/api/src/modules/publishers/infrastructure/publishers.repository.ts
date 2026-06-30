import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { PublisherModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const primaryNamesArgs = {
  include: { names: { where: { isPrimary: true } } },
} satisfies Prisma.PublisherDefaultArgs;

export type CreateGlobalPublisherData = {
  countryCode: null | string;
  foundedYear: null | number;
  logoAttribution: null | string;
  logoLicense: null | string;
  logoLicenseUrl: null | string;
  logoUrl: null | string;
  name: string;
  normalizedName: string;
  searchText: string;
  websiteUrl: null | string;
  wikidataId: null | string;
};

export type PublisherNameSeed = {
  isPrimary: boolean;
  locale: string;
  name: string;
  normalizedName: string;
};

export type PublisherWithPrimaryNames = Prisma.PublisherGetPayload<typeof primaryNamesArgs>;

type CreateCustomPublisherInput = {
  locale: string;
  name: string;
  normalizedName: string;
};

type RecentPublishersInput = {
  limit: number;
  userId: string;
};

type SearchPublishersInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

type VisibleByIdsInput = {
  ids: string[];
  userId: string;
};

@Injectable()
export class PublishersRepository {
  constructor(private readonly prisma: PrismaService) {}

  countVisible(userId: string, query: string | undefined): Promise<number> {
    return this.prisma.publisher.count({ where: buildVisibleWhere(userId, query) });
  }

  create(userId: string, input: CreateCustomPublisherInput): Promise<PublisherWithPrimaryNames> {
    return this.prisma.publisher.create({
      data: {
        name: input.name,
        names: {
          create: [
            {
              isPrimary: true,
              locale: input.locale,
              name: input.name,
              normalizedName: input.normalizedName,
            },
          ],
        },
        normalizedName: input.normalizedName,
        searchText: input.normalizedName,
        userId,
      },
      ...primaryNamesArgs,
    });
  }

  createGlobal(
    data: CreateGlobalPublisherData,
    names: PublisherNameSeed[],
  ): Promise<PublisherModel> {
    return this.prisma.publisher.create({
      data: { ...data, names: { create: names }, userId: null },
    });
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

  findVisibleByIds({ ids, userId }: VisibleByIdsInput): Promise<PublisherWithPrimaryNames[]> {
    return this.prisma.publisher.findMany({
      where: { id: { in: ids }, OR: [{ userId: null }, { userId }] },
      ...primaryNamesArgs,
    });
  }

  async recentPublisherIds({ limit, userId }: RecentPublishersInput): Promise<string[]> {
    const grouped = await this.prisma.book.groupBy({
      _max: { createdAt: true },
      by: ["publisherId"],
      orderBy: { _max: { createdAt: "desc" } },
      take: limit,
      where: { publisherId: { not: null }, userId },
    });

    return grouped.flatMap((row) => (row.publisherId === null ? [] : [row.publisherId]));
  }

  searchVisible({
    query,
    skip,
    take,
    userId,
  }: SearchPublishersInput): Promise<PublisherWithPrimaryNames[]> {
    return this.prisma.publisher.findMany({
      orderBy: [{ userId: { nulls: "last", sort: "desc" } }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
      ...primaryNamesArgs,
    });
  }
}

function buildVisibleWhere(userId: string, query: string | undefined): Prisma.PublisherWhereInput {
  const searchFilter: Prisma.PublisherWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { searchText: { contains: query, mode: "insensitive" } };

  return { ...searchFilter, OR: [{ userId: null }, { userId }] };
}
