import type { BookOrderHistorySort, InTransitSort } from "@app/shared";

import { SHIPMENT_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { InTransitSummaryData } from "../domain/delivery-summary.js";
import type { DeliveryDateBounds } from "../domain/delivery-ui-status.js";
import type { OrderHistorySummaryData } from "../domain/order-history-summary.js";
import type { InTransitFilterInput } from "./in-transit-sql.js";
import type { HistoryFilterInput } from "./order-history-sql.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  ACTIVE_ITEM_SQL,
  attentionSql,
  buildInTransitConditions,
  IN_TRANSIT_ITEM_SOURCE,
  inTransitCategorySql,
  inTransitOrderSql,
  ordersWithActiveItemsSource,
  toIsoBounds,
} from "./in-transit-sql.js";
import {
  buildHistoryConditions,
  HISTORY_ITEM_SOURCE,
  historyOrderSql,
  LIVE_HISTORY_ITEM_SQL,
} from "./order-history-sql.js";

const inTransitRowRelations = {
  include: {
    book: {
      include: {
        coverMedia: true,
        publisher: true,
        series: true,
        tags: { include: { tag: true } },
      },
    },
    order: true,
    shipment: { include: { deliveryService: true } },
  },
} satisfies Prisma.BookOrderItemDefaultArgs;

export type { InTransitFilterInput } from "./in-transit-sql.js";
export type { HistoryFilterInput } from "./order-history-sql.js";

export type BookOrderItemRow = Prisma.BookOrderItemGetPayload<typeof inTransitRowRelations>;

type ListHistoryInput = HistoryFilterInput & {
  skip: number;
  sort: BookOrderHistorySort;
  take: number;
};

type ListInTransitInput = InTransitFilterInput & {
  skip: number;
  sort: InTransitSort;
  take: number;
};

const OrderedIdRowSchema = z.object({ id: z.uuid() });

const TotalCountRowSchema = z.object({ totalCount: z.number().int() });

const CurrencyTotalRowSchema = z.object({
  currency: z.string().nullable(),
  total: z.number(),
});

const ActiveOrdersRowSchema = z.object({
  activeOrdersCount: z.number().int(),
  uniqueStoresCount: z.number().int(),
});

const ActiveShipmentsRowSchema = z.object({ activeShipmentsCount: z.number().int() });

const HistorySummaryRowSchema = z.object({
  activeBooksCount: z.number().int(),
  booksCount: z.number().int(),
  cancelledBooksCount: z.number().int(),
  ordersCount: z.number().int(),
  receivedBooksCount: z.number().int(),
  shipmentsCount: z.number().int(),
});

const EMPTY_HISTORY_SUMMARY: z.infer<typeof HistorySummaryRowSchema> = {
  activeBooksCount: 0,
  booksCount: 0,
  cancelledBooksCount: 0,
  ordersCount: 0,
  receivedBooksCount: 0,
  shipmentsCount: 0,
};

const ItemCountsRowSchema = z.object({
  activeBooksCount: z.number().int(),
  attentionCount: z.number().int(),
  delayedCount: z.number().int(),
  expectedThisWeekCount: z.number().int(),
  inTransitCount: z.number().int(),
  nextExpectedDelivery: z.iso.date().nullable(),
  orderedCount: z.number().int(),
  readyForPickupCount: z.number().int(),
  withoutExpectedDateCount: z.number().int(),
  withoutPriceCount: z.number().int(),
  withoutTrackingCount: z.number().int(),
});

const EMPTY_SUMMARY_ROWS: {
  activeOrders: z.infer<typeof ActiveOrdersRowSchema>;
  activeShipments: z.infer<typeof ActiveShipmentsRowSchema>;
  itemCounts: z.infer<typeof ItemCountsRowSchema>;
} = {
  activeOrders: { activeOrdersCount: 0, uniqueStoresCount: 0 },
  activeShipments: { activeShipmentsCount: 0 },
  itemCounts: {
    activeBooksCount: 0,
    attentionCount: 0,
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    orderedCount: 0,
    readyForPickupCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
  },
};

