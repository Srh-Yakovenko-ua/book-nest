import type { Nullable } from "@app/shared";

import { SHIPMENT_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

const bookOrderItemContext = {
  include: {
    order: {
      include: {
        items: {
          select: { bookId: true, shipmentId: true },
          where: { book: SOFT_DELETE_SCOPE.active },
        },
        shipments: { select: { expectedDeliveryDate: true, id: true } },
      },
    },
    shipment: true,
  },
} satisfies Prisma.BookOrderItemDefaultArgs;

const bookOrderItemHistory = {
  include: { order: true, shipment: { include: { deliveryService: true } } },
} satisfies Prisma.BookOrderItemDefaultArgs;

export type BookOrderItemHistoryRow = Prisma.BookOrderItemGetPayload<typeof bookOrderItemHistory>;

export type BookOrderItemWithContext = Prisma.BookOrderItemGetPayload<typeof bookOrderItemContext>;

export type OrderItemBookRef = {
  bookId: string;
  id: string;
};

type CancelBooksInput = CancelInput & {
  bookIds: string[];
};

type CancelInput = {
  cancelledAt: Date;
  cancelReason: Nullable<string>;
  userId: string;
};

type CancelShipmentItemsInput = CancelInput & {
  shipmentId: string;
};

type CancelSingleItemInput = CancelInput & {
  itemId: string;
};

type MoveItemsInput = {
  itemIds: string[];
  orderId: string;
  shipmentId: Nullable<string>;
  userId: string;
};

type ReceiveBooksInput = {
  bookIds: string[];
  receivedAt: Date;
  userId: string;
};

type ReceiveShipmentItemsInput = {
  receivedAt: Date;
  shipmentId: string;
  userId: string;
};

@Injectable()
export class BookOrderItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  cancelActiveForBooks(
    { bookIds, cancelledAt, cancelReason, userId }: CancelBooksInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<OrderItemBookRef[]> {
    return this.cancelActiveMatching({
      client,
      data: { cancelledAt, cancelReason },
      match: { bookId: { in: bookIds } },
      userId,
    });
  }

  cancelActiveForShipment(
    { cancelledAt, cancelReason, shipmentId, userId }: CancelShipmentItemsInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<OrderItemBookRef[]> {
    return this.cancelActiveMatching({
      client,
      data: { cancelledAt, cancelReason },
      match: { shipmentId },
      userId,
    });
  }

  async cancelOne(
    { cancelledAt, cancelReason, itemId, userId }: CancelSingleItemInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const cancelled = await client.bookOrderItem.updateMany({
      data: { cancelledAt, cancelReason },
      where: { ...activeItemWhere(userId), id: itemId },
    });
    return cancelled.count;
  }

  async findActiveBookIds(
    { bookIds, userId }: { bookIds: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    if (bookIds.length === 0) {
      return [];
    }

    const rows = await client.bookOrderItem.findMany({
      distinct: ["bookId"],
      orderBy: { bookId: "asc" },
      select: { bookId: true },
      where: { ...activeItemWhere(userId), bookId: { in: bookIds } },
    });
    return rows.map((row) => row.bookId);
  }

  findActiveForBook(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookOrderItemWithContext>> {
    return client.bookOrderItem.findFirst({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: { ...activeItemWhere(userId), bookId },
      ...bookOrderItemContext,
    });
  }

  findOwnedById(
    { itemId, userId }: { itemId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookOrderItemWithContext>> {
    return client.bookOrderItem.findFirst({
      where: { book: SOFT_DELETE_SCOPE.active, id: itemId, order: { userId } },
      ...bookOrderItemContext,
    });
  }

  listForBook(
    { bookId, userId }: { bookId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookOrderItemHistoryRow[]> {
    return client.bookOrderItem.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: { book: SOFT_DELETE_SCOPE.active, bookId, order: { userId } },
      ...bookOrderItemHistory,
    });
  }

  async moveToShipment(
    { itemIds, orderId, shipmentId, userId }: MoveItemsInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const moved = await client.bookOrderItem.updateMany({
      data: { shipmentId },
      where: {
        AND: [
          activeItemWhere(userId),
          { id: { in: itemIds }, order: targetOrderWhere({ orderId, shipmentId, userId }) },
        ],
      },
    });
    return moved.count;
  }

  async receiveForBooks(
    { bookIds, receivedAt, userId }: ReceiveBooksInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<OrderItemBookRef[]> {
    if (bookIds.length === 0) {
      return [];
    }

    const received = await client.bookOrderItem.updateManyAndReturn({
      data: { receivedAt },
      select: { bookId: true, id: true },
      where: { ...activeItemWhere(userId), bookId: { in: bookIds } },
    });
    return sortById(received);
  }

  async receiveForShipment(
    { receivedAt, shipmentId, userId }: ReceiveShipmentItemsInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<OrderItemBookRef[]> {
    const received = await client.bookOrderItem.updateManyAndReturn({
      data: { receivedAt },
      select: { bookId: true, id: true },
      where: { ...activeItemWhere(userId), shipmentId },
    });
    return sortById(received);
  }

  async updateActivePrice(
    { itemId, price, userId }: { itemId: string; price: Nullable<number>; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const updated = await client.bookOrderItem.updateMany({
      data: { price },
      where: { ...activeItemWhere(userId), id: itemId },
    });
    return updated.count;
  }

  private async cancelActiveMatching({
    client,
    data,
    match,
    userId,
  }: {
    client: Prisma.TransactionClient;
    data: { cancelledAt: Date; cancelReason: Nullable<string> };
    match: Omit<Prisma.BookOrderItemWhereInput, "order">;
    userId: string;
  }): Promise<OrderItemBookRef[]> {
    const cancelled = await client.bookOrderItem.updateManyAndReturn({
      data,
      select: { bookId: true, id: true },
      where: { AND: [activeItemWhere(userId), match] },
    });
    return sortById(cancelled);
  }
}

function activeItemWhere(userId: string): Prisma.BookOrderItemWhereInput {
  return {
    book: SOFT_DELETE_SCOPE.active,
    cancelledAt: null,
    order: { userId },
    receivedAt: null,
  };
}

function sortById(rows: OrderItemBookRef[]): OrderItemBookRef[] {
  return [...rows].sort((left, right) => (left.id < right.id ? -1 : 1));
}

function targetOrderWhere({
  orderId,
  shipmentId,
  userId,
}: {
  orderId: string;
  shipmentId: Nullable<string>;
  userId: string;
}): Prisma.BookOrderWhereInput {
  if (shipmentId === null) {
    return { id: orderId, userId };
  }
  return {
    id: orderId,
    shipments: { some: { id: shipmentId, status: { in: [...SHIPMENT_ACTIVE_STATUSES] } } },
    userId,
  };
}
