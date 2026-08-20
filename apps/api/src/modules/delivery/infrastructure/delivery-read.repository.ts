import type { BookOrderHistorySort, InTransitSort, Nullable } from "@app/shared";

import {
  NextShipmentStatusSchema,
  SHIPMENT_ACTIVE_STATUSES,
  ShipmentStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { InTransitSummaryData } from "../domain/delivery-summary.js";
import type { DeliveryDateBounds } from "../domain/delivery-ui-status.js";
import type { LatestReceiptEvent } from "../domain/latest-receipt.mapper.js";
import type { OrderHistorySummaryData } from "../domain/order-history-summary.js";
import type { InTransitFilterInput } from "./in-transit-sql.js";
import type { HistoryFilterInput } from "./order-history-sql.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  ACTIVE_ITEM_SQL,
  buildInTransitConditions,
  IN_TRANSIT_ITEM_SOURCE,
  inTransitCategorySql,
  inTransitOrderSql,
  ORDER_EFFECTIVE_TOTAL_SQL,
  ORDER_PLACED_ON_SQL,
  ordersWithActiveItemsSource,
  shipmentScopedCategorySql,
  toIsoBounds,
} from "./in-transit-sql.js";
import {
  buildHistoryContentConditions,
  buildHistoryOrderConditions,
  HISTORY_CONTENT_SOURCE,
  HISTORY_ITEM_SOURCE,
  historyContentOrderSql,
  historyOrderSql,
  LIVE_HISTORY_ITEM_SQL,
} from "./order-history-sql.js";

const nextShipmentRelations = {
  include: {
    deliveryService: true,
    order: { select: { storeName: true } },
  },
} satisfies Prisma.ShipmentDefaultArgs;

const bookPreviewRelations = {
  include: { book: { include: { coverMedia: true } } },
} satisfies Prisma.BookOrderItemDefaultArgs;

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
    order: {
      include: {
        items: {
          select: {
            book: { select: { deletedAt: true } },
            cancelledAt: true,
            price: true,
            receivedAt: true,
            shipmentId: true,
          },
        },
        shipments: { select: { id: true, status: true } },
      },
    },
    shipment: { include: { deliveryService: true } },
  },
} satisfies Prisma.BookOrderItemDefaultArgs;

export type { InTransitFilterInput } from "./in-transit-sql.js";
export type { HistoryFilterInput } from "./order-history-sql.js";

export type BookOrderItemRow = Prisma.BookOrderItemGetPayload<typeof inTransitRowRelations>;

export type DatedNextShipmentRow = NextShipmentRow & { expectedDeliveryDate: Date };

export type DeliveryBookPreviewRow = Prisma.BookOrderItemGetPayload<typeof bookPreviewRelations>;

export type HistoryCounts = { totalBooksCount: number; totalCount: number };

export type InTransitFacetRows = { services: FacetRow[]; stores: FacetRow[] };

export type LatestReceiptData = {
  bookPreviews: DeliveryBookPreviewRow[];
  event: LatestReceiptEvent;
};

export type NextShipmentData = {
  bookPreviews: DeliveryBookPreviewRow[];
  booksCount: number;
  sameDayCount: number;
  shipment: DatedNextShipmentRow;
};

export type NextShipmentRow = Prisma.ShipmentGetPayload<typeof nextShipmentRelations>;

type FacetRow = { count: number; name: string };

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

const FacetRowSchema = z.object({ count: z.number().int(), name: z.string() });

const TotalCountRowSchema = z.object({ totalCount: z.number().int() });

const HistoryCountsRowSchema = z.object({
  totalBooksCount: z.number().int(),
  totalCount: z.number().int(),
});

const CurrencyTotalRowSchema = z.object({
  count: z.number().int(),
  currency: z.string().nullable(),
  total: z.number(),
});

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

const NEXT_SHIPMENT_STATUSES = NextShipmentStatusSchema.options;

const ActiveOrdersRowSchema = z.object({
  activeOrdersCount: z.number().int(),
  splitOrdersCount: z.number().int(),
  uniqueStoresCount: z.number().int(),
});

const ActiveShipmentsRowSchema = z.object({ activeShipmentsCount: z.number().int() });

