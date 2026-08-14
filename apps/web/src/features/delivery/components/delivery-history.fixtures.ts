import type { BookOrderStatisticsView } from "@app/shared";

import type { StatusEntry } from "@/lib/book-status";

import type { DeliveryHistoryCardModel } from "../model/history-card-model";

const orderedBadge: StatusEntry = {
  icon: "package",
  label: "Замовлено",
  tone: "neutral",
  value: "ordered",
};

const inTransitBadge: StatusEntry = {
  icon: "truck",
  label: "В дорозі",
  tone: "info",
  value: "in_transit",
};

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

export function makeHistoryCardModel(
  overrides: Partial<DeliveryHistoryCardModel> = {},
): DeliveryHistoryCardModel {
  return {
    badge: receivedBadge,
    book: {
      authorName: "Донна Тартт",
      href: "/books/1",
      seriesText: null,
      title: "Таємна історія",
    },
    bookId: "1",
    cancelledDateText: null,
    deliveryId: "d1",
    deliveryService: "Нова Пошта",
    expectedDateText: "12 лип. 2026",
    id: "1",
    isActive: false,
    orderDateText: "5 лип. 2026",
    orderNumber: "ORD-10241",
    priceText: "480 UAH",
    receivedDateText: "14 лип. 2026",
    storeName: "Yakaboo",
    trackingHref: "https://tracking.example.com/ORD-10241",
    trackingNumber: "20450012345678",
    ...overrides,
  };
}

export const historyCardModels: DeliveryHistoryCardModel[] = [
  makeHistoryCardModel({
    badge: inTransitBadge,
    bookId: "1",
    id: "1",
    isActive: true,
    receivedDateText: null,
  }),
  makeHistoryCardModel({
    badge: receivedBadge,
    book: {
      authorName: "Ерін Морґенштерн",
      href: "/books/2",
      seriesText: "Нічний цирк · том 1",
      title: "Нічний цирк",
    },
    bookId: "2",
    id: "2",
    priceText: "35 EUR",
    storeName: "Book Depository",
    trackingHref: null,
    trackingNumber: null,
  }),
  makeHistoryCardModel({
    badge: cancelledBadge,
    book: {
      authorName: "Патрік Ротфусс",
      href: "/books/3",
      seriesText: null,
      title: "Імʼя вітру",
    },
    bookId: "3",
    cancelledDateText: "10 лип. 2026",
    expectedDateText: null,
    id: "3",
    priceText: null,
    receivedDateText: null,
    storeName: "Читайлик",
    trackingHref: null,
    trackingNumber: null,
  }),
  makeHistoryCardModel({
    badge: orderedBadge,
    book: null,
    bookId: "4",
    id: "4",
    isActive: false,
    priceText: "520 UAH",
    receivedDateText: null,
    storeName: "Yakaboo",
    trackingHref: null,
    trackingNumber: null,
  }),
];

export const statisticsViewFixture: BookOrderStatisticsView = {
  byStore: [
    {
      averageBookPriceByCurrency: [{ average: 310, currency: "UAH" }],
      averageOrderAmountByCurrency: [{ average: 465, currency: "UAH" }],
      booksCount: 6,
      ordersCount: 4,
      store: "Yakaboo",
      totalsByCurrency: [{ currency: "UAH", total: 1860 }],
    },
    {
      averageBookPriceByCurrency: [{ average: 35, currency: "EUR" }],
      averageOrderAmountByCurrency: [{ average: 35, currency: "EUR" }],
      booksCount: 2,
      ordersCount: 2,
      store: "Book Depository",
      totalsByCurrency: [{ currency: "EUR", total: 70 }],
    },
    {
      averageBookPriceByCurrency: [{ average: 24, currency: "USD" }],
      averageOrderAmountByCurrency: [{ average: 24, currency: "USD" }],
      booksCount: 1,
      ordersCount: 1,
      store: "Amazon",
      totalsByCurrency: [{ currency: "USD", total: 24 }],
    },
  ],
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
  summary: {
    activeBooksCount: 2,
    activeShipmentsCount: 2,
    activeTotalsByCurrency: [{ currency: "UAH", total: 900 }],
    averageBookPriceByCurrency: [
      { average: 310, currency: "UAH" },
      { average: 35, currency: "EUR" },
    ],
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
};
