import type {
  BulkReceiveSkipReason,
  DeliveryHistorySort,
  DeliveryHistoryTab,
  DeliveryInTransitFilter,
  DeliveryInTransitSort,
  Nullable,
} from "@app/shared";

import {
  CurrencySchema,
  DEFAULT_CURRENCY,
  SHIPMENT_ACTIVE_STATUSES,
  ShipmentStatusSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { StatisticsRecord } from "../domain/delivery-statistics.js";
import type { RecordDeliveryTransition } from "../domain/delivery-write.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { runInClient } from "../../../core/database/run-in-client.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";

const log = createLogger("delivery.repository");

const DELIVERY_STATUS_RECEIVED = "received";
const DELIVERY_STATUS_CANCELLED = "cancelled";
const OWNERSHIP_STATUS_IN_TRANSIT = "in_transit";
const STATISTICS_MAX_RECORDS = 5000;

const HistorySummaryCountsRowSchema = z.object({
  activeCount: z.number(),
  cancelledCount: z.number(),
  receivedCount: z.number(),
  totalOrders: z.number(),
});

const EMPTY_HISTORY_SUMMARY_COUNTS: z.infer<typeof HistorySummaryCountsRowSchema> = {
  activeCount: 0,
  cancelledCount: 0,
  receivedCount: 0,
  totalOrders: 0,
};

const InTransitSummaryCountsRowSchema = z.object({
  activeCount: z.number(),
  delayedCount: z.number(),
  expectedThisWeek: z.number(),
});

const EMPTY_IN_TRANSIT_SUMMARY_COUNTS: z.infer<typeof InTransitSummaryCountsRowSchema> = {
  activeCount: 0,
  delayedCount: 0,
  expectedThisWeek: 0,
};

const deliveryBookInclude = {
  include: {
    book: {
      include: {
        coverMedia: true,
        publisher: true,
        series: true,
        tags: { include: { tag: true } },
      },
    },
  },
} satisfies Prisma.BookDeliveryDefaultArgs;

export type BulkReceiveInput = {
  bookIds: string[];
  transition: RecordDeliveryTransition;
  userId: string;
};

export type BulkReceiveOutcome =
  | { bookId: string; reason: BulkReceiveSkipReason; status: "skipped" }
  | { bookId: string; status: "received" };

export type DeliveryWithBook = Prisma.BookDeliveryGetPayload<typeof deliveryBookInclude>;

export type HistoryFilterInput = {
  currency: string | undefined;
  from: Date | undefined;
  hasTrackingNumber: boolean | undefined;
  hasTrackingUrl: boolean | undefined;
  priceMax: number | undefined;
  priceMin: number | undefined;
  search: string | undefined;
  service: string | undefined;
  store: string | undefined;
  tab: DeliveryHistoryTab;
  to: Date | undefined;
  userId: string;
};

export type HistorySummaryData = {
  activeCount: number;
  cancelledCount: number;
  currencyTotals: InTransitCurrencyTotal[];
  receivedCount: number;
  totalOrders: number;
};

export type InTransitCurrencyTotal = {
  currency: Nullable<string>;
  total: number;
};

export type InTransitFilterInput = {
  filter: DeliveryInTransitFilter;
  search: string | undefined;
  service: string | undefined;
  soonEnd: Date;
  store: string | undefined;
  today: Date;
  userId: string;
  weekEnd: Date;
  weekStart: Date;
};

export type InTransitSummaryData = {
  activeCount: number;
  currencyTotals: InTransitCurrencyTotal[];
  delayedCount: number;
  expectedThisWeek: number;
  storeNames: Nullable<string>[];
};

export type StatisticsFilterInput = {
  currency: string | undefined;
  from: Date | undefined;
  status: string | undefined;
  store: string | undefined;
  to: Date | undefined;
  userId: string;
};

type ListHistoryInput = HistoryFilterInput & {
  skip: number;
  sort: DeliveryHistorySort;
  take: number;
};

type ListInTransitInput = InTransitFilterInput & {
  skip: number;
  sort: DeliveryInTransitSort;
  take: number;
};

type SummaryInput = {
  today: Date;
  userId: string;
  weekEnd: Date;
  weekStart: Date;
};

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  bulkReceive(
    { bookIds, transition, userId }: BulkReceiveInput,
    client?: Prisma.TransactionClient,
  ): Promise<BulkReceiveOutcome[]> {
    return runInClient({ client, prisma: this.prisma }, async (tx) => {
      const ownedRows = await tx.book.findMany({
        select: { id: true },
        where: { ...SOFT_DELETE_SCOPE.active, id: { in: bookIds }, userId },
      });
      const ownedIds = new Set(ownedRows.map((row) => row.id));

      const activeRows =
        ownedIds.size === 0
          ? []
          : await tx.bookDelivery.findMany({
              select: { bookId: true },
              where: {
                bookId: { in: [...ownedIds] },
                status: { in: [...SHIPMENT_ACTIVE_STATUSES] },
                userId,
              },
            });
      const receivedIds = new Set(activeRows.map((row) => row.bookId));

      if (receivedIds.size > 0) {
        await tx.bookDelivery.updateMany({
          data: transition.delivery,
          where: {
            bookId: { in: [...receivedIds] },
            status: { in: [...SHIPMENT_ACTIVE_STATUSES] },
            userId,
          },
        });
        if (transition.book !== null) {
          await tx.book.updateMany({
            data: transition.book,
            where: { ...SOFT_DELETE_SCOPE.active, id: { in: [...receivedIds] }, userId },
          });
        }
      }

      return bookIds.map((bookId): BulkReceiveOutcome => {
        if (!ownedIds.has(bookId)) {
          return { bookId, reason: "not_found", status: "skipped" };
        }
        if (!receivedIds.has(bookId)) {
          return { bookId, reason: "not_active", status: "skipped" };
        }
        return { bookId, status: "received" };
      });
    });
  }

  countActive(input: InTransitFilterInput): Promise<number> {
    return this.prisma.bookDelivery.count({ where: buildInTransitWhere(input) });
  }

  countHistory(input: HistoryFilterInput): Promise<number> {
    return this.prisma.bookDelivery.count({ where: buildHistoryWhere(input) });
  }

  async historySummary({
    includeCancelled,
    userId,
  }: {
    includeCancelled: boolean;
    userId: string;
  }): Promise<HistorySummaryData> {
    const currencyWhere: Prisma.BookDeliveryWhereInput = {
      book: SOFT_DELETE_SCOPE.active,
      price: { not: null },
      userId,
    };
    if (!includeCancelled) {
      currencyWhere.status = { not: DELIVERY_STATUS_CANCELLED };
    }

    const [countsRows, currencyGroups] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "totalOrders",
          (count(*) FILTER (
            WHERE bd.status IN (${Prisma.join([...SHIPMENT_ACTIVE_STATUSES])})
          ))::int AS "activeCount",
          (count(*) FILTER (WHERE bd.status = ${DELIVERY_STATUS_RECEIVED}))::int AS "receivedCount",
          (count(*) FILTER (WHERE bd.status = ${DELIVERY_STATUS_CANCELLED}))::int AS "cancelledCount"
        FROM book_deliveries bd
        JOIN books b ON b.id = bd.book_id
        WHERE bd.user_id = ${userId}::uuid
          AND b.deleted_at IS NULL
      `),
      this.prisma.bookDelivery.groupBy({
        _sum: { price: true },
        by: ["currency"],
        where: currencyWhere,
      }),
    ]);

    const counts =
      z.array(HistorySummaryCountsRowSchema).parse(countsRows)[0] ?? EMPTY_HISTORY_SUMMARY_COUNTS;

    return {
      activeCount: counts.activeCount,
      cancelledCount: counts.cancelledCount,
      currencyTotals: currencyGroups.map((group) => ({
        currency: group.currency,
        total: group._sum.price === null ? 0 : group._sum.price.toNumber(),
      })),
      receivedCount: counts.receivedCount,
      totalOrders: counts.totalOrders,
    };
  }

  listActive({ skip, sort, take, ...filter }: ListInTransitInput): Promise<DeliveryWithBook[]> {
    return this.prisma.bookDelivery.findMany({
      orderBy: IN_TRANSIT_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildInTransitWhere(filter),
      ...deliveryBookInclude,
    });
  }

  listHistory({ skip, sort, take, ...filter }: ListHistoryInput): Promise<DeliveryWithBook[]> {
    return this.prisma.bookDelivery.findMany({
      orderBy: HISTORY_SORT_ORDER_BY[sort],
      skip,
      take,
      where: buildHistoryWhere(filter),
      ...deliveryBookInclude,
    });
  }

  async listStatisticsRecords({
    currency,
    from,
    status,
    store,
    to,
    userId,
  }: StatisticsFilterInput): Promise<StatisticsRecord[]> {
    const where: Prisma.BookDeliveryWhereInput = { book: SOFT_DELETE_SCOPE.active, userId };

    if (store !== undefined) {
      where.storeName = { equals: store, mode: "insensitive" };
    }

    if (currency !== undefined) {
      applyCurrencyFilter({ currency, where });
    }

    if (status !== undefined) {
      where.status = status;
    }

    if (from !== undefined || to !== undefined) {
      where.orderDate = { gte: from, lte: to };
    }

    const rows = await this.prisma.bookDelivery.findMany({
      orderBy: { id: "asc" },
      select: {
        book: { select: { title: true } },
        bookId: true,
        currency: true,
        orderDate: true,
        price: true,
        status: true,
        storeName: true,
      },
      take: STATISTICS_MAX_RECORDS,
      where,
    });
    if (rows.length === STATISTICS_MAX_RECORDS) {
      log.warn(
        { cap: STATISTICS_MAX_RECORDS, userId },
        "delivery statistics truncated at the safety cap",
      );
    }

    return rows.map((row) => ({
      bookId: row.bookId,
      bookTitle: row.book.title,
      currency: row.currency === null ? null : CurrencySchema.parse(row.currency),
      orderDate: row.orderDate,
      price: row.price === null ? null : row.price.toNumber(),
      status: ShipmentStatusSchema.parse(row.status),
      storeName: row.storeName,
    }));
  }

  async summaryData({
    today,
    userId,
    weekEnd,
    weekStart,
  }: SummaryInput): Promise<InTransitSummaryData> {
    const base = activeInTransitBase(userId);
    const todayIso = toIsoDate(today);
    const weekStartIso = toIsoDate(weekStart);
    const weekEndIso = toIsoDate(weekEnd);

    const [countsRows, storeGroups, currencyGroups] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        SELECT
          (count(*))::int AS "activeCount",
          (count(*) FILTER (WHERE bd.expected_delivery_date < ${todayIso}::date))::int
            AS "delayedCount",
          (count(*) FILTER (
            WHERE bd.expected_delivery_date >= ${weekStartIso}::date
              AND bd.expected_delivery_date <= ${weekEndIso}::date
          ))::int AS "expectedThisWeek"
        FROM book_deliveries bd
        JOIN books b ON b.id = bd.book_id
        WHERE bd.user_id = ${userId}::uuid
          AND b.deleted_at IS NULL
          AND b.ownership_status = ${OWNERSHIP_STATUS_IN_TRANSIT}
          AND bd.status IN (${Prisma.join([...SHIPMENT_ACTIVE_STATUSES])})
      `),
      this.prisma.bookDelivery.groupBy({ by: ["storeName"], where: base }),
      this.prisma.bookDelivery.groupBy({
        _sum: { price: true },
        by: ["currency"],
        where: { ...base, price: { not: null } },
      }),
    ]);

    const counts =
      z.array(InTransitSummaryCountsRowSchema).parse(countsRows)[0] ??
      EMPTY_IN_TRANSIT_SUMMARY_COUNTS;

    return {
      activeCount: counts.activeCount,
      currencyTotals: currencyGroups.map((group) => ({
        currency: group.currency,
        total: group._sum.price === null ? 0 : group._sum.price.toNumber(),
      })),
      delayedCount: counts.delayedCount,
      expectedThisWeek: counts.expectedThisWeek,
      storeNames: storeGroups.map((group) => group.storeName),
    };
  }
}

