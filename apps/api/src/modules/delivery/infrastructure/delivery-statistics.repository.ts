import type { Currency, ShipmentStatus } from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY, ShipmentStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { OrderStatisticsRecord } from "../domain/order-statistics.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";

const log = createLogger("delivery-statistics.repository");

const STATISTICS_MAX_ORDERS = 5000;

const SHIPMENT_WITH_LIVE_BOOKS = {
  items: { some: { book: SOFT_DELETE_SCOPE.active } },
} satisfies Prisma.ShipmentWhereInput;

const orderStatisticsSelect = {
  select: {
    currency: true,
    id: true,
    items: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        book: { select: { title: true } },
        bookId: true,
        cancelledAt: true,
        price: true,
        receivedAt: true,
        shipmentId: true,
      },
      where: { book: SOFT_DELETE_SCOPE.active },
    },
    orderDate: true,
    orderNumber: true,
    shipments: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { cancelledAt: true, id: true, receivedAt: true, status: true },
      where: SHIPMENT_WITH_LIVE_BOOKS,
    },
    storeName: true,
    totalAmount: true,
  },
} satisfies Prisma.BookOrderDefaultArgs;

export type BookOrderStatisticsFilterInput = {
  currency: Currency | undefined;
  from: Date | undefined;
  status: ShipmentStatus | undefined;
  store: string | undefined;
  to: Date | undefined;
  userId: string;
};

type OrderStatisticsRow = Prisma.BookOrderGetPayload<typeof orderStatisticsSelect>;

@Injectable()
export class DeliveryStatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOrderRecords(filter: BookOrderStatisticsFilterInput): Promise<OrderStatisticsRecord[]> {
    const rows = await this.prisma.bookOrder.findMany({
      orderBy: { id: "asc" },
      take: STATISTICS_MAX_ORDERS,
      where: buildStatisticsWhere(filter),
      ...orderStatisticsSelect,
    });
    if (rows.length === STATISTICS_MAX_ORDERS) {
      log.warn(
        { cap: STATISTICS_MAX_ORDERS, userId: filter.userId },
        "book order statistics truncated at the safety cap",
      );
    }

    return rows.map(toOrderStatisticsRecord);
  }
}

function buildStatisticsWhere({
  currency,
  from,
  status,
  store,
  to,
  userId,
}: BookOrderStatisticsFilterInput): Prisma.BookOrderWhereInput {
  const conditions: Prisma.BookOrderWhereInput[] = [];

  if (store !== undefined) {
    conditions.push({ storeName: { equals: store, mode: "insensitive" } });
  }

  if (currency !== undefined) {
    conditions.push(currencyWhere(currency));
  }

  if (status !== undefined) {
    conditions.push(shipmentStatusWhere(status));
  }

  if (from !== undefined || to !== undefined) {
    conditions.push({ orderDate: { gte: from, lte: to } });
  }

  return { AND: conditions, items: { some: { book: SOFT_DELETE_SCOPE.active } }, userId };
}

function currencyWhere(currency: Currency): Prisma.BookOrderWhereInput {
  if (currency !== DEFAULT_CURRENCY) {
    return { currency };
  }
  return { OR: [{ currency }, { currency: null, totalAmount: { not: null } }] };
}

function shipmentStatusWhere(status: ShipmentStatus): Prisma.BookOrderWhereInput {
  const shipmentMatches: Prisma.ShipmentWhereInput = { ...SHIPMENT_WITH_LIVE_BOOKS, status };
  if (status !== ShipmentStatusSchema.enum.ordered) {
    return { shipments: { some: shipmentMatches } };
  }
  return {
    OR: [
      { shipments: { some: shipmentMatches } },
      {
        items: {
          some: {
            book: SOFT_DELETE_SCOPE.active,
            cancelledAt: null,
            receivedAt: null,
            shipmentId: null,
          },
        },
      },
    ],
  };
}

function toOrderStatisticsRecord(row: OrderStatisticsRow): OrderStatisticsRecord {
  return {
    currency: row.currency === null ? null : CurrencySchema.parse(row.currency),
    id: row.id,
    items: row.items.map((item) => ({
      bookId: item.bookId,
      bookTitle: item.book.title,
      cancelledAt: item.cancelledAt,
      price: item.price === null ? null : item.price.toNumber(),
      receivedAt: item.receivedAt,
      shipmentId: item.shipmentId,
    })),
    orderDate: row.orderDate,
    orderNumber: row.orderNumber,
    shipments: row.shipments.map((shipment) => ({
      cancelledAt: shipment.cancelledAt,
      id: shipment.id,
      receivedAt: shipment.receivedAt,
      status: ShipmentStatusSchema.parse(shipment.status),
    })),
    storeName: row.storeName,
    totalAmount: row.totalAmount === null ? null : row.totalAmount.toNumber(),
  };
}
