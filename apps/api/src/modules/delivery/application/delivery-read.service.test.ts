import type { BookOrderHistoryQuery, BookOrderStatisticsQuery, InTransitQuery } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { DeliveryReadRepository } from "../infrastructure/delivery-read.repository.js";
import type { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";

import { Prisma } from "../../../generated/prisma/client.js";
import { DeliveryReadService } from "./delivery-read.service.js";

const USER = "user-1";

const mediaStub = { buildViewOrNull: vi.fn().mockReturnValue(null) } as unknown as MediaService;

const bookRow = {
  coverMedia: null,
  firstAuthorName: "Adams",
  genres: ["fantasy"],
  id: "book-a",
  originalTitle: null,
  ownershipStatus: "in_transit",
  partNumber: null,
  publisher: null,
  readingStatus: "not_started",
  series: null,
  tags: [{ tag: { name: "own" } }],
  title: "Alpha",
};

const orderRow = {
  currency: "UAH",
  deliveryPrice: null,
  discount: null,
  id: "order-1",
  orderDate: new Date("2026-08-01T00:00:00.000Z"),
  orderNumber: "A-1",
  storeName: "Bookstore",
  totalAmount: new Prisma.Decimal("120.50"),
};

function buildService(overrides: {
  reads?: Partial<DeliveryReadRepository>;
  statistics?: Partial<DeliveryStatisticsRepository>;
}) {
  const reads = {
    countHistory: vi.fn().mockResolvedValue(0),
    countInTransit: vi.fn().mockResolvedValue(0),
    historySummary: vi.fn(),
    inTransitSummary: vi.fn(),
    listHistory: vi.fn().mockResolvedValue([]),
    listInTransit: vi.fn().mockResolvedValue([]),
    ...overrides.reads,
  } as unknown as DeliveryReadRepository;
  const statistics = {
    listOrderRecords: vi.fn().mockResolvedValue([]),
    ...overrides.statistics,
  } as unknown as DeliveryStatisticsRepository;

  return {
    reads,
    service: new DeliveryReadService(reads, statistics, mediaStub),
    statistics,
  };
}

function historyQuery(overrides: Partial<BookOrderHistoryQuery> = {}): BookOrderHistoryQuery {
  return {
    pageNumber: 1,
    pageSize: 10,
    sort: "newest_orders",
    tab: "all",
    ...overrides,
  };
}

function inTransitQuery(overrides: Partial<InTransitQuery> = {}): InTransitQuery {
  return {
    filter: "all",
    pageNumber: 1,
    pageSize: 10,
    sort: "closest_delivery",
    ...overrides,
  };
}

function itemRow({
  cancelledAt = null,
  expectedDeliveryDate = null,
  receivedAt = null,
  status = "in_transit",
}: {
  cancelledAt?: Date | null;
  expectedDeliveryDate?: Date | null;
  receivedAt?: Date | null;
  status?: string;
}) {
  return {
    book: bookRow,
    bookId: bookRow.id,
    cancelledAt,
    cancelReason: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    id: "item-1",
    order: {
      ...orderRow,
      items: [{ cancelledAt, receivedAt, shipmentId: "shipment-1" }],
      shipments: [{ id: "shipment-1", status }],
    },
    orderId: orderRow.id,
    price: new Prisma.Decimal("120.50"),
    receivedAt,
    shipment: {
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      deliveryService: {
        id: "service-1",
        name: "Nova Poshta",
        trackingUrlTemplate: "https://np.test/{trackingNumber}",
      },
      deliveryServiceId: "service-1",
      deliveryServiceName: "Nova Poshta",
      expectedDeliveryDate,
      id: "shipment-1",
      note: null,
      orderId: orderRow.id,
      pickupUntil: null,
      receivedAt: null,
      status,
      trackingNumber: "TRK-1",
      trackingUrl: null,
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    shipmentId: "shipment-1",
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  };
}

function statisticsQuery(
  overrides: Partial<BookOrderStatisticsQuery> = {},
): BookOrderStatisticsQuery {
  return { includeCancelled: false, ...overrides };
}

describe("DeliveryReadService.inTransitList", () => {
  it("maps a row into the book-shaped view with its order and parcel context", async () => {
    const { service } = buildService({
      reads: {
        countInTransit: vi.fn().mockResolvedValue(1),
        listInTransit: vi.fn().mockResolvedValue([itemRow({})]),
      },
    });

    const page = await service.inTransitList({ query: inTransitQuery(), userId: USER });

    expect(page.totalCount).toBe(1);
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        book: expect.objectContaining({ id: "book-a", title: "Alpha" }),
        id: "item-1",
        order: {
          currency: "UAH",
          deliveryPrice: null,
          derivedStatus: "shipped",
          discount: null,
          id: "order-1",
          orderDate: "2026-08-01",
          orderNumber: "A-1",
          storeName: "Bookstore",
          totalAmount: 120.5,
        },
        price: 120.5,
      }),
    );
    expect(page.items[0]?.shipment).toEqual(
      expect.objectContaining({
        deliveryService: { id: "service-1", name: "Nova Poshta" },
        id: "shipment-1",
        status: "in_transit",
        trackingUrl: "https://np.test/TRK-1",
      }),
    );
  });

  it("reads the list and its total through the very same filter", async () => {
    const { reads, service } = buildService({});

    await service.inTransitList({
      query: inTransitQuery({ filter: "delayed", search: "  alpha  ", store: "Bookstore" }),
      userId: USER,
    });

    const listArgs = vi.mocked(reads.listInTransit).mock.calls[0]?.[0];
    const countArgs = vi.mocked(reads.countInTransit).mock.calls[0]?.[0];
    expect(countArgs).toEqual({
      bounds: listArgs?.bounds,
      currency: undefined,
      filter: "delayed",
      search: "alpha",
      service: undefined,
      store: "Bookstore",
      userId: USER,
    });
    expect(listArgs).toEqual(
      expect.objectContaining({ skip: 0, sort: "closest_delivery", take: 10 }),
    );
  });

  it("dates the row status with the same bounds it filtered on", async () => {
    const { reads, service } = buildService({
      reads: {
        countInTransit: vi.fn().mockResolvedValue(1),
        listInTransit: vi
          .fn()
          .mockResolvedValue([
            itemRow({ expectedDeliveryDate: new Date("1999-01-01T00:00:00.000Z") }),
          ]),
      },
    });

    const page = await service.inTransitList({ query: inTransitQuery(), userId: USER });
    const bounds = vi.mocked(reads.listInTransit).mock.calls[0]?.[0].bounds;

    expect(page.items[0]?.uiStatus).toBe("delayed");
    expect(bounds?.today).toBeInstanceOf(Date);
  });
});