const ID_TIEBREAKER: Prisma.BookDeliveryOrderByWithRelationInput = { id: "asc" };

const CLOSEST_DELIVERY_ORDER: Prisma.BookDeliveryOrderByWithRelationInput[] = [
  { expectedDeliveryDate: { nulls: "last", sort: "asc" } },
  { orderDate: { nulls: "last", sort: "desc" } },
  ID_TIEBREAKER,
];

const HISTORY_SORT_ORDER_BY: Record<
  DeliveryHistorySort,
  Prisma.BookDeliveryOrderByWithRelationInput[]
> = {
  newest_orders: [{ orderDate: { nulls: "last", sort: "desc" } }, ID_TIEBREAKER],
  oldest_orders: [{ orderDate: { nulls: "last", sort: "asc" } }, ID_TIEBREAKER],
  price: [{ price: { nulls: "last", sort: "desc" } }, ID_TIEBREAKER],
  recently_updated: [{ updatedAt: "desc" }, ID_TIEBREAKER],
  status: [{ status: "asc" }, ID_TIEBREAKER],
  store: [{ storeName: { nulls: "last", sort: "asc" } }, ID_TIEBREAKER],
  title: [{ book: { title: "asc" } }, ID_TIEBREAKER],
};

const IN_TRANSIT_SORT_ORDER_BY: Record<
  DeliveryInTransitSort,
  Prisma.BookDeliveryOrderByWithRelationInput[]
