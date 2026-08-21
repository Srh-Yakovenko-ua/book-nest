import type { OwnershipStatus } from "@app/shared";

import { OwnershipStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

const WISHLIST_OWNERSHIP_STATUS = OwnershipStatusSchema.enum.want_to_buy;

export type OrderBookRow = {
  id: string;
  ownershipStatus: string;
};

type ApplyOwnershipInput = OwnedBooksRef & {
  expectedStatus?: OwnershipStatus;
  now: Date;
  ownershipStatus: OwnershipStatus;
};

type OwnedBooksRef = {
  bookIds: string[];
  userId: string;
};

@Injectable()
export class OrderBooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async applyOwnership(
    { bookIds, expectedStatus, now, ownershipStatus, userId }: ApplyOwnershipInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    if (bookIds.length === 0) {
      return 0;
    }

    const scope = {
      ...SOFT_DELETE_SCOPE.active,
      id: { in: bookIds },
      userId,
      ...(expectedStatus === undefined ? {} : { ownershipStatus: expectedStatus }),
    };
    if (ownershipStatus === WISHLIST_OWNERSHIP_STATUS) {
      await client.book.updateMany({
        data: { wishlistAddedAt: now },
        where:
          expectedStatus === undefined
            ? { ...scope, ownershipStatus: { not: WISHLIST_OWNERSHIP_STATUS } }
            : scope,
      });
    } else {
      await client.book.updateMany({
        data: { wishlistAddedAt: null },
        where:
          expectedStatus === undefined
            ? { ...scope, ownershipStatus: WISHLIST_OWNERSHIP_STATUS }
            : scope,
      });
    }

    const updated = await client.book.updateMany({ data: { ownershipStatus }, where: scope });
    return updated.count;
  }

  listOwned(
    { bookIds, userId }: OwnedBooksRef,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<OrderBookRow[]> {
    if (bookIds.length === 0) {
      return Promise.resolve([]);
    }

    return client.book.findMany({
      orderBy: { id: "asc" },
      select: { id: true, ownershipStatus: true },
      where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
    });
  }
}