describe("DeliveryReadService.historyList", () => {
  it("keeps the history unit book-shaped and hides the arrival badge of a settled book", async () => {
    const { service } = buildService({
      reads: {
        countHistory: vi.fn().mockResolvedValue(2),
        listHistory: vi
          .fn()
          .mockResolvedValue([
            itemRow({ receivedAt: new Date("2026-08-05T00:00:00.000Z"), status: "received" }),
            itemRow({ cancelledAt: new Date("2026-08-06T00:00:00.000Z") }),
          ]),
      },
    });

    const page = await service.historyList({ query: historyQuery(), userId: USER });

    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.uiStatus)).toEqual([null, null]);
    expect(page.items[0]?.receivedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(page.items[1]?.cancelledAt).toBe("2026-08-06T00:00:00.000Z");
  });

  it("passes the tab, the parsed dates and the paging window to the repository", async () => {
    const { reads, service } = buildService({});

    await service.historyList({
      query: historyQuery({
        from: "2026-07-01",
        hasTrackingNumber: true,
        pageNumber: 2,
        pageSize: 5,
        priceMin: 10,
        sort: "price",
        tab: "cancelled",
        to: "2026-08-01",
      }),
      userId: USER,
    });

    expect(reads.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date("2026-07-01T00:00:00.000Z"),
        hasTrackingNumber: true,
        priceMin: 10,
        skip: 5,
        sort: "price",
        tab: "cancelled",
        take: 5,
        to: new Date("2026-08-01T00:00:00.000Z"),
        userId: USER,
      }),
    );
  });
});

