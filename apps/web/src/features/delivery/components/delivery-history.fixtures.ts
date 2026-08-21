import type { BookOrderStatisticsView } from "@app/shared";

import type { StatusEntry } from "@/lib/book-status";

import type {
  HistoryBookModel,
  HistoryOrderCardModel,
  HistoryShipmentGroupModel,
} from "../model/history-order-card-model";

const receivedBadge: StatusEntry = {
  icon: "check-circle",
  label: "Отримано",
  tone: "success",
  value: "received",
};

const cancelledBadge: StatusEntry = {
  icon: "x-circle",
  label: "Скасовано",
  tone: "neutral",
  value: "cancelled",
};

export function makeHistoryBook(overrides: Partial<HistoryBookModel> = {}): HistoryBookModel {
  return {
    authorName: "Донна Тартт",
    bookHref: "/books/1",
    cancelReason: null,
    id: "item-1",
    priceText: "480 UAH",
    series: null,
    terminalText: null,
    title: "Таємна історія",
    ...overrides,
  };
}

export function makeHistoryCardModel(
  overrides: Partial<HistoryOrderCardModel> = {},
): HistoryOrderCardModel {
  return {
    booksCount: 1,
    id: "order-1",
    note: null,
    orderDateText: "5 лип. 2026",
    orderNumber: "ORD-10241",
    revealsSearchMatch: false,
    shipments: [makeHistoryShipmentGroup()],
    storeName: "Yakaboo",
    totalText: "480 UAH",
    ...overrides,
  };
}

export function makeHistoryShipmentGroup(
  overrides: Partial<HistoryShipmentGroupModel> = {},
): HistoryShipmentGroupModel {
  return {
    badge: receivedBadge,
    books: [makeHistoryBook()],
    cancelReason: null,
    expectedText: null,
    id: "shipment-1",
    note: null,
    serviceName: "Нова Пошта",
    terminalText: "Отримано 19 серп. 2026",
    trackingHref: "https://tracking.example.com/20450012345678",
    trackingNumber: "20450012345678",
    ...overrides,
  };
}

export const historyCardModels: HistoryOrderCardModel[] = [
  makeHistoryCardModel(),
  makeHistoryCardModel({
    booksCount: 3,
    id: "order-2",
    orderNumber: "ORD-10255",
    shipments: [
      makeHistoryShipmentGroup({
        books: [
          makeHistoryBook({ id: "item-2", priceText: "35 EUR", title: "Нічний цирк" }),
          makeHistoryBook({
            authorName: "Ерін Морґенштерн",
            id: "item-3",
            priceText: "38 EUR",
            series: { href: "/series/1", name: "Нічний цирк", positionLabel: "1 з 2" },
            title: "Зорепад",
          }),
        ],
        id: "shipment-2",
        terminalText: "Отримано 12 серп. 2026",
      }),
      makeHistoryShipmentGroup({
        books: [makeHistoryBook({ id: "item-4", priceText: "42 EUR", title: "Тіні минулого" })],
        expectedText: "Очікувалось 14 серп. 2026",
        id: "shipment-3",
        note: "Забрати у відділенні до кінця тижня.",
        terminalText: "Отримано 18 серп. 2026",
        trackingHref: null,
        trackingNumber: null,
      }),
    ],
    storeName: "Book Depository",
    totalText: "115 EUR",
  }),
  makeHistoryCardModel({
    booksCount: 2,
    id: "order-3",
    orderNumber: null,
    shipments: [
      makeHistoryShipmentGroup({
        badge: cancelledBadge,
        books: [
          makeHistoryBook({
            authorName: "Патрік Ротфусс",
            id: "item-5",
            priceText: null,
            title: "Імʼя вітру",
          }),
        ],
        cancelReason: "Магазин скасував замовлення — книги немає в наявності.",
        id: "shipment-4",
        terminalText: "Скасовано 10 лип. 2026",
        trackingHref: null,
        trackingNumber: null,
      }),
      makeHistoryShipmentGroup({
        badge: null,
        books: [
          makeHistoryBook({
            cancelReason: "Знайшла дешевше в іншому магазині.",
            id: "item-6",
            priceText: null,
            terminalText: "Скасовано 2 лип. 2026",
            title: "Маленьке життя",
          }),
        ],
        id: null,
        serviceName: null,
        terminalText: null,
        trackingHref: null,
        trackingNumber: null,
      }),
    ],
    storeName: "Читайлик",
    totalText: null,
  }),
];

