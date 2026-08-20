import type {
  BookOrderHistoryQuery,
  BookOrderStatisticsQuery,
  InTransitQuery,
  Nullable,
} from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/index.js";
import type { DeliveryImpactRepository } from "../infrastructure/delivery-impact.repository.js";
import type { DeliveryReadRepository } from "../infrastructure/delivery-read.repository.js";
import type { DeliveryStatisticsRepository } from "../infrastructure/delivery-statistics.repository.js";
import type { HistoryOutcomeRepository } from "../infrastructure/history-outcome.repository.js";

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

function bookRowInSeries(totalBooks: Nullable<number>) {
  return {
    ...bookRow,
    partNumber: 1,
    series: { id: "series-1", name: "Hitchhiker's Guide", totalBooks },
  };
}

const orderRow = {
  currency: "UAH",
  deliveryPrice: null,
  discount: null,
  id: "order-1",
  note: "Дзвонити перед доставкою",
  orderDate: new Date("2026-08-01T00:00:00.000Z"),
  orderNumber: "A-1",
  storeName: "Bookstore",
  totalAmount: new Prisma.Decimal("120.50"),
};

function buildService(overrides: {
  impact?: Partial<DeliveryImpactRepository>;
  outcome?: Partial<HistoryOutcomeRepository>;
  reads?: Partial<DeliveryReadRepository>;
  statistics?: Partial<DeliveryStatisticsRepository>;
}) {
  const impact = {
    listGoalRows: vi.fn().mockResolvedValue([]),
    listQueueRows: vi.fn().mockResolvedValue([]),
    listSeriesRows: vi.fn().mockResolvedValue([]),
    ...overrides.impact,
  } as unknown as DeliveryImpactRepository;
  const reads = {
    countHistory: vi.fn().mockResolvedValue(0),
    countInTransit: vi.fn().mockResolvedValue(0),
    historyFacets: vi.fn().mockResolvedValue({ services: [], stores: [] }),
    historySummary: vi.fn(),
    inTransitSummary: vi.fn(),
    latestReceipt: vi.fn().mockResolvedValue(null),
    listHistory: vi.fn().mockResolvedValue([]),
    listInTransit: vi.fn().mockResolvedValue([]),
    nextShipment: vi.fn().mockResolvedValue(null),
    ...overrides.reads,
  } as unknown as DeliveryReadRepository;
  const statistics = {
    listOrderRecords: vi.fn().mockResolvedValue([]),
    ...overrides.statistics,
  } as unknown as DeliveryStatisticsRepository;
  const outcome = {
    hasReceivedBooks: vi.fn().mockResolvedValue(false),
    listReceivedSeriesRows: vi.fn().mockResolvedValue([]),
    receivedUnreadCounts: vi.fn().mockResolvedValue({ booksCount: 0, inQueueCount: 0 }),
    receivedUnreadPreviews: vi.fn().mockResolvedValue([]),
    ...overrides.outcome,
  } as unknown as HistoryOutcomeRepository;

  return {
    impact,
    outcome,
    reads,
    service: new DeliveryReadService(impact, reads, statistics, outcome, mediaStub),
    statistics,
  };
}