const HistorySummaryRowSchema = z.object({
  cancelledBooksCount: z.number().int(),
  cancelledOrdersCount: z.number().int(),
  completedOrdersCount: z.number().int(),
  completedWithCancellationsCount: z.number().int(),
  completedWithoutCancellationsCount: z.number().int(),
  receivedBooksCount: z.number().int(),
  receivedOrdersCount: z.number().int(),
  receivedSeriesBooksCount: z.number().int(),
  receivedSeriesCount: z.number().int(),
  receivedShipmentsCount: z.number().int(),
  receivedStandaloneBooksCount: z.number().int(),
});

const LatestReceiptEventRowSchema = z.object({
  booksCount: z.number().int().positive(),
  deliveryServiceId: z.uuid().nullable(),
  deliveryServiceName: z.string().nullable(),
  orderId: z.uuid(),
  receivedAt: z.date(),
  receivedDay: z.date(),
  receivedDayEnd: z.date(),
  sameDayCount: z.number().int().nonnegative(),
  shipmentId: z.uuid().nullable(),
  storeName: z.string(),
});

const AttentionShipmentsRowSchema = z.object({
  delayedShipmentsCount: z.number().int(),
  earliestDelayedDate: z.iso.date().nullable(),
  nearestPickupUntil: z.iso.date().nullable(),
  pickupExpiredCount: z.number().int(),
  pickupExpiringCount: z.number().int(),
  withoutExpectedDateShipmentsCount: z.number().int(),
  withoutTrackingShipmentsCount: z.number().int(),
});

const AwaitingDispatchRowSchema = z.object({
  awaitingDispatchOrdersCount: z.number().int(),
  earliestAwaitingOrderDate: z.iso.date().nullable(),
});

const UnassignedBooksRowSchema = z.object({
  unassignedBooksCount: z.number().int(),
  unassignedOrderId: z.uuid().nullable(),
  unassignedOrdersCount: z.number().int(),
});

const ItemCountsRowSchema = z.object({
  activeBooksCount: z.number().int(),
  arrivingSoonCount: z.number().int(),
  delayedCount: z.number().int(),
  expectedThisWeekCount: z.number().int(),
  inTransitCount: z.number().int(),
  nextExpectedDelivery: z.iso.date().nullable(),
  nextExpectedThisWeek: z.iso.date().nullable(),
  orderedCount: z.number().int(),
  readyForPickupCount: z.number().int(),
  withoutExpectedDateCount: z.number().int(),
  withoutPriceCount: z.number().int(),
  withoutTrackingCount: z.number().int(),
});

const EMPTY_SUMMARY_ROWS: {
  activeOrders: z.infer<typeof ActiveOrdersRowSchema>;
  activeShipments: z.infer<typeof ActiveShipmentsRowSchema>;
  attentionShipments: z.infer<typeof AttentionShipmentsRowSchema>;
  awaitingDispatch: z.infer<typeof AwaitingDispatchRowSchema>;
  itemCounts: z.infer<typeof ItemCountsRowSchema>;
  unassignedBooks: z.infer<typeof UnassignedBooksRowSchema>;
} = {
  activeOrders: { activeOrdersCount: 0, splitOrdersCount: 0, uniqueStoresCount: 0 },
  activeShipments: { activeShipmentsCount: 0 },
  attentionShipments: {
    delayedShipmentsCount: 0,
    earliestDelayedDate: null,
    nearestPickupUntil: null,
    pickupExpiredCount: 0,
    pickupExpiringCount: 0,
    withoutExpectedDateShipmentsCount: 0,
    withoutTrackingShipmentsCount: 0,
  },
  awaitingDispatch: { awaitingDispatchOrdersCount: 0, earliestAwaitingOrderDate: null },
  itemCounts: {
    activeBooksCount: 0,
    arrivingSoonCount: 0,
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    nextExpectedThisWeek: null,
    orderedCount: 0,
    readyForPickupCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
  },
  unassignedBooks: { unassignedBooksCount: 0, unassignedOrderId: null, unassignedOrdersCount: 0 },
};

