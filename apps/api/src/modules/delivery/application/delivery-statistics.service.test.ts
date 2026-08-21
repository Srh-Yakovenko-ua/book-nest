import type { BookOrderStatisticsQuery } from "@app/shared";

import { BookOrderStatisticsViewSchema } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderStatisticsRecord } from "../domain/statistics-scope.js";
import type { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import {
  capOrderStatisticsRecords,
  ORDER_STATISTICS_FETCH,
} from "../domain/order-statistics-page.js";
import { DeliveryStatisticsService } from "./delivery-statistics.service.js";

const USER = "user-1";
const NOW = new Date("2026-08-20T09:30:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

function buildOrderRecords(count: number): OrderStatisticsRecord[] {
  return Array.from({ length: count }, (_unused, index): OrderStatisticsRecord => ({
    currency: "UAH",
    deliveryPrice: null,
    discount: null,
    id: `order-${index}`,
    isFree: false,
    items: [],
    orderDate: null,
    orderNumber: null,
    shipments: [],
    storeName: "Yakaboo",
    totalAmount: null,
  }));
}

function repositoryHolding(ordersCount: number): DeliveryStatisticsRepository {
  const fetchedRowsCount = Math.min(
    ordersCount,
    ORDER_STATISTICS_FETCH.maxOrders + ORDER_STATISTICS_FETCH.overshootRows,
  );

  return repositoryWithRecords(buildOrderRecords(fetchedRowsCount));
}

function repositoryWithRecords(records: OrderStatisticsRecord[]): DeliveryStatisticsRepository {
  return {
    listOrderRecords: vi.fn().mockResolvedValue(capOrderStatisticsRecords(records)),
  } as unknown as DeliveryStatisticsRepository;
}

function statisticsQuery(
  overrides: Partial<BookOrderStatisticsQuery> = {},
): BookOrderStatisticsQuery {
  return { includeCancelled: false, ...overrides };
}

describe("DeliveryStatisticsService.statistics", () => {
  it("parses the query dates and counts in orders, not in book rows", async () => {
    const repository = repositoryWithRecords([
      {
        currency: "UAH",
        deliveryPrice: null,
        discount: null,
        id: "order-1",
        isFree: false,
        items: [
          {
            bookId: "book-a",
            bookTitle: "Alpha",
            cancelledAt: null,
            id: "item-a",
            price: 100,
            receivedAt: null,
            shipmentId: "shipment-1",
          },
          {
            bookId: "book-b",
            bookTitle: "Beta",
            cancelledAt: null,
            id: "item-b",
            price: 50,
            receivedAt: null,
            shipmentId: "shipment-1",
          },
        ],
        orderDate: new Date("2026-08-01T00:00:00.000Z"),
        orderNumber: "A-1",
        shipments: [
          { cancelledAt: null, id: "shipment-1", receivedAt: null, status: "in_transit" },
        ],
        storeName: "Bookstore",
        totalAmount: 150,
      },
    ]);
    const service = new DeliveryStatisticsService(repository);

    const result = await service.statistics({
      query: statisticsQuery({ from: "2026-07-01" }),
      userId: USER,
    });

    expect(vi.mocked(repository.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: new Date("2026-07-01T00:00:00.000Z"), userId: USER }),
    );
    expect(result.summary.ordersCount).toBe(1);
    expect(result.summary.booksCount).toBe(2);
    expect(result.summary.shipmentsCount).toBe(1);
  });

  it("filters the read on the very same period it reports", async () => {
    const repository = repositoryWithRecords([]);
    const service = new DeliveryStatisticsService(repository);

    const result = await service.statistics({
      query: statisticsQuery({ from: "2026-07-01", to: "2026-07-31" }),
      userId: USER,
    });

    expect(vi.mocked(repository.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        from: parseIsoDate("2026-07-01"),
        to: parseIsoDate("2026-07-31"),
      }),
    );
    expect(result.meta.currentPeriod).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(result.meta.comparisonPeriod).toBeNull();
  });

  it("closes an open-ended period at today and filters the read on it", async () => {
    const repository = repositoryWithRecords([]);
    const service = new DeliveryStatisticsService(repository);

    const result = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(result.meta.currentPeriod).toEqual({ from: null, to: "2026-08-20" });
    expect(vi.mocked(repository.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: undefined, to: parseIsoDate("2026-08-20") }),
    );
  });
});