describe("DeliveryReadService.historySummary", () => {
  it("keeps orders, parcels and books apart and folds the money by currency", async () => {
    const { service } = buildService({
      reads: {
        historySummary: vi.fn().mockResolvedValue({
          activeBooksCount: 2,
          booksCount: 6,
          cancelledBooksCount: 1,
          currencyTotals: [
            { currency: "UAH", total: 300 },
            { currency: null, total: 40 },
            { currency: "USD", total: 15 },
          ],
          ordersCount: 3,
          receivedBooksCount: 3,
          shipmentsCount: 4,
        }),
      },
    });

    const summary = await service.historySummary({
      query: { includeCancelled: false },
      userId: USER,
    });

    expect(summary).toEqual({
      activeBooksCount: 2,
      booksCount: 6,
      cancelledBooksCount: 1,
      ordersCount: 3,
      receivedBooksCount: 3,
      shipmentsCount: 4,
      totalByCurrency: [
        { currency: "UAH", total: 340 },
        { currency: "USD", total: 15 },
      ],
    });
  });
});

describe("DeliveryReadService.inTransitSummary", () => {
  it("hands the repository the bounds and maps the counts onto the view", async () => {
    const { reads, service } = buildService({
      reads: {
        inTransitSummary: vi.fn().mockResolvedValue({
          activeBooksCount: 5,
          activeOrdersCount: 2,
          activeShipmentsCount: 3,
          attentionCount: 4,
          bookTotals: [{ currency: "UAH", total: 100 }],
          delayedCount: 1,
          expectedThisWeekCount: 2,
          inTransitCount: 3,
          nextExpectedDelivery: "2026-08-20",
          orderedCount: 1,
          orderTotals: [],
          readyForPickupCount: 1,
          uniqueStoresCount: 2,
          withoutExpectedDateCount: 0,
          withoutPriceCount: 1,
          withoutTrackingCount: 1,
        }),
      },
    });

    const summary = await service.inTransitSummary({ userId: USER });

    expect(vi.mocked(reads.inTransitSummary).mock.calls[0]?.[0].userId).toBe(USER);
    expect(summary.activeBooksCount).toBe(5);
    expect(summary.activeOrdersCount).toBe(2);
    expect(summary.activeShipmentsCount).toBe(3);
    expect(summary.activeBooksTotalByCurrency).toEqual([{ currency: "UAH", total: 100 }]);
  });
});

describe("DeliveryReadService.statistics", () => {
  it("parses the query dates and counts in orders, not in book rows", async () => {
    const { service, statistics } = buildService({
      statistics: {
        listOrderRecords: vi.fn().mockResolvedValue([
          {
            currency: "UAH",
            id: "order-1",
            items: [
              {
                bookId: "book-a",
                bookTitle: "Alpha",
                cancelledAt: null,
                price: 100,
                receivedAt: null,
                shipmentId: "shipment-1",
              },
              {
                bookId: "book-b",
                bookTitle: "Beta",
                cancelledAt: null,
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
        ]),
      },
    });

    const result = await service.statistics({
      query: statisticsQuery({ from: "2026-07-01" }),
      userId: USER,
    });

    expect(vi.mocked(statistics.listOrderRecords).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: new Date("2026-07-01T00:00:00.000Z"), userId: USER }),
    );
    expect(result.summary.ordersCount).toBe(1);
    expect(result.summary.booksCount).toBe(2);
    expect(result.summary.shipmentsCount).toBe(1);
  });
});