function emptyHistoryCounts() {
  return {
    cancelledBooksCount: 0,
    cancelledOrdersCount: 0,
    completedOrdersCount: 0,
    completedWithCancellationsCount: 0,
    completedWithoutCancellationsCount: 0,
    receivedBooksCount: 0,
    receivedOrdersCount: 0,
    receivedSeriesBooksCount: 0,
    receivedSeriesCount: 0,
    receivedShipmentsCount: 0,
    receivedStandaloneBooksCount: 0,
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
  book = bookRow,
  cancelledAt = null,
  expectedDeliveryDate = null,
  id = "item-1",
  receivedAt = null,
  shipmentId = "shipment-1",
  status = "in_transit",
}: {
  book?: ReturnType<typeof bookRowInSeries> | typeof bookRow;
  cancelledAt?: Date | null;
  expectedDeliveryDate?: Date | null;
  id?: string;
  receivedAt?: Date | null;
  shipmentId?: null | string;
  status?: string;
}) {
  return {
    book,
    bookId: book.id,
    cancelledAt,
    cancelReason: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    id,
    order: {
      ...orderRow,
      items: [
        {
          book: { deletedAt: null },
          cancelledAt,
          price: new Prisma.Decimal("120.50"),
          receivedAt,
          shipmentId,
        },
      ],
      shipments: [{ id: "shipment-1", status }],
    },
    orderId: orderRow.id,
    price: new Prisma.Decimal("120.50"),
    receivedAt,
    shipment:
      shipmentId === null
        ? null
        : {
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
            id: shipmentId,
            note: null,
            orderId: orderRow.id,
            pickupUntil: null,
            receivedAt,
            status,
            trackingNumber: "TRK-1",
            trackingUrl: null,
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          },
    shipmentId,
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
          effectiveTotalAmount: 120.5,
          id: "order-1",
          itemsCount: 1,
          note: "Дзвонити перед доставкою",
          orderDate: "2026-08-01",
          orderNumber: "A-1",
          pricedItemsCount: 1,
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

  it("maps the known and unknown series totals into the book preview", async () => {
    const knownTotalRow = itemRow({ book: bookRowInSeries(6) });
    const unknownTotalRow = itemRow({ book: bookRowInSeries(null) });
    const { service } = buildService({
      reads: {
        countInTransit: vi.fn().mockResolvedValue(2),
        listInTransit: vi.fn().mockResolvedValue([knownTotalRow, unknownTotalRow]),
      },
    });

    const page = await service.inTransitList({ query: inTransitQuery(), userId: USER });

    expect(page.items.map((item) => item.book.series)).toEqual([
      { id: "series-1", name: "Hitchhiker's Guide", partNumber: 1, totalBooks: 6 },
      { id: "series-1", name: "Hitchhiker's Guide", partNumber: 1, totalBooks: null },
    ]);
  });

  it("reads the list and its total through the very same filter", async () => {
    const { reads, service } = buildService({});

    await service.inTransitList({
      query: inTransitQuery({ filter: "delayed", search: "  alpha  ", store: ["Bookstore"] }),
      userId: USER,
    });

    const listArgs = vi.mocked(reads.listInTransit).mock.calls[0]?.[0];
    const countArgs = vi.mocked(reads.countInTransit).mock.calls[0]?.[0];
    expect(countArgs).toEqual({
      booksMax: undefined,
      booksMin: undefined,
      bounds: listArgs?.bounds,
      currency: undefined,
      expectedFrom: undefined,
      expectedTo: undefined,
      filter: "delayed",
      orderedFrom: undefined,
      orderedTo: undefined,
      priceCurrency: undefined,
      priceMax: undefined,
      priceMin: undefined,
      search: "alpha",
      service: undefined,
      store: ["Bookstore"],
      structure: undefined,
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
  it("groups the page into orders and their parcels instead of loose books", async () => {
    const { service } = buildService({
      reads: {
        countHistory: vi.fn().mockResolvedValue({ totalBooksCount: 2, totalCount: 1 }),
        listHistory: vi.fn().mockResolvedValue([
          itemRow({
            id: "item-1",
            receivedAt: new Date("2026-08-05T00:00:00.000Z"),
            status: "received",
          }),
          itemRow({
            id: "item-2",
            receivedAt: new Date("2026-08-05T00:00:00.000Z"),
            status: "received",
          }),
        ]),
      },
    });

    const page = await service.historyList({
      query: historyQuery({ tab: "received" }),
      userId: USER,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.order.id).toBe(orderRow.id);
    expect(page.items[0]?.booksCount).toBe(2);
    expect(page.items[0]?.shipments).toHaveLength(1);
    expect(page.items[0]?.shipments[0]?.books.map((entry) => entry.id)).toEqual([
      "item-1",
      "item-2",
    ]);
  });

  it("counts orders in totalCount and keeps the book tally in its own field", async () => {
    const { service } = buildService({
      reads: {
        countHistory: vi.fn().mockResolvedValue({ totalBooksCount: 128, totalCount: 34 }),
        listHistory: vi
          .fn()
          .mockResolvedValue([itemRow({ receivedAt: new Date("2026-08-05T00:00:00.000Z") })]),
      },
    });

    const page = await service.historyList({ query: historyQuery(), userId: USER });

    expect(page.totalCount).toBe(34);
    expect(page.totalBooksCount).toBe(128);
  });

  it("keeps the books that never reached a parcel in their own group", async () => {
    const { service } = buildService({
      reads: {
        countHistory: vi.fn().mockResolvedValue({ totalBooksCount: 2, totalCount: 1 }),
        listHistory: vi.fn().mockResolvedValue([
          itemRow({ cancelledAt: new Date("2026-08-06T00:00:00.000Z"), id: "item-1" }),
          itemRow({
            cancelledAt: new Date("2026-08-07T00:00:00.000Z"),
            id: "item-2",
            shipmentId: null,
          }),
        ]),
      },
    });

    const page = await service.historyList({
      query: historyQuery({ tab: "cancelled" }),
      userId: USER,
    });

    expect(page.items[0]?.shipments).toHaveLength(2);
    expect(page.items[0]?.shipments[1]?.shipment).toBeNull();
    expect(page.items[0]?.shipments[1]?.books[0]?.cancelledAt).toBe("2026-08-07T00:00:00.000Z");
  });

  it("carries the terminal state of the parcel itself, not only of its books", async () => {
    const { service } = buildService({
      reads: {
        countHistory: vi.fn().mockResolvedValue({ totalBooksCount: 1, totalCount: 1 }),
        listHistory: vi
          .fn()
          .mockResolvedValue([
            itemRow({ receivedAt: new Date("2026-08-05T00:00:00.000Z"), status: "received" }),
          ]),
      },
    });

    const page = await service.historyList({ query: historyQuery(), userId: USER });

    expect(page.items[0]?.shipments[0]?.shipment?.receivedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(page.items[0]?.shipments[0]?.shipment?.status).toBe("received");
  });

  it("passes the tab, every filter dimension and the paging window to the repository", async () => {
    const { reads, service } = buildService({});

    await service.historyList({
      query: historyQuery({
        booksMax: 9,
        booksMin: 3,
        cancelledFrom: "2026-08-01",
        cancelledTo: "2026-08-20",
        currency: ["UAH"],
        from: "2026-07-01",
        pageNumber: 2,
        pageSize: 5,
        priceCurrency: "UAH",
        priceMin: 10,
        service: ["Nova Poshta"],
        sort: "price_desc",
        store: ["Yakaboo"],
        tab: "cancelled",
        to: "2026-08-01",
      }),
      userId: USER,
    });

    expect(reads.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        booksMax: 9,
        booksMin: 3,
        cancelledFrom: "2026-08-01",
        cancelledTo: "2026-08-20",
        currency: ["UAH"],
        from: "2026-07-01",
        priceCurrency: "UAH",
        priceMin: 10,
        service: ["Nova Poshta"],
        skip: 5,
        sort: "price_desc",
        store: ["Yakaboo"],
        tab: "cancelled",
        take: 5,
        to: "2026-08-01",
        userId: USER,
      }),
    );
  });

  it("falls back to the default sort when prices are compared across unnamed currencies", async () => {
    const { reads, service } = buildService({});

    await service.historyList({ query: historyQuery({ sort: "price_asc" }), userId: USER });

    expect(reads.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest_orders" }),
    );
  });

  it("falls back to the default sort when more than one currency is in play", async () => {
    const { reads, service } = buildService({});

    await service.historyList({
      query: historyQuery({ currency: ["UAH", "EUR"], sort: "price_asc" }),
      userId: USER,
    });

    expect(reads.listHistory).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "newest_orders" }),
    );
  });

  it("keeps a price sort once a single currency gates it", async () => {
    const { reads, service } = buildService({});

    await service.historyList({
      query: historyQuery({ currency: ["UAH"], sort: "price_asc" }),
      userId: USER,
    });

    expect(reads.listHistory).toHaveBeenCalledWith(expect.objectContaining({ sort: "price_asc" }));
  });
});

describe("DeliveryReadService.historyFacets", () => {
  it("ranks the stores and services of the asked tab by how many orders carry them", async () => {
    const historyFacets = vi.fn().mockResolvedValue({
      services: [
        { count: 1, name: "Ukrposhta" },
        { count: 4, name: "Nova Poshta" },
      ],
      stores: [
        { count: 2, name: "Book24" },
        { count: 2, name: "Yakaboo" },
      ],
    });
    const { service } = buildService({ reads: { historyFacets } });

    const view = await service.historyFacets({ query: { tab: "cancelled" }, userId: USER });

    expect(historyFacets).toHaveBeenCalledWith({ tab: "cancelled", userId: USER });
    expect(view.services.map((entry) => entry.name)).toEqual(["Nova Poshta", "Ukrposhta"]);
    expect(view.stores.map((entry) => entry.name)).toEqual(["Book24", "Yakaboo"]);
  });
});

describe("DeliveryReadService.historySummary", () => {
  it("asks the repository for the caller's history and hands the counts straight to the view", async () => {
    const historySummary = vi.fn().mockResolvedValue({
      cancelledBooksCount: 7,
      cancelledOrdersCount: 5,
      completedOrdersCount: 18,
      completedWithCancellationsCount: 3,
      completedWithoutCancellationsCount: 15,
      receivedBooksCount: 25,
      receivedOrdersCount: 12,
      receivedSeriesBooksCount: 18,
      receivedSeriesCount: 12,
      receivedShipmentsCount: 14,
      receivedStandaloneBooksCount: 7,
    });
    const { service } = buildService({ reads: { historySummary } });

    const summary = await service.historySummary(USER);

    expect(historySummary).toHaveBeenCalledWith(USER);
    expect(summary).toEqual({
      cancelledBooksCount: 7,
      cancelledOrdersCount: 5,
      completedOrdersCount: 18,
      completedWithCancellationsCount: 3,
      completedWithoutCancellationsCount: 15,
      latestReceipt: null,
      receivedBooksCount: 25,
      receivedOrdersCount: 12,
      receivedSeriesBooksCount: 18,
      receivedSeriesCount: 12,
      receivedShipmentsCount: 14,
      receivedStandaloneBooksCount: 7,
    });
  });

  it("maps the latest receipt event, keeping the parcel-less case free of an invented service", async () => {
    const latestReceipt = vi.fn().mockResolvedValue({
      bookPreviews: [
        {
          book: { coverMedia: null, firstAuthorName: "Adams", id: "book-a", title: "Alpha" },
        },
      ],
      event: {
        booksCount: 4,
        deliveryServiceId: null,
        deliveryServiceName: null,
        orderId: "order-9",
        receivedAt: new Date("2026-08-19T10:15:00.000Z"),
        sameDayCount: 2,
        shipmentId: null,
        storeName: "Bookstore",
      },
    });
    const { service } = buildService({
      reads: { historySummary: vi.fn().mockResolvedValue(emptyHistoryCounts()), latestReceipt },
    });

    const summary = await service.historySummary(USER);

    expect(latestReceipt).toHaveBeenCalledWith({ bookPreviewsMax: 3, userId: USER });
    expect(summary.latestReceipt).toEqual({
      bookPreviews: [{ authorName: "Adams", cover: null, id: "book-a", title: "Alpha" }],
      booksCount: 4,
      deliveryService: null,
      orderId: "order-9",
      receivedAt: "2026-08-19T10:15:00.000Z",
      sameDayCount: 2,
      shipmentId: null,
      storeName: "Bookstore",
    });
  });

  it("keeps the parcel and its service on a receipt that arrived in one", async () => {
    const latestReceipt = vi.fn().mockResolvedValue({
      bookPreviews: [],
      event: {
        booksCount: 1,
        deliveryServiceId: "service-1",
        deliveryServiceName: "Nova Poshta",
        orderId: "order-9",
        receivedAt: new Date("2026-08-19T10:15:00.000Z"),
        sameDayCount: 0,
        shipmentId: "shipment-3",
        storeName: "Bookstore",
      },
    });
    const { service } = buildService({
      reads: { historySummary: vi.fn().mockResolvedValue(emptyHistoryCounts()), latestReceipt },
    });

    const summary = await service.historySummary(USER);

    expect(summary.latestReceipt?.deliveryService).toEqual({
      id: "service-1",
      name: "Nova Poshta",
    });
    expect(summary.latestReceipt?.shipmentId).toBe("shipment-3");
  });
});

describe("DeliveryReadService.historyOutcome", () => {
  it("leaves the unread block out entirely when nothing has been received", async () => {
    const { service } = buildService({});

    const outcome = await service.historyOutcome({ userId: USER });

    expect(outcome).toEqual({ seriesInsights: [], unreadReceived: null });
  });

  it("reports the unread received books with their queue members and previews", async () => {
    const receivedUnreadPreviews = vi
      .fn()
      .mockResolvedValue([
        { coverMedia: null, firstAuthorName: "Adams", id: "book-a", title: "Alpha" },
      ]);
    const { service } = buildService({
      outcome: {
        hasReceivedBooks: vi.fn().mockResolvedValue(true),
        receivedUnreadCounts: vi.fn().mockResolvedValue({ booksCount: 18, inQueueCount: 4 }),
        receivedUnreadPreviews,
      },
    });

    const outcome = await service.historyOutcome({ userId: USER });

    expect(receivedUnreadPreviews).toHaveBeenCalledWith({ limit: 3, userId: USER });
    expect(outcome.unreadReceived).toEqual({
      bookPreviews: [{ authorName: "Adams", cover: null, id: "book-a", title: "Alpha" }],
      booksCount: 18,
      inQueueCount: 4,
    });
  });

  it("skips the preview query when every received book has been picked up", async () => {
    const receivedUnreadPreviews = vi.fn().mockResolvedValue([]);
    const { service } = buildService({
      outcome: {
        hasReceivedBooks: vi.fn().mockResolvedValue(true),
        receivedUnreadCounts: vi.fn().mockResolvedValue({ booksCount: 0, inQueueCount: 0 }),
        receivedUnreadPreviews,
      },
    });

    const outcome = await service.historyOutcome({ userId: USER });

    expect(receivedUnreadPreviews).not.toHaveBeenCalled();
    expect(outcome.unreadReceived).toEqual({
      bookPreviews: [],
      booksCount: 0,
      inQueueCount: 0,
    });
  });
});

describe("DeliveryReadService.inTransitSummary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T09:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands the repository the bounds and maps the counts onto the view", async () => {
    const { reads, service } = buildService({
      reads: {
        inTransitSummary: vi.fn().mockResolvedValue({
          activeBooksCount: 5,
          activeOrdersCount: 2,
          activeShipmentsCount: 3,
          arrivingSoonCount: 2,
          awaitingDispatchOrdersCount: 0,
          bookTotals: [{ count: 2, currency: "UAH", total: 100 }],
          delayedCount: 1,
          delayedShipmentsCount: 1,
          earliestAwaitingOrderDate: null,
          earliestDelayedDate: "2026-08-10",
          expectedThisWeekCount: 2,
          inTransitCount: 3,
          nearestPickupUntil: null,
          nextExpectedDelivery: "2026-08-20",
          nextExpectedThisWeek: "2026-08-18",
          orderedCount: 1,
          orderTotals: [{ count: 2, currency: "UAH", total: 500 }],
          pickupExpiredCount: 0,
          pickupExpiringCount: 0,
          readyForPickupCount: 1,
          splitOrdersCount: 1,
          unassignedBooksCount: 0,
          unassignedOrderId: null,
          unassignedOrdersCount: 0,
          uniqueStoresCount: 2,
          withoutExpectedDateCount: 0,
          withoutExpectedDateShipmentsCount: 0,
          withoutPriceCount: 1,
          withoutTrackingCount: 1,
          withoutTrackingShipmentsCount: 1,
        }),
      },
    });

    const summary = await service.inTransitSummary({ userId: USER });

    expect(vi.mocked(reads.inTransitSummary).mock.calls[0]?.[0].userId).toBe(USER);
    expect(summary.attention).toEqual([
      { count: 1, maxDelayDays: 8, reason: "delayed" },
      { count: 1, reason: "without_tracking" },
    ]);
    expect(summary.activeBooksCount).toBe(5);
    expect(summary.activeOrdersCount).toBe(2);
    expect(summary.activeShipmentsCount).toBe(3);
    expect(summary.activeBooksTotalByCurrency).toEqual([{ currency: "UAH", total: 100 }]);
    expect(summary.activeOrdersTotalByCurrency).toEqual([{ currency: "UAH", total: 500 }]);
    expect(summary.activeOrdersAverageByCurrency).toEqual([{ average: 250, currency: "UAH" }]);
    expect({
      nextExpectedThisWeek: summary.nextExpectedThisWeek,
      splitOrdersCount: summary.splitOrdersCount,
    }).toEqual({ nextExpectedThisWeek: "2026-08-18", splitOrdersCount: 1 });
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