> = {
  author: [{ book: { firstAuthorName: "asc" } }, ID_TIEBREAKER],
  closest_delivery: CLOSEST_DELIVERY_ORDER,
  delayed_first: CLOSEST_DELIVERY_ORDER,
  newest_orders: [{ orderDate: { nulls: "last", sort: "desc" } }, ID_TIEBREAKER],
  oldest_orders: [{ orderDate: { nulls: "last", sort: "asc" } }, ID_TIEBREAKER],
  price: [{ price: { nulls: "last", sort: "asc" } }, ID_TIEBREAKER],
  service: [{ deliveryService: { nulls: "last", sort: "asc" } }, ID_TIEBREAKER],
  store: [{ storeName: { nulls: "last", sort: "asc" } }, ID_TIEBREAKER],
  title: [{ book: { title: "asc" } }, ID_TIEBREAKER],
};

function activeInTransitBase(userId: string): Prisma.BookDeliveryWhereInput {
  return {
    book: { ...SOFT_DELETE_SCOPE.active, ownershipStatus: "in_transit", userId },
    status: { in: [...SHIPMENT_ACTIVE_STATUSES] },
  };
}

function applyCurrencyFilter({
  currency,
  where,
}: {
  currency: string;
  where: Prisma.BookDeliveryWhereInput;
}): void {
  if (currency !== DEFAULT_CURRENCY) {
    where.currency = currency;
    return;
  }

  const uahMatch: Prisma.BookDeliveryWhereInput = {
    OR: [{ currency: DEFAULT_CURRENCY }, { currency: null, price: { not: null } }],
  };
  const existingAnd = where.AND;
  const andConditions =
    existingAnd === undefined ? [] : Array.isArray(existingAnd) ? existingAnd : [existingAnd];
  where.AND = [...andConditions, uahMatch];
}