@Injectable()
export class DeliveryReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countHistory(filter: HistoryFilterInput): Promise<HistoryCounts> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH qualifying_order AS (
        SELECT book_order.id
        FROM book_orders book_order
        WHERE ${buildHistoryOrderConditions(filter)}
      )
      SELECT
        (SELECT (count(*))::int FROM qualifying_order) AS "totalCount",
        (
          SELECT (count(*))::int
          ${HISTORY_CONTENT_SOURCE}
          WHERE item.order_id IN (SELECT id FROM qualifying_order)
            AND ${buildHistoryContentConditions(filter)}
        ) AS "totalBooksCount"
    `);
    return z.array(HistoryCountsRowSchema).parse(rows)[0] ?? { totalBooksCount: 0, totalCount: 0 };
  }

  async countInTransit(filter: InTransitFilterInput): Promise<number> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT (count(*))::int AS "totalCount"
      ${IN_TRANSIT_ITEM_SOURCE}
      WHERE ${buildInTransitConditions(filter)}
    `);
    return z.array(TotalCountRowSchema).parse(rows)[0]?.totalCount ?? 0;
  }

  async historySummary(userId: string): Promise<OrderHistorySummaryData> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH live_item AS (
        SELECT
          item.order_id,
          item.shipment_id,
          item.received_at,
          item.cancelled_at,
          live_series.id AS series_id
        ${HISTORY_ITEM_SOURCE}
        LEFT JOIN series live_series
          ON live_series.id = book.series_id AND live_series.deleted_at IS NULL
        WHERE book_order.user_id = ${userId}::uuid AND ${LIVE_HISTORY_ITEM_SQL}
      ),
      completed_order AS (
        SELECT count(*) FILTER (WHERE cancelled_at IS NOT NULL) AS cancelled_books
        FROM live_item
        GROUP BY order_id
        HAVING count(*) FILTER (WHERE cancelled_at IS NULL AND received_at IS NULL) = 0
      )
      SELECT
        (SELECT (count(*) FILTER (WHERE received_at IS NOT NULL))::int FROM live_item)
          AS "receivedBooksCount",
        (SELECT (count(DISTINCT order_id) FILTER (WHERE received_at IS NOT NULL))::int FROM live_item)
          AS "receivedOrdersCount",
        (SELECT (count(DISTINCT shipment_id) FILTER (WHERE received_at IS NOT NULL))::int FROM live_item)
          AS "receivedShipmentsCount",
        (SELECT (count(*) FILTER (WHERE cancelled_at IS NOT NULL))::int FROM live_item)
          AS "cancelledBooksCount",
        (SELECT (count(DISTINCT order_id) FILTER (WHERE cancelled_at IS NOT NULL))::int FROM live_item)
          AS "cancelledOrdersCount",
        (SELECT (count(DISTINCT series_id) FILTER (WHERE received_at IS NOT NULL))::int FROM live_item)
          AS "receivedSeriesCount",
        (SELECT (count(*) FILTER (WHERE received_at IS NOT NULL AND series_id IS NOT NULL))::int FROM live_item)
          AS "receivedSeriesBooksCount",
        (SELECT (count(*) FILTER (WHERE received_at IS NOT NULL AND series_id IS NULL))::int FROM live_item)
          AS "receivedStandaloneBooksCount",
        (SELECT (count(*))::int FROM completed_order) AS "completedOrdersCount",
        (SELECT (count(*) FILTER (WHERE cancelled_books = 0))::int FROM completed_order)
          AS "completedWithoutCancellationsCount",
        (SELECT (count(*) FILTER (WHERE cancelled_books > 0))::int FROM completed_order)
          AS "completedWithCancellationsCount"
    `);

    return z.tuple([HistorySummaryRowSchema]).parse(rows)[0];
  }

  async inTransitFacets(userId: string): Promise<InTransitFacetRows> {
    const [storeRows, serviceRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT book_order.store_name AS "name", (count(*))::int AS "count"
        ${ordersWithActiveItemsSource({ extraConditions: [], userId })}
        GROUP BY book_order.store_name
      `),
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          facet_shipment.delivery_service_name AS "name",
          (count(DISTINCT book_order.id))::int AS "count"
        FROM shipments facet_shipment
        JOIN book_orders book_order ON book_order.id = facet_shipment.order_id
        WHERE book_order.user_id = ${userId}::uuid
          AND facet_shipment.status = ANY(${[...SHIPMENT_ACTIVE_STATUSES]}::text[])
          AND facet_shipment.delivery_service_name IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM book_order_items item
            JOIN books book ON book.id = item.book_id
            WHERE item.order_id = book_order.id AND ${ACTIVE_ITEM_SQL}
          )
        GROUP BY facet_shipment.delivery_service_name
      `),
    ]);

    return {
      services: z.array(FacetRowSchema).parse(serviceRows),
      stores: z.array(FacetRowSchema).parse(storeRows),
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
    const shipmentCategories = shipmentScopedCategorySql(isoBounds);
    const ownedActiveItems = Prisma.sql`book_order.user_id = ${userId}::uuid AND ${ACTIVE_ITEM_SQL}`;

    const [
      itemCountsRows,
      activeOrdersRows,
      activeShipmentsRows,
      bookTotalRows,
      orderTotalRows,
      attentionShipmentsRows,
      awaitingDispatchRows,
      unassignedBooksRows,
    ] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
          SELECT
            (count(*))::int AS "activeBooksCount",
            (count(*) FILTER (WHERE ${categories.ordered}))::int AS "orderedCount",
            (count(*) FILTER (WHERE ${categories.inTransit}))::int AS "inTransitCount",
            (count(*) FILTER (WHERE ${categories.readyForPickup}))::int AS "readyForPickupCount",
            (count(*) FILTER (WHERE ${categories.delayed}))::int AS "delayedCount",
            (count(*) FILTER (WHERE ${categories.arrivingSoon}))::int AS "arrivingSoonCount",
            (count(*) FILTER (WHERE ${categories.thisWeek}))::int AS "expectedThisWeekCount",
            (count(*) FILTER (WHERE ${categories.withoutExpectedDate}))::int
              AS "withoutExpectedDateCount",
            (count(*) FILTER (WHERE ${categories.withoutTrackingNumber}))::int
              AS "withoutTrackingCount",
            (count(*) FILTER (WHERE ${categories.withoutPrice}))::int AS "withoutPriceCount",
            (
              min(shipment.expected_delivery_date)
                FILTER (WHERE shipment.expected_delivery_date >= ${isoBounds.todayIso}::date)
            )::text AS "nextExpectedDelivery",
            (min(shipment.expected_delivery_date) FILTER (WHERE ${categories.thisWeek}))::text
              AS "nextExpectedThisWeek"
          ${IN_TRANSIT_ITEM_SOURCE}
          WHERE ${ownedActiveItems}
        `),
      this.prisma.$queryRaw(Prisma.sql`
          SELECT
            (count(*))::int AS "activeOrdersCount",
            (count(DISTINCT book_order.store_name))::int AS "uniqueStoresCount",
            (count(*) FILTER (WHERE (
              SELECT count(*)
              FROM shipments shipment
              WHERE shipment.order_id = book_order.id
                AND shipment.status <> ${SHIPMENT_STATUS.cancelled}
            ) > 1))::int AS "splitOrdersCount"
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
          SELECT
            book_order.currency AS "currency",
            (count(*))::int AS "count",
            (sum(item.price))::float8 AS "total"
          ${IN_TRANSIT_ITEM_SOURCE}
          WHERE ${ownedActiveItems} AND item.price IS NOT NULL
          GROUP BY book_order.currency
        `),
      this.prisma.$queryRaw(Prisma.sql`
          SELECT
            currency,
            (count(*))::int AS "count",
            (sum(canonical_total))::float8 AS "total"
          FROM (
            SELECT
              book_order.currency AS currency,
              ${ORDER_EFFECTIVE_TOTAL_SQL} AS canonical_total
            ${ordersWithActiveItemsSource({ extraConditions: [], userId })}
          ) AS canonical
          WHERE canonical_total IS NOT NULL
          GROUP BY currency
        `),
      this.prisma.$queryRaw(Prisma.sql`
          SELECT
            (count(*) FILTER (WHERE ${shipmentCategories.pickupExpiring}))::int AS "pickupExpiringCount",
            (count(*) FILTER (
              WHERE ${shipmentCategories.pickupExpiring}
                AND shipment.pickup_until < ${isoBounds.todayIso}::date
            ))::int AS "pickupExpiredCount",
            (
              min(shipment.pickup_until) FILTER (
                WHERE ${shipmentCategories.pickupExpiring}
                  AND shipment.pickup_until >= ${isoBounds.todayIso}::date
              )
            )::text AS "nearestPickupUntil",
            (count(*) FILTER (WHERE ${shipmentCategories.delayed}))::int AS "delayedShipmentsCount",
            (min(shipment.expected_delivery_date) FILTER (WHERE ${shipmentCategories.delayed}))::text
              AS "earliestDelayedDate",
            (count(*) FILTER (WHERE ${shipmentCategories.withoutTrackingNumber}))::int
              AS "withoutTrackingShipmentsCount",
            (count(*) FILTER (WHERE ${shipmentCategories.withoutExpectedDate}))::int
              AS "withoutExpectedDateShipmentsCount"
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
          SELECT
            (count(*))::int AS "awaitingDispatchOrdersCount",
            (min(${ORDER_PLACED_ON_SQL}))::text AS "earliestAwaitingOrderDate"
          ${ordersWithActiveItemsSource({
            extraConditions: [categories.awaitingDispatch],
            userId,
          })}
        `),
      this.prisma.$queryRaw(Prisma.sql`
          SELECT
            (count(*))::int AS "unassignedBooksCount",
            (count(DISTINCT item.order_id))::int AS "unassignedOrdersCount",
            (CASE
              WHEN count(DISTINCT item.order_id) = 1 THEN min(item.order_id::text)
            END) AS "unassignedOrderId"
          ${IN_TRANSIT_ITEM_SOURCE}
          WHERE ${ownedActiveItems} AND ${categories.unassigned}
        `),
    ]);

    const itemCounts =
      z.array(ItemCountsRowSchema).parse(itemCountsRows)[0] ?? EMPTY_SUMMARY_ROWS.itemCounts;
    const activeOrders =
      z.array(ActiveOrdersRowSchema).parse(activeOrdersRows)[0] ?? EMPTY_SUMMARY_ROWS.activeOrders;
    const activeShipments =
      z.array(ActiveShipmentsRowSchema).parse(activeShipmentsRows)[0] ??
      EMPTY_SUMMARY_ROWS.activeShipments;
    const attentionShipments =
      z.array(AttentionShipmentsRowSchema).parse(attentionShipmentsRows)[0] ??
      EMPTY_SUMMARY_ROWS.attentionShipments;
    const awaitingDispatch =
      z.array(AwaitingDispatchRowSchema).parse(awaitingDispatchRows)[0] ??
      EMPTY_SUMMARY_ROWS.awaitingDispatch;
    const unassignedBooks =
      z.array(UnassignedBooksRowSchema).parse(unassignedBooksRows)[0] ??
      EMPTY_SUMMARY_ROWS.unassignedBooks;

    return {
      ...itemCounts,
      ...attentionShipments,
      ...awaitingDispatch,
      ...unassignedBooks,
      activeOrdersCount: activeOrders.activeOrdersCount,
      activeShipmentsCount: activeShipments.activeShipmentsCount,
      bookTotals: z.array(CurrencyTotalRowSchema).parse(bookTotalRows),
      orderTotals: z.array(CurrencyTotalRowSchema).parse(orderTotalRows),
      splitOrdersCount: activeOrders.splitOrdersCount,
      uniqueStoresCount: activeOrders.uniqueStoresCount,
    };
  }

  async latestReceipt({
    bookPreviewsMax,
    userId,
  }: {
    bookPreviewsMax: number;
    userId: string;
  }): Promise<Nullable<LatestReceiptData>> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      WITH received_item AS (
        SELECT
          item.order_id,
          item.shipment_id,
          item.received_at,
          date_trunc('day', item.received_at AT TIME ZONE 'UTC') AS received_day
        ${HISTORY_ITEM_SOURCE}
        WHERE book_order.user_id = ${userId}::uuid
          AND ${LIVE_HISTORY_ITEM_SQL}
          AND item.received_at IS NOT NULL
      ),
      receipt_event AS (
        SELECT
          order_id,
          shipment_id,
          received_day,
          max(received_at) AS received_at,
          (count(*))::int AS books_count
        FROM received_item
        GROUP BY order_id, shipment_id, received_day
      )
      SELECT
        receipt_event.order_id AS "orderId",
        receipt_event.shipment_id AS "shipmentId",
        receipt_event.received_at AS "receivedAt",
        (receipt_event.received_day AT TIME ZONE 'UTC') AS "receivedDay",
        ((receipt_event.received_day + interval '1 day') AT TIME ZONE 'UTC') AS "receivedDayEnd",
        receipt_event.books_count AS "booksCount",
        (
          SELECT (count(*))::int - 1
          FROM receipt_event same_day
          WHERE same_day.received_day = receipt_event.received_day
        ) AS "sameDayCount",
        book_order.store_name AS "storeName",
        receipt_shipment.delivery_service_id AS "deliveryServiceId",
        COALESCE(receipt_shipment.delivery_service_name, receipt_service.name)
          AS "deliveryServiceName"
      FROM receipt_event
      JOIN book_orders book_order ON book_order.id = receipt_event.order_id
      LEFT JOIN shipments receipt_shipment ON receipt_shipment.id = receipt_event.shipment_id
      LEFT JOIN delivery_services receipt_service
        ON receipt_service.id = receipt_shipment.delivery_service_id
      ORDER BY
        receipt_event.received_at DESC,
        receipt_event.shipment_id ASC NULLS LAST,
        receipt_event.order_id ASC
      LIMIT 1
    `);

    const row = z.array(LatestReceiptEventRowSchema).parse(rows)[0];
    if (row === undefined) {
      return null;
    }

    const bookPreviews = await this.prisma.bookOrderItem.findMany({
      orderBy: [{ book: { title: "asc" } }, { id: "asc" }],
      take: bookPreviewsMax,
      where: {
        book: SOFT_DELETE_SCOPE.active,
        orderId: row.orderId,
        receivedAt: { gte: row.receivedDay, lt: row.receivedDayEnd },
        shipmentId: row.shipmentId,
      },
      ...bookPreviewRelations,
    });

    return {
      bookPreviews,
      event: {
        booksCount: row.booksCount,
        deliveryServiceId: row.deliveryServiceId,
        deliveryServiceName: row.deliveryServiceName,
        orderId: row.orderId,
        receivedAt: row.receivedAt,
        sameDayCount: row.sameDayCount,
        shipmentId: row.shipmentId,
        storeName: row.storeName,
      },
    };
  }

  async listHistory({
    skip,
    sort,
    take,
    ...filter
  }: ListHistoryInput): Promise<BookOrderItemRow[]> {
    const orderIdRows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT book_order.id::text AS "id"
      FROM book_orders book_order
      WHERE ${buildHistoryOrderConditions(filter)}
      ORDER BY ${historyOrderSql(sort)}
      OFFSET ${skip}::int
      LIMIT ${take}::int
    `);

    const orderIds = z
      .array(OrderedIdRowSchema)
      .parse(orderIdRows)
      .map((row) => row.id);
    if (orderIds.length === 0) {
      return [];
    }

    const idRows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT item.id::text AS "id"
      ${HISTORY_CONTENT_SOURCE}
      WHERE item.order_id = ANY(${orderIds}::uuid[])
        AND ${buildHistoryContentConditions(filter)}
      ORDER BY ${historyContentOrderSql(orderIds)}
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

  async nextShipment({
    bookPreviewsMax,
    today,
    userId,
  }: {
    bookPreviewsMax: number;
    today: Date;
    userId: string;
  }): Promise<Nullable<NextShipmentData>> {
    const activeBooks = {
      book: SOFT_DELETE_SCOPE.active,
      cancelledAt: null,
      receivedAt: null,
    } satisfies Prisma.BookOrderItemWhereInput;

    const awaitingArrival = {
      expectedDeliveryDate: { gte: today },
      items: { some: activeBooks },
      order: { userId },
      status: { in: [...NEXT_SHIPMENT_STATUSES] },
    } satisfies Prisma.ShipmentWhereInput;

    const shipment = await this.prisma.shipment.findFirst({
      orderBy: [{ expectedDeliveryDate: "asc" }, { id: "asc" }],
      where: awaitingArrival,
      ...nextShipmentRelations,
    });

    if (shipment === null || shipment.expectedDeliveryDate === null) {
      return null;
    }
    const datedShipment: DatedNextShipmentRow = {
      ...shipment,
      expectedDeliveryDate: shipment.expectedDeliveryDate,
    };

    const [bookPreviews, booksCount, sameDayTotal] = await Promise.all([
      this.prisma.bookOrderItem.findMany({
        orderBy: [{ book: { title: "asc" } }, { id: "asc" }],
        take: bookPreviewsMax,
        where: { ...activeBooks, shipmentId: shipment.id },
        ...bookPreviewRelations,
      }),
      this.prisma.bookOrderItem.count({ where: { ...activeBooks, shipmentId: shipment.id } }),
      this.prisma.shipment.count({
        where: { ...awaitingArrival, expectedDeliveryDate: datedShipment.expectedDeliveryDate },
      }),
    ]);

    return {
      bookPreviews,
      booksCount,
      sameDayCount: Math.max(sameDayTotal - 1, 0),
      shipment: datedShipment,
    };
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
