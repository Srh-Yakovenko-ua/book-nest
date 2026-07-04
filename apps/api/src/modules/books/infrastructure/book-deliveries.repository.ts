import type { Currency, DeliveryStatus, Nullable, OwnershipStatus } from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { BookDeliveryModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type CreateDeliveryData = {
  currency: Currency | null;
  deliveryService: null | string;
  expectedDeliveryDate: Date | null;
  note: null | string;
  orderDate: Date | null;
  orderNumber: null | string;
  price: null | number;
  status: DeliveryStatus;
  storeName: null | string;
  trackingNumber: null | string;
  trackingUrl: null | string;
};

export type CreateDeliveryOutcome = "book-not-found" | "created";

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
  currency?: Currency | null;
  deliveryService?: null | string;
  expectedDeliveryDate?: Date | null;
  note?: null | string;
  orderDate?: Date | null;
  orderNumber?: null | string;
  price?: null | number;
  receivedAt?: Date;
  status?: DeliveryStatus;
  storeName?: null | string;
  trackingNumber?: null | string;
  trackingUrl?: null | string;
};

type DeliveryBookPatch = { ownershipStatus?: OwnershipStatus };

@Injectable()
export class BookDeliveriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  applyCreate(
    userId: string,
    bookId: string,
    transition: CreateDeliveryTransition,
  ): Promise<CreateDeliveryOutcome> {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.book.findFirst({
        select: { id: true },
        where: { id: bookId, userId },
      });
      if (owned === null) {
        return "book-not-found";
      }

      await tx.bookDelivery.create({ data: { ...transition.delivery, bookId, userId } });

      if (Object.keys(transition.book).length > 0) {
        await tx.book.update({ data: transition.book, where: { id: bookId } });
      }

      return "created";
    });
  }

  applyRecordChange(
    userId: string,
    bookId: string,
    deliveryId: string,
    transition: RecordDeliveryTransition,
  ): Promise<RecordDeliveryOutcome> {
    return this.prisma.$transaction(async (tx) => {
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
  }): Promise<BookDeliveryModel[] | null> {
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
