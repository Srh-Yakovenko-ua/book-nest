import type {
  BulkReceiveSkipReason,
  DeliveryHistorySort,
  DeliveryHistoryTab,
  DeliveryInTransitFilter,
  DeliveryInTransitSort,
  Nullable,
} from "@app/shared";

import { CurrencySchema, DELIVERY_ACTIVE_STATUSES, DeliveryStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { RecordDeliveryTransition } from "../../books/index.js";
import type { StatisticsRecord } from "../domain/delivery-statistics.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

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

  async bulkReceive(
    { bookIds, transition, userId }: BulkReceiveInput,
    client?: Prisma.TransactionClient,
  ): Promise<BulkReceiveOutcome[]> {
    if (client === undefined) {
      return this.prisma.$transaction((tx) =>
        this.bulkReceive({ bookIds, transition, userId }, tx),
      );
    }

    const outcomes: BulkReceiveOutcome[] = [];

    for (const bookId of bookIds) {
      const owned = await client.book.findFirst({
        select: { id: true },
        where: { id: bookId, userId },
      });
      if (owned === null) {
        outcomes.push({ bookId, reason: "not_found", status: "skipped" });
        continue;
      }

      const updated = await client.bookDelivery.updateMany({
        data: transition.delivery,
        where: { book: { userId }, bookId, status: { in: [...DELIVERY_ACTIVE_STATUSES] } },
      });
      if (updated.count === 0) {
        outcomes.push({ bookId, reason: "not_active", status: "skipped" });
        continue;
      }

      if (transition.book !== null) {
        await client.book.update({ data: transition.book, where: { id: bookId } });
      }

      outcomes.push({ bookId, status: "received" });
    }

    return outcomes;
  }

  countActive(input: InTransitFilterInput): Promise<number> {
    return this.prisma.bookDelivery.count({ where: buildInTransitWhere(input) });
  }

  countHistory(input: HistoryFilterInput): Promise<number> {
    return this.prisma.bookDelivery.count({ where: buildHistoryWhere(input) });
  }

  async historySummary({ userId }: { userId: string }): Promise<HistorySummaryData> {
    const base: Prisma.BookDeliveryWhereInput = { book: { userId } };

    const [totalOrders, activeCount, receivedCount, cancelledCount, currencyGroups] =
      await Promise.all([
        this.prisma.bookDelivery.count({ where: base }),
        this.prisma.bookDelivery.count({
          where: { ...base, status: { in: [...DELIVERY_ACTIVE_STATUSES] } },
        }),
        this.prisma.bookDelivery.count({ where: { ...base, status: "received" } }),
        this.prisma.bookDelivery.count({ where: { ...base, status: "cancelled" } }),
        this.prisma.bookDelivery.groupBy({
          _sum: { price: true },
          by: ["currency"],
          where: {
            ...base,
            price: { not: null },
            status: { not: "cancelled" },
          },
        }),
      ]);

    return {
      activeCount,
      cancelledCount,
      currencyTotals: currencyGroups.map((group) => ({
        currency: group.currency,
        total: group._sum.price === null ? 0 : group._sum.price.toNumber(),
      })),
      receivedCount,
      totalOrders,
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
    const where: Prisma.BookDeliveryWhereInput = { book: { userId } };

    if (store !== undefined) {
      where.storeName = { equals: store, mode: "insensitive" };
    }

    if (currency !== undefined) {
      where.currency = currency;
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
      where,
    });

    return rows.map((row) => ({
      bookId: row.bookId,
      bookTitle: row.book.title,
      currency: row.currency === null ? null : CurrencySchema.parse(row.currency),
      orderDate: row.orderDate,
      price: row.price === null ? null : row.price.toNumber(),
      status: DeliveryStatusSchema.parse(row.status),
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

    const [activeCount, delayedCount, expectedThisWeek, storeGroups, currencyGroups] =
      await Promise.all([
        this.prisma.bookDelivery.count({ where: base }),
        this.prisma.bookDelivery.count({
          where: { ...base, expectedDeliveryDate: { lt: today } },
        }),
        this.prisma.bookDelivery.count({
          where: { ...base, expectedDeliveryDate: { gte: weekStart, lte: weekEnd } },
        }),
        this.prisma.bookDelivery.groupBy({ by: ["storeName"], where: base }),
        this.prisma.bookDelivery.groupBy({
          _sum: { price: true },
          by: ["currency"],
          where: { ...base, price: { not: null } },
        }),
      ]);

    return {
      activeCount,
      currencyTotals: currencyGroups.map((group) => ({
        currency: group.currency,
        total: group._sum.price === null ? 0 : group._sum.price.toNumber(),
      })),
      delayedCount,
      expectedThisWeek,
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
    book: { ownershipStatus: "in_transit", userId },
    status: { in: [...DELIVERY_ACTIVE_STATUSES] },
  };
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
      where.status = { in: [...DELIVERY_ACTIVE_STATUSES] };
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
  const where: Prisma.BookDeliveryWhereInput = { book: { userId } };

  applyHistoryTab({ tab, where });

  if (store !== undefined) {
    where.storeName = { equals: store, mode: "insensitive" };
  }

  if (service !== undefined) {
    where.deliveryService = { equals: service, mode: "insensitive" };
  }

  if (currency !== undefined) {
    where.currency = currency;
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