export const statisticsViewFixture: BookOrderStatisticsView = {
  bestValueStoreByCurrency: [
    { averageLandedBookCost: 320, currency: "UAH", eligibleBooksCount: 6, store: "Yakaboo" },
    {
      averageLandedBookCost: 38,
      currency: "EUR",
      eligibleBooksCount: 2,
      store: "Book Depository",
    },
  ],
  byStore: [
    {
      averageBookPriceByCurrency: [{ average: 310, currency: "UAH" }],
      averageBooksPerOrder: 1.5,
      averageLandedBookCostByCurrency: [{ average: 320, currency: "UAH" }],
      averageOrderAmountByCurrency: [{ average: 465, currency: "UAH" }],
      booksCount: 6,
      deliveryTotalByCurrency: [{ currency: "UAH", total: 180 }],
      discountTotalByCurrency: [{ currency: "UAH", total: 60 }],
      landedCoverageByCurrency: [
        {
          countedBooksCount: 6,
          coveragePercent: 100,
          currency: "UAH",
          eligibleBooksCount: 6,
        },
      ],
      landedEligibleBooksCountByCurrency: [{ count: 6, currency: "UAH" }],
      ordersCount: 4,
      store: "Yakaboo",
      totalsByCurrency: [{ currency: "UAH", total: 1860 }],
    },
    {
      averageBookPriceByCurrency: [{ average: 35, currency: "EUR" }],
      averageBooksPerOrder: 1.0,
      averageLandedBookCostByCurrency: [{ average: 38, currency: "EUR" }],
      averageOrderAmountByCurrency: [{ average: 35, currency: "EUR" }],
      booksCount: 2,
      deliveryTotalByCurrency: [{ currency: "EUR", total: 6 }],
      discountTotalByCurrency: [{ currency: "EUR", total: 0 }],
      landedCoverageByCurrency: [
        {
          countedBooksCount: 2,
          coveragePercent: 100,
          currency: "EUR",
          eligibleBooksCount: 2,
        },
      ],
      landedEligibleBooksCountByCurrency: [{ count: 2, currency: "EUR" }],
      ordersCount: 2,
      store: "Book Depository",
      totalsByCurrency: [{ currency: "EUR", total: 70 }],
    },
    {
      averageBookPriceByCurrency: [{ average: 24, currency: "USD" }],
      averageBooksPerOrder: 1.0,
      averageLandedBookCostByCurrency: [{ average: 24, currency: "USD" }],
      averageOrderAmountByCurrency: [{ average: 24, currency: "USD" }],
      booksCount: 1,
      deliveryTotalByCurrency: [{ currency: "USD", total: 0 }],
      discountTotalByCurrency: [{ currency: "USD", total: 0 }],
      landedCoverageByCurrency: [
        {
          countedBooksCount: 1,
          coveragePercent: 100,
          currency: "USD",
          eligibleBooksCount: 1,
        },
      ],
      landedEligibleBooksCountByCurrency: [{ count: 1, currency: "USD" }],
      ordersCount: 1,
      store: "Amazon",
      totalsByCurrency: [{ currency: "USD", total: 24 }],
    },
  ],
  comparison: null,
  costs: [
    {
      currency: "UAH",
      deliveryCostPerBook: 30,
      deliveryShareOfSpendPercent: 9.68,
      deliveryTotal: 180,
      discountShareOfRawSubtotalPercent: 3.13,
      discountTotal: 60,
      ordersWithDeliveryCount: 3,
      ordersWithDiscountCount: 2,
    },
    {
      currency: "EUR",
      deliveryCostPerBook: 3,
      deliveryShareOfSpendPercent: 8.57,
      deliveryTotal: 6,
      discountShareOfRawSubtotalPercent: null,
      discountTotal: 0,
      ordersWithDeliveryCount: 1,
      ordersWithDiscountCount: 0,
    },
  ],
  daily: [
    {
      booksCount: 2,
      date: "2026-06-05",
      ordersCount: 1,
      totalsByCurrency: [{ currency: "UAH", total: 480 }],
    },
    {
      booksCount: 1,
      date: "2026-06-12",
      ordersCount: 1,
      totalsByCurrency: [{ currency: "EUR", total: 35 }],
    },
  ],
  landedCost: [
    {
      averageLandedBookCost: 320,
      countedBooksCount: 6,
      coveragePercent: 100,
      currency: "UAH",
      differenceVsAverageRawBookPrice: 10,
      eligibleBooksCount: 6,
    },
    {
      averageLandedBookCost: 38,
      countedBooksCount: 2,
      coveragePercent: 100,
      currency: "EUR",
      differenceVsAverageRawBookPrice: 3,
      eligibleBooksCount: 2,
    },
  ],
  lifecycle: {
    books: {
      active: 2,
      cancelled: 1,
      partially_received: 0,
      partially_shipped: 0,
      received: 4,
      shipped: 2,
      total: 9,
    },
    comparison: null,
    orders: {
      active: 1,
      cancelled: 1,
      partially_received: 1,
      partially_shipped: 0,
      received: 3,
      shipped: 1,
      total: 7,
    },
  },
  meta: {
    comparisonPeriod: null,
    currentPeriod: { from: "2026-05-01", to: "2026-06-30" },
    isTruncated: false,
    loadedOrdersCount: 7,
    maxOrders: 5000,
  },
  monthly: [
    {
      booksCount: 4,
      month: "2026-05",
      ordersCount: 3,
      totalsByCurrency: [
        { currency: "UAH", total: 940 },
        { currency: "USD", total: 24 },
      ],
    },
    {
      booksCount: 5,
      month: "2026-06",
      ordersCount: 4,
      totalsByCurrency: [
        { currency: "UAH", total: 920 },
        { currency: "EUR", total: 70 },
      ],
    },
  ],
  pulse: [],
  records: {
    bestValueStoreByCurrency: [
      { averageLandedBookCost: 320, currency: "UAH", eligibleBooksCount: 6, store: "Yakaboo" },
    ],
    largestOrderByCurrency: [],
    mostActiveStore: {
      byBooks: { booksCount: 6, ordersCount: 4, store: "Yakaboo" },
      byOrders: { booksCount: 6, ordersCount: 4, store: "Yakaboo" },
    },
    mostBooksInOrder: null,
    recordMonthByCurrency: [
      { booksCount: 4, currency: "UAH", month: "2026-05", ordersCount: 3, total: 940 },
    ],
    scope: {
      isPeriodFiltered: true,
      isTruncated: false,
      period: { from: "2026-05-01", to: "2026-06-30" },
    },
  },
  snapshot: {
    activeBooksCount: 2,
    activeOrdersCount: 2,
    activeShipmentsCount: 2,
    activeTotalsByCurrency: [{ currency: "UAH", total: 900 }],
  },
  summary: {
    activeBooksCount: 2,
    activeShipmentsCount: 2,
    activeTotalsByCurrency: [{ currency: "UAH", total: 900 }],
    averageBookPriceByCurrency: [
      { average: 310, currency: "UAH" },
      { average: 35, currency: "EUR" },
    ],
    averageBooksPerOrder: 1.29,
    averageOrderAmountByCurrency: [
      { average: 465, currency: "UAH" },
      { average: 35, currency: "EUR" },
    ],
    booksCount: 9,
    cancelledOrdersCount: 1,
    cancelledTotalsByCurrency: [{ currency: "UAH", total: 260 }],
    ordersCount: 7,
    receivedBooksCount: 4,
    receivedTotalsByCurrency: [
      { currency: "UAH", total: 960 },
      { currency: "EUR", total: 70 },
    ],
    shipmentsCount: 8,
    totalsByCurrency: [
      { currency: "UAH", total: 1860 },
      { currency: "EUR", total: 70 },
      { currency: "USD", total: 24 },
    ],
  },
  topOrders: [
    {
      booksCount: 2,
      currency: "UAH",
      derivedStatus: "received",
      id: "order-1",
      orderDate: "2026-06-05",
      orderNumber: "ORD-10241",
      storeName: "Yakaboo",
      totalAmount: 480,
    },
    {
      booksCount: 1,
      currency: "EUR",
      derivedStatus: "shipped",
      id: "order-2",
      orderDate: "2026-06-12",
      orderNumber: null,
      storeName: "Book Depository",
      totalAmount: 35,
    },
  ],
  topOrdersByCurrency: [
    {
      currency: "UAH",
      orders: [
        {
          booksCount: 2,
          currency: "UAH",
          derivedStatus: "received",
          id: "order-1",
          orderDate: "2026-06-05",
          orderNumber: "ORD-10241",
          storeName: "Yakaboo",
          totalAmount: 480,
        },
      ],
    },
    {
      currency: "EUR",
      orders: [
        {
          booksCount: 1,
          currency: "EUR",
          derivedStatus: "shipped",
          id: "order-2",
          orderDate: "2026-06-12",
          orderNumber: null,
          storeName: "Book Depository",
          totalAmount: 35,
        },
      ],
    },
  ],
};
