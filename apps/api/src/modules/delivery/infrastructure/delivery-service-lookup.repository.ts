import type { Nullable } from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { visibleToUser } from "../../../core/database/two-tier-visibility.js";
import { Prisma } from "../../../generated/prisma/client.js";

export type DeliveryServiceRef = {
  id: string;
  name: string;
};

@Injectable()
export class DeliveryServiceLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVisibleByName(
    { name, userId }: { name: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<DeliveryServiceRef>> {
    return client.deliveryService.findFirst({
      orderBy: { userId: { nulls: "first", sort: "asc" } },
      select: { id: true, name: true },
      where: { normalizedName: normalizeName(name), ...visibleToUser(userId) },
    });
  }
}