function applyHistoryTab({
  tab,
  where,
}: {
  tab: DeliveryHistoryTab;
  where: Prisma.BookDeliveryWhereInput;
}): void {
  switch (tab) {
    case "active":
      where.status = { in: [...SHIPMENT_ACTIVE_STATUSES] };
      return;
    case "all":
      return;
    case "cancelled":
      where.status = "cancelled";
      return;
    case "received":
      where.status = "received";
      return;
    default: {
      const _exhaustiveCheck: never = tab;
      return _exhaustiveCheck;
    }
  }
}

function applyInTransitFilter({
  filter,
  soonEnd,
  today,
  weekEnd,
  weekStart,
  where,
}: {
  filter: DeliveryInTransitFilter;
  soonEnd: Date;
  today: Date;
  weekEnd: Date;
  weekStart: Date;
  where: Prisma.BookDeliveryWhereInput;
}): void {
  switch (filter) {
    case "all":
      return;
    case "arriving_soon":
      where.expectedDeliveryDate = { gte: today, lte: soonEnd };
      return;
    case "delayed":
      where.expectedDeliveryDate = { lt: today };
      return;
    case "has_price":
      where.price = { not: null };
      return;
    case "has_tracking_number":
      where.trackingNumber = { not: null };
      return;
    case "has_tracking_url":
      where.trackingUrl = { not: null };
      return;
    case "in_transit":
      where.status = "in_transit";
      return;
    case "no_delivery_date":
      where.expectedDeliveryDate = null;
      return;
    case "ordered":
      where.status = "ordered";
      return;
    case "this_week":
      where.expectedDeliveryDate = { gte: weekStart, lte: weekEnd };
      return;
    case "without_price":
      where.price = null;
      return;
    case "without_tracking_number":
      where.trackingNumber = null;
      return;
    case "without_tracking_url":
      where.trackingUrl = null;
      return;
    default: {
      const _exhaustiveCheck: never = filter;
      return _exhaustiveCheck;
    }
  }
}

