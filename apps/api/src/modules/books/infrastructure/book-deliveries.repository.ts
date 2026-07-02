import type { Currency, DeliveryStatus, OwnershipStatus } from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { BookDeliveryModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";

const DELIVERY_NOT_ACTIVE_MESSAGE = "This delivery is no longer active";

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

export type CreateDeliveryTransition = {
  book: DeliveryBookPatch;
  delivery: CreateDeliveryData;
};

export type RecordDeliveryTransition = {
  book: DeliveryBookPatch;
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

  async applyCreate(
    userId: string,
    bookId: string,
    transition: CreateDeliveryTransition,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const owned = await tx.book.findFirst({
        select: { id: true },
        where: { id: bookId, userId },
      });
      if (owned === null) {
        throw new NotFoundError("Book not found");
      }

      await tx.bookDelivery.create({ data: { ...transition.delivery, bookId, userId } });

      if (Object.keys(transition.book).length > 0) {
        await tx.book.update({ data: transition.book, where: { id: bookId } });
      }
    });
  }

  async applyRecordChange(
    userId: string,
    bookId: string,
    deliveryId: string,
    transition: RecordDeliveryTransition,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.bookDelivery.findFirst({
        select: { id: true },
        where: { book: { userId }, bookId, id: deliveryId },
      });
      if (record === null) {
        throw new NotFoundError("Delivery not found");
      }

      const updated = await tx.bookDelivery.updateMany({
        data: transition.delivery,
        where: { id: deliveryId, status: { in: [...DELIVERY_ACTIVE_STATUSES] } },
      });
      if (updated.count === 0) {
        throw new ConflictError(DELIVERY_NOT_ACTIVE_MESSAGE);
      }

      if (Object.keys(transition.book).length > 0) {
        await tx.book.update({ data: transition.book, where: { id: bookId } });
      }
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
