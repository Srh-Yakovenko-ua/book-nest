import type { Currency, DeliveryStatus, Nullable, OwnershipStatus } from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookDeliveryModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { runInClient } from "../../../core/database/run-in-client.js";

export type CreateDeliveryData = {
  currency: Nullable<Currency>;
  deliveryService: Nullable<string>;
  expectedDeliveryDate: Nullable<Date>;
  note: Nullable<string>;
  orderDate: Nullable<Date>;
  orderNumber: Nullable<string>;
  price: Nullable<number>;
  status: DeliveryStatus;
  storeName: Nullable<string>;
  trackingNumber: Nullable<string>;
  trackingUrl: Nullable<string>;
};

export type CreateDeliveryOutcome = "book-not-found" | "created" | "status-conflict";

export type CreateDeliveryTransition = {
  book: DeliveryBookPatch;
  delivery: CreateDeliveryData;
};

export type RecordDeliveryOutcome = "applied" | "not-active" | "not-found";

export type RecordDeliveryTransition = {
  book: Nullable<DeliveryBookPatch>;
  delivery: UpdateDeliveryData;
};

export type UpdateDeliveryData = {
  cancelledAt?: Date;
  cancelReason?: Nullable<string>;
  currency?: Nullable<Currency>;
  deliveryService?: Nullable<string>;
  expectedDeliveryDate?: Nullable<Date>;
  note?: Nullable<string>;
  orderDate?: Nullable<Date>;
  orderNumber?: Nullable<string>;
  price?: Nullable<number>;
  receivedAt?: Date;
  status?: DeliveryStatus;
  storeName?: Nullable<string>;
  trackingNumber?: Nullable<string>;
  trackingUrl?: Nullable<string>;
};

type DeliveryBookPatch = { ownershipStatus?: OwnershipStatus };

@Injectable()
export class BookDeliveriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  applyCreate(
    userId: string,
    bookId: string,
    transition: CreateDeliveryTransition,
    expectedStatuses: OwnershipStatus[],
    client?: Prisma.TransactionClient,
  ): Promise<CreateDeliveryOutcome> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const guarded = await tx.book.updateMany({
        data: transition.book,
        where: { id: bookId, ownershipStatus: { in: expectedStatuses }, userId },
      });
      if (guarded.count === 0) {
        const exists = await tx.book.findFirst({
          select: { id: true },
          where: { id: bookId, userId },
        });
        return exists === null ? "book-not-found" : "status-conflict";
      }

      await tx.bookDelivery.create({ data: { ...transition.delivery, bookId, userId } });

      return "created";
    });
  }

  applyRecordChange(
    userId: string,
    bookId: string,
    deliveryId: string,
    transition: RecordDeliveryTransition,
    client?: Prisma.TransactionClient,
  ): Promise<RecordDeliveryOutcome> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const record = await tx.bookDelivery.findFirst({
        select: { id: true },
        where: { book: { userId }, bookId, id: deliveryId },
      });
      if (record === null) {
        return "not-found";
      }

      const updated = await tx.bookDelivery.updateMany({
        data: transition.delivery,
        where: { id: deliveryId, status: { in: [...DELIVERY_ACTIVE_STATUSES] } },
      });
      if (updated.count === 0) {
        return "not-active";
      }

      if (transition.book !== null) {
        await tx.book.update({ data: transition.book, where: { id: bookId } });
      }

      return "applied";
    });
  }

  async listForOwnedBook({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<BookDeliveryModel[]>> {
    const owned = await this.prisma.book.findFirst({
      select: { id: true },
      where: { id: bookId, userId },
    });
    if (owned === null) {
      return null;
    }

    return this.prisma.bookDelivery.findMany({
      orderBy: { createdAt: "desc" },
      where: { bookId },
    });
  }
}