function buildDeliverySearchConditions({
  includeCancelReason,
  search,
}: {
  includeCancelReason: boolean;
  search: string;
}): Prisma.BookDeliveryWhereInput[] {
  const contains = { contains: search, mode: "insensitive" } as const;
  const conditions: Prisma.BookDeliveryWhereInput[] = [
    { book: { title: contains } },
    { book: { originalTitle: contains } },
    { book: { firstAuthorName: contains } },
    { storeName: contains },
    { orderNumber: contains },
    { trackingNumber: contains },
    { deliveryService: contains },
    { note: contains },
  ];

  if (includeCancelReason) {
    conditions.push({ cancelReason: contains });
  }

  return conditions;
}

function buildHistoryWhere({
  currency,
  from,
  hasTrackingNumber,
  hasTrackingUrl,
  priceMax,
  priceMin,
  search,
  service,
  store,
  tab,
  to,
  userId,
}: HistoryFilterInput): Prisma.BookDeliveryWhereInput {
  const where: Prisma.BookDeliveryWhereInput = { book: SOFT_DELETE_SCOPE.active, userId };

  applyHistoryTab({ tab, where });

  if (store !== undefined) {
    where.storeName = { equals: store, mode: "insensitive" };
  }

  if (service !== undefined) {
    where.deliveryService = { equals: service, mode: "insensitive" };
  }

  if (currency !== undefined) {
    applyCurrencyFilter({ currency, where });
  }

  if (from !== undefined || to !== undefined) {
    where.orderDate = { gte: from, lte: to };
  }

  if (priceMin !== undefined || priceMax !== undefined) {
    where.price = { gte: priceMin, lte: priceMax };
  }

  if (hasTrackingNumber !== undefined) {
    where.trackingNumber = hasTrackingNumber ? { not: null } : null;
  }

  if (hasTrackingUrl !== undefined) {
    where.trackingUrl = hasTrackingUrl ? { not: null } : null;
  }

  if (search !== undefined) {
    where.OR = buildDeliverySearchConditions({ includeCancelReason: true, search });
  }

  return where;
}

function buildInTransitWhere({
  filter,
  search,
  service,
  soonEnd,
  store,
  today,
  userId,
  weekEnd,
  weekStart,
}: InTransitFilterInput): Prisma.BookDeliveryWhereInput {
  const where = activeInTransitBase(userId);

  if (store !== undefined) {
    where.storeName = { equals: store, mode: "insensitive" };
  }

  if (service !== undefined) {
    where.deliveryService = { equals: service, mode: "insensitive" };
  }

  applyInTransitFilter({ filter, soonEnd, today, weekEnd, weekStart, where });

  if (search !== undefined) {
    where.OR = buildDeliverySearchConditions({ includeCancelReason: false, search });
  }

  return where;
}
