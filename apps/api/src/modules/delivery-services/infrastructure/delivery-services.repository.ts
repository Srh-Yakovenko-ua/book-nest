import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { DeliveryServiceModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { visibleToUser } from "../../../core/database/two-tier-visibility.js";

const RecentDeliveryServiceNameRowSchema = z.object({ name: z.string() });

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
  ): Promise<Nullable<DeliveryServiceModel>> {
    return client.deliveryService.findFirst({
      orderBy: { userId: { nulls: "first", sort: "asc" } },
      where: { normalizedName, ...visibleToUser(userId) },
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
      where: { normalizedName: { in: normalizedNames }, ...visibleToUser(userId) },
    });
  }

  async recentDeliveryServiceNames({
    limit,
    userId,
  }: {
    limit: number;
    userId: string;
  }): Promise<string[]> {
    const rows = await this.prisma.$queryRaw`
      SELECT lower(shipment.delivery_service_name) AS "name"
      FROM shipments shipment
      JOIN book_orders book_order ON book_order.id = shipment.order_id
      WHERE book_order.user_id = ${userId}::uuid AND shipment.delivery_service_name IS NOT NULL
      GROUP BY lower(shipment.delivery_service_name)
      ORDER BY max(shipment.created_at) DESC
      LIMIT ${limit}
    `;
    return z
      .array(RecentDeliveryServiceNameRowSchema)
      .parse(rows)
      .map((row) => row.name);
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

  return { ...nameFilter, ...visibleToUser(userId) };
}
