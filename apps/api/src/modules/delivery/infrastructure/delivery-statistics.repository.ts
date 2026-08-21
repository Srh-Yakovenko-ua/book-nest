import type { Currency, ShipmentStatus } from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY, ShipmentStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { OrderStatisticsRecordsPage } from "../domain/order-statistics-page.js";
import type { OrderStatisticsRecord } from "../domain/statistics-scope.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  capOrderStatisticsRecords,
  ORDER_STATISTICS_FETCH,
} from "../domain/order-statistics-page.js";

const log = createLogger("delivery-statistics.repository");

const SHIPMENT_WITH_LIVE_BOOKS = {
  items: { some: { book: SOFT_DELETE_SCOPE.active } },
} satisfies Prisma.ShipmentWhereInput;

const orderStatisticsSelect = {
  select: {
    currency: true,
    deliveryPrice: true,
    discount: true,
    id: true,
    isFree: true,
    items: {
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        book: { select: { title: true } },
        bookId: true,
        cancelledAt: true,
        id: true,
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

export type ActiveMoneyAgeFilterInput = {
  currency: Currency | undefined;
  store: string | undefined;
  userId: string;
};

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

  async listActiveOrderRecords(
    filter: ActiveMoneyAgeFilterInput,
  ): Promise<OrderStatisticsRecord[]> {
    const rows = await this.prisma.bookOrder.findMany({
      orderBy: { id: "asc" },
      take: ORDER_STATISTICS_FETCH.maxOrders,
      where: buildActiveMoneyAgeWhere(filter),
      ...orderStatisticsSelect,
    });

    return rows.map(toOrderStatisticsRecord);
  }

  async listOrderRecords(
    filter: BookOrderStatisticsFilterInput,
  ): Promise<OrderStatisticsRecordsPage> {
    const rows = await this.prisma.bookOrder.findMany({
      orderBy: { id: "asc" },
      take: ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
      where: buildStatisticsWhere(filter),
      ...orderStatisticsSelect,
    });
    const page = capOrderStatisticsRecords(rows.map(toOrderStatisticsRecord));
    if (page.isTruncated) {
      log.warn(
        { cap: page.maxOrders, userId: filter.userId },
        "book order statistics truncated at the safety cap",
      );
    }

    return page;
  }
}

function buildActiveMoneyAgeWhere({
  currency,
  store,
  userId,
}: ActiveMoneyAgeFilterInput): Prisma.BookOrderWhereInput {
  const conditions: Prisma.BookOrderWhereInput[] = [];

  if (store !== undefined) {
    conditions.push({ storeName: { equals: store, mode: "insensitive" } });
  }

  if (currency !== undefined) {
    conditions.push(currencyWhere(currency));
  }

  return {
    AND: conditions,
    items: { some: { book: SOFT_DELETE_SCOPE.active, cancelledAt: null, receivedAt: null } },
    userId,
  };
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
  return {
    OR: [
      { currency },
      { currency: null, isFree: true },
      { currency: null, totalAmount: { not: null } },
    ],
  };
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
    deliveryPrice: row.deliveryPrice === null ? null : row.deliveryPrice.toNumber(),
    discount: row.discount === null ? null : row.discount.toNumber(),
    id: row.id,
    isFree: row.isFree,
    items: row.items.map((item) => ({
      bookId: item.bookId,
      bookTitle: item.book.title,
      cancelledAt: item.cancelledAt,
      id: item.id,
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
