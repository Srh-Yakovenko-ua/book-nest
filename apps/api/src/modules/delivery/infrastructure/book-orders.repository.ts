import type { Currency, Nullable, ShipmentStatus } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

const bookOrderRelations = {
  include: {
    items: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      where: { book: SOFT_DELETE_SCOPE.active },
    },
    shipments: {
      include: { deliveryService: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    },
  },
} satisfies Prisma.BookOrderDefaultArgs;

export type BookOrderPatch = {
  currency?: Nullable<Currency>;
  deliveryPrice?: Nullable<number>;
  discount?: Nullable<number>;
  isFree?: boolean;
  note?: Nullable<string>;
  orderDate?: Nullable<Date>;
  orderNumber?: Nullable<string>;
  storeName?: string;
  totalAmount?: Nullable<number>;
};

export type BookOrderWithRelations = Prisma.BookOrderGetPayload<typeof bookOrderRelations>;

export type NewBookOrderData = {
  currency: Nullable<Currency>;
  deliveryPrice: Nullable<number>;
  discount: Nullable<number>;
  isFree: boolean;
  note: Nullable<string>;
  orderDate: Nullable<Date>;
  orderNumber: Nullable<string>;
  storeName: string;
  totalAmount: Nullable<number>;
};

export type NewBookOrderItemData = {
  bookId: string;
  price: Nullable<number>;
};

export type NewOrderShipment = {
  bookIds: string[];
  data: NewShipmentData;
};

export type NewShipmentData = {
  deliveryServiceId: Nullable<string>;
  deliveryServiceName: Nullable<string>;
  expectedDeliveryDate: Nullable<Date>;
  note: Nullable<string>;
  pickupUntil: Nullable<Date>;
  status: ShipmentStatus;
  trackingNumber: Nullable<string>;
  trackingUrl: Nullable<string>;
};

type CreateBookOrderInput = {
  items: NewBookOrderItemData[];
  order: NewBookOrderData;
  shipments: NewOrderShipment[];
  userId: string;
};

type OwnedOrderRef = {
  orderId: string;
  userId: string;
};

@Injectable()
export class BookOrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    { items, order, shipments, userId }: CreateBookOrderInput,
    client?: Prisma.TransactionClient,
  ): Promise<Nullable<BookOrderWithRelations>> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const bookIds = [...new Set(items.map((item) => item.bookId))];
      const ownedBooksCount = await tx.book.count({
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
      });
      if (ownedBooksCount !== bookIds.length) {
        return null;
      }

      const created = await tx.bookOrder.create({ data: { ...order, userId } });

      const shipmentRows = shipments.map((shipment) => ({ ...shipment, id: randomUUID() }));
      if (shipmentRows.length > 0) {
        await tx.shipment.createMany({
          data: shipmentRows.map((shipment) => ({
            ...shipment.data,
            id: shipment.id,
            orderId: created.id,
          })),
        });
      }

      const shipmentIdByBookId = new Map(
        shipmentRows.flatMap((shipment) =>
          shipment.bookIds.map((bookId) => [bookId, shipment.id] as const),
        ),
      );
      await tx.bookOrderItem.createMany({
        data: items.map((item) => ({
          ...item,
          orderId: created.id,
          shipmentId: shipmentIdByBookId.get(item.bookId) ?? null,
        })),
      });

      return tx.bookOrder.findUniqueOrThrow({ where: { id: created.id }, ...bookOrderRelations });
    });
  }

  findOwnedById(
    { orderId, userId }: OwnedOrderRef,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookOrderWithRelations>> {
    return client.bookOrder.findFirst({
      where: { id: orderId, userId },
      ...bookOrderRelations,
    });
  }

  async updateOwned(
    { data, orderId, userId }: OwnedOrderRef & { data: BookOrderPatch },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.bookOrder.updateMany({
      data,
      where: { id: orderId, userId },
    });
    return updated.count;
  }
}