@Injectable()
export class DeliveryReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countHistory(filter: HistoryFilterInput): Promise<number> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(*))::int AS "totalCount"
      ${HISTORY_ITEM_SOURCE}
      WHERE ${buildHistoryConditions(filter)}
    `);
    return z.array(TotalCountRowSchema).parse(rows)[0]?.totalCount ?? 0;
  }

  async countInTransit(filter: InTransitFilterInput): Promise<number> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(*))::int AS "totalCount"
      ${IN_TRANSIT_ITEM_SOURCE}
      WHERE ${buildInTransitConditions(filter)}
    `);
    return z.array(TotalCountRowSchema).parse(rows)[0]?.totalCount ?? 0;
  }

  async historySummary({
    includeCancelled,
    userId,
  }: {
    includeCancelled: boolean;
    userId: string;
  }): Promise<OrderHistorySummaryData> {
    const ownedItems = Prisma.sql`book_order.user_id = ${userId}::uuid AND ${LIVE_HISTORY_ITEM_SQL}`;
    const pricedItems = includeCancelled
      ? Prisma.sql`item.price IS NOT NULL`
      : Prisma.sql`item.price IS NOT NULL AND item.cancelled_at IS NULL`;

    const [countRows, currencyRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "booksCount",
          (count(*) FILTER (
            WHERE item.cancelled_at IS NULL AND item.received_at IS NULL
          ))::int AS "activeBooksCount",
          (count(*) FILTER (WHERE item.received_at IS NOT NULL))::int AS "receivedBooksCount",
          (count(*) FILTER (WHERE item.cancelled_at IS NOT NULL))::int AS "cancelledBooksCount",
          (count(DISTINCT item.order_id))::int AS "ordersCount",
          (count(DISTINCT item.shipment_id))::int AS "shipmentsCount"
        ${HISTORY_ITEM_SOURCE}
        WHERE ${ownedItems}
      `),
      this.prisma.$queryRaw(Prisma.sql`
        SELECT book_order.currency AS "currency", (sum(item.price))::float8 AS "total"
        ${HISTORY_ITEM_SOURCE}
        WHERE ${ownedItems} AND ${pricedItems}
        GROUP BY book_order.currency
      `),
    ]);

    const counts = z.array(HistorySummaryRowSchema).parse(countRows)[0] ?? EMPTY_HISTORY_SUMMARY;

    return {
      ...counts,
      currencyTotals: z.array(CurrencyTotalRowSchema).parse(currencyRows),
    };
  }

  async inTransitSummary({
    bounds,
    userId,
  }: {
    bounds: DeliveryDateBounds;
    userId: string;
  }): Promise<InTransitSummaryData> {
    const isoBounds = toIsoBounds(bounds);
    const categories = inTransitCategorySql(isoBounds);
    const ownedActiveItems = Prisma.sql`book_order.user_id = ${userId}::uuid AND ${ACTIVE_ITEM_SQL}`;

    const [itemCountsRows, activeOrdersRows, activeShipmentsRows, bookTotalRows, orderTotalRows] =
      await Promise.all([
        this.prisma.$queryRaw(Prisma.sql`
          SELECT
            (count(*))::int AS "activeBooksCount",
            (count(*) FILTER (WHERE ${categories.ordered}))::int AS "orderedCount",
            (count(*) FILTER (WHERE ${categories.inTransit}))::int AS "inTransitCount",
            (count(*) FILTER (WHERE ${categories.readyForPickup}))::int AS "readyForPickupCount",
            (count(*) FILTER (WHERE ${categories.delayed}))::int AS "delayedCount",
            (count(*) FILTER (WHERE ${categories.thisWeek}))::int AS "expectedThisWeekCount",
            (count(*) FILTER (WHERE ${categories.withoutExpectedDate}))::int
              AS "withoutExpectedDateCount",
            (count(*) FILTER (WHERE ${categories.withoutTrackingNumber}))::int
              AS "withoutTrackingCount",
            (count(*) FILTER (WHERE ${categories.withoutPrice}))::int AS "withoutPriceCount",
            (count(DISTINCT item.book_id) FILTER (WHERE ${attentionSql(categories)}))::int
              AS "attentionCount",
            (
              min(shipment.expected_delivery_date)
                FILTER (WHERE shipment.expected_delivery_date >= ${isoBounds.todayIso}::date)
            )::text AS "nextExpectedDelivery"
          ${IN_TRANSIT_ITEM_SOURCE}
          WHERE ${ownedActiveItems}
        `),
        this.prisma.$queryRaw(Prisma.sql`
          SELECT
            (count(*))::int AS "activeOrdersCount",
            (count(DISTINCT book_order.store_name))::int AS "uniqueStoresCount"
          ${ordersWithActiveItemsSource({ extraConditions: [], userId })}
        `),
        this.prisma.$queryRaw(Prisma.sql`
          SELECT (count(*))::int AS "activeShipmentsCount"
          FROM shipments shipment
          JOIN book_orders book_order ON book_order.id = shipment.order_id
          WHERE book_order.user_id = ${userId}::uuid
            AND shipment.status = ANY(${[...SHIPMENT_ACTIVE_STATUSES]}::text[])
            AND EXISTS (
              SELECT 1
              FROM book_order_items item
              JOIN books book ON book.id = item.book_id
              WHERE item.shipment_id = shipment.id AND ${ACTIVE_ITEM_SQL}
            )
        `),
        this.prisma.$queryRaw(Prisma.sql`
          SELECT book_order.currency AS "currency", (sum(item.price))::float8 AS "total"
          ${IN_TRANSIT_ITEM_SOURCE}
          WHERE ${ownedActiveItems} AND item.price IS NOT NULL
          GROUP BY book_order.currency
        `),
        this.prisma.$queryRaw(Prisma.sql`
          SELECT book_order.currency AS "currency", (sum(book_order.total_amount))::float8 AS "total"
          ${ordersWithActiveItemsSource({
            extraConditions: [Prisma.sql`book_order.total_amount IS NOT NULL`],
            userId,
          })}
          GROUP BY book_order.currency
        `),
      ]);

    const itemCounts =
      z.array(ItemCountsRowSchema).parse(itemCountsRows)[0] ?? EMPTY_SUMMARY_ROWS.itemCounts;
    const activeOrders =
      z.array(ActiveOrdersRowSchema).parse(activeOrdersRows)[0] ?? EMPTY_SUMMARY_ROWS.activeOrders;
    const activeShipments =
      z.array(ActiveShipmentsRowSchema).parse(activeShipmentsRows)[0] ??
      EMPTY_SUMMARY_ROWS.activeShipments;

    return {
      ...itemCounts,
      activeOrdersCount: activeOrders.activeOrdersCount,
      activeShipmentsCount: activeShipments.activeShipmentsCount,
      bookTotals: z.array(CurrencyTotalRowSchema).parse(bookTotalRows),
      orderTotals: z.array(CurrencyTotalRowSchema).parse(orderTotalRows),
      uniqueStoresCount: activeOrders.uniqueStoresCount,
    };
  }

  async listHistory({
    skip,
    sort,
    take,
    ...filter
  }: ListHistoryInput): Promise<BookOrderItemRow[]> {
    const idRows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT item.id::text AS "id"
      ${HISTORY_ITEM_SOURCE}
      WHERE ${buildHistoryConditions(filter)}
      ORDER BY ${historyOrderSql(sort)}
      OFFSET ${skip}::int
      LIMIT ${take}::int
    `);

    return this.loadRowsInOrder({ idRows, userId: filter.userId });
  }

  async listInTransit({
    skip,
    sort,
    take,
    ...filter
  }: ListInTransitInput): Promise<BookOrderItemRow[]> {
    const idRows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT item.id::text AS "id"
      ${IN_TRANSIT_ITEM_SOURCE}
      WHERE ${buildInTransitConditions(filter)}
      ORDER BY ${inTransitOrderSql({ sort, todayIso: toIsoDate(filter.bounds.today) })}
      OFFSET ${skip}::int
      LIMIT ${take}::int
    `);

    return this.loadRowsInOrder({ idRows, userId: filter.userId });
  }

  private async loadRowsInOrder({
    idRows,
    userId,
  }: {
    idRows: unknown;
    userId: string;
  }): Promise<BookOrderItemRow[]> {
    const orderedIds = z
      .array(OrderedIdRowSchema)
      .parse(idRows)
      .map((row) => row.id);
    if (orderedIds.length === 0) {
      return [];
    }

    const items = await this.prisma.bookOrderItem.findMany({
      where: { book: SOFT_DELETE_SCOPE.active, id: { in: orderedIds }, order: { userId } },
      ...inTransitRowRelations,
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    return orderedIds.flatMap((id) => {
      const item = itemById.get(id);
      return item === undefined ? [] : [item];
    });
  }
}
