import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { DeliveryServiceModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CountInput = {
  query: string | undefined;
  userId: string;
};

type DeleteOwnCustomInput = {
  id: string;
  userId: string;
};

type FindVisibleByNormalizedNameInput = {
  normalizedName: string;
  userId: string;
};

type FindVisibleByNormalizedNamesInput = {
  normalizedNames: string[];
  userId: string;
};

type SearchInput = {
  query: string | undefined;
  skip: number;
  take: number;
  userId: string;
};

type UpsertCustomInput = {
  name: string;
  normalizedName: string;
  userId: string;
};

@Injectable()
export class DeliveryServicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  count({ query, userId }: CountInput): Promise<number> {
    return this.prisma.deliveryService.count({ where: buildVisibleWhere(userId, query) });
  }

  deleteOwnCustom({ id, userId }: DeleteOwnCustomInput): Promise<number> {
    return this.prisma.deliveryService
      .deleteMany({ where: { id, userId } })
      .then((result) => result.count);
  }

  findVisibleByNormalizedName(
    { normalizedName, userId }: FindVisibleByNormalizedNameInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<DeliveryServiceModel | null> {
    return client.deliveryService.findFirst({
      where: { normalizedName, OR: [{ userId: null }, { userId }] },
    });
  }

  findVisibleByNormalizedNames({
    normalizedNames,
    userId,
  }: FindVisibleByNormalizedNamesInput): Promise<DeliveryServiceModel[]> {
    if (normalizedNames.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.deliveryService.findMany({
      orderBy: { userId: { nulls: "first", sort: "asc" } },
      where: { normalizedName: { in: normalizedNames }, OR: [{ userId: null }, { userId }] },
    });
  }

  async recentDeliveryServiceNames({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ name: string }[]>`
      SELECT lower(bd.delivery_service) AS "name"
      FROM book_deliveries bd
      JOIN books b ON b.id = bd.book_id
      WHERE b.user_id = ${userId}::uuid AND bd.delivery_service IS NOT NULL
      GROUP BY lower(bd.delivery_service)
      ORDER BY max(bd.created_at) DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.name);
  }

  search({ query, skip, take, userId }: SearchInput): Promise<DeliveryServiceModel[]> {
    return this.prisma.deliveryService.findMany({
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      skip,
      take,
      where: buildVisibleWhere(userId, query),
    });
  }

  upsertCustom(
    { name, normalizedName, userId }: UpsertCustomInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<DeliveryServiceModel> {
    return client.deliveryService.upsert({
      create: { isDefault: false, name, normalizedName, sortOrder: 0, userId },
      update: { name },
      where: { userId_normalizedName: { normalizedName, userId } },
    });
  }
}

function buildVisibleWhere(
  userId: string,
  query: string | undefined,
): Prisma.DeliveryServiceWhereInput {
  const nameFilter: Prisma.DeliveryServiceWhereInput =
    query === undefined || query.length === 0
      ? {}
      : { name: { contains: query, mode: "insensitive" } };

  return { ...nameFilter, OR: [{ userId: null }, { userId }] };
}