describe("DeliveryStatisticsService.statistics truncation", () => {
  it("reports a full read when one order short of the cap is stored", async () => {
    const ordersCount = ORDER_STATISTICS_FETCH.maxOrders - 1;
    const service = new DeliveryStatisticsService(repositoryHolding(ordersCount));

    const { meta, summary } = await service.statistics({
      query: statisticsQuery(),
      userId: USER,
    });

    expect(meta).toMatchObject({
      isTruncated: false,
      loadedOrdersCount: ordersCount,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(summary.ordersCount).toBe(ordersCount);
  });

  it("reports a full read when exactly the cap is stored", async () => {
    const ordersCount = ORDER_STATISTICS_FETCH.maxOrders;
    const service = new DeliveryStatisticsService(repositoryHolding(ordersCount));

    const { meta, summary } = await service.statistics({
      query: statisticsQuery(),
      userId: USER,
    });

    expect(meta).toMatchObject({
      isTruncated: false,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(summary.ordersCount).toBe(ordersCount);
  });

  it("reports a truncated read when one order past the cap is stored", async () => {
    const service = new DeliveryStatisticsService(
      repositoryHolding(ORDER_STATISTICS_FETCH.maxOrders + 1),
    );

    const { meta, summary } = await service.statistics({
      query: statisticsQuery(),
      userId: USER,
    });

    expect(meta).toMatchObject({
      isTruncated: true,
      loadedOrdersCount: ORDER_STATISTICS_FETCH.maxOrders,
      maxOrders: ORDER_STATISTICS_FETCH.maxOrders,
    });
    expect(summary.ordersCount).toBe(ORDER_STATISTICS_FETCH.maxOrders);
  });
});

describe("DeliveryStatisticsService.statistics contract", () => {
  it("returns a truncated read that still satisfies the shared response contract", async () => {
    const service = new DeliveryStatisticsService(
      repositoryHolding(ORDER_STATISTICS_FETCH.maxOrders + 1),
    );

    const view = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(BookOrderStatisticsViewSchema.parse(view).meta.isTruncated).toBe(true);
    expect(BookOrderStatisticsViewSchema.parse(view).records.scope.isTruncated).toBe(true);
  });

  it("returns an empty read as empty arrays and null scalars, not as placeholder rows", async () => {
    const service = new DeliveryStatisticsService(repositoryWithRecords([]));

    const view = BookOrderStatisticsViewSchema.parse(
      await service.statistics({ query: statisticsQuery(), userId: USER }),
    );

    expect({
      byStore: view.byStore,
      comparison: view.comparison,
      costs: view.costs,
      daily: view.daily,
      landedCost: view.landedCost,
      monthly: view.monthly,
      pulse: view.pulse,
      topOrdersByCurrency: view.topOrdersByCurrency,
    }).toEqual({
      byStore: [],
      comparison: null,
      costs: [],
      daily: [],
      landedCost: [],
      monthly: [],
      pulse: [],
      topOrdersByCurrency: [],
    });
  });
});

describe("DeliveryStatisticsService.statistics query shape", () => {
  it("reads the orders once, never once per store or per bucket", async () => {
    const repository = repositoryWithRecords(buildOrderRecords(50));
    const service = new DeliveryStatisticsService(repository);

    const view = await service.statistics({ query: statisticsQuery(), userId: USER });

    expect(vi.mocked(repository.listOrderRecords)).toHaveBeenCalledTimes(1);
    expect(view.summary.ordersCount).toBe(50);
  });

  it("adds exactly one more read when a comparison period is asked for", async () => {
    const repository = repositoryWithRecords(buildOrderRecords(10));
    const service = new DeliveryStatisticsService(repository);

    await service.statistics({
      query: statisticsQuery({ compare: "previous_period", from: "2026-07-01", to: "2026-07-31" }),
      userId: USER,
    });

    expect(vi.mocked(repository.listOrderRecords)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(repository.listOrderRecords).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        from: parseIsoDate("2026-06-01"),
        to: parseIsoDate("2026-06-30"),
      }),
    );
  });
});
