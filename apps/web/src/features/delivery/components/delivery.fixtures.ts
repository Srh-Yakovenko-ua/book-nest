import type { StatusEntry } from "@/lib/book-status";

import type {
  DeliveryOrderBookModel,
  DeliveryOrderCardModel,
  DeliveryShipmentGroupModel,
} from "../model/order-card-model";

const badges = {
  arrivingSoon: {
    icon: "clock",
    label: "Очікується скоро",
    tone: "info",
    value: "arriving_soon",
  },
  delayed: {
    icon: "alert-triangle",
    label: "Затримується",
    tone: "danger",
    value: "delayed",
  },
  inTransit: {
    icon: "truck",
    label: "В дорозі",
    tone: "info",
    value: "in_transit",
  },
  ordered: {
    icon: "package",
    label: "Замовлено",
    tone: "neutral",
    value: "ordered",
  },
  readyForPickup: {
    icon: "store",
    label: "Готова до отримання",
    tone: "accent",
    value: "ready_for_pickup",
  },
} as const satisfies Record<string, StatusEntry>;

export function makeDeliveryOrderBookModel(
  overrides: Partial<DeliveryOrderBookModel> = {},
): DeliveryOrderBookModel {
  return {
    authorName: "Донна Тартт",
    bookHref: "/books/1",
    bookId: "book-1",
    id: "item-1",
    priceText: "480 UAH",
    seriesText: null,
    title: "Таємна історія",
    ...overrides,
  };
}

export function makeDeliveryOrderCardModel(
  overrides: Partial<DeliveryOrderCardModel> = {},
): DeliveryOrderCardModel {
  return {
    badge: badges.inTransit,
    booksCount: 1,
    id: "order-1",
    orderDateText: "5 лип. 2026",
    orderNumber: "ORD-10241",
    shipments: [makeDeliveryShipmentGroupModel()],
    storeName: "Yakaboo",
    totalText: "480 UAH",
    ...overrides,
  };
}

export function makeDeliveryShipmentGroupModel(
  overrides: Partial<DeliveryShipmentGroupModel> = {},
): DeliveryShipmentGroupModel {
  return {
    badge: badges.arrivingSoon,
    books: [makeDeliveryOrderBookModel()],
    expectedDateText: "12 лип. 2026",
    id: "shipment-1",
    note: null,
    pickupUntilText: null,
    serviceName: "Нова Пошта",
    trackingHref: "https://tracking.example.com/20450012345678",
    trackingNumber: "20450012345678",
    ...overrides,
  };
}

export const deliveryOrderCards = {
  multipleBooks: makeDeliveryOrderCardModel({
    booksCount: 3,
    id: "order-2",
    orderDateText: "2 лип. 2026",
    orderNumber: "ORD-10298",
    shipments: [
      makeDeliveryShipmentGroupModel({
        badge: badges.inTransit,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Патрік Ротфусс",
            bookHref: "/books/2",
            bookId: "book-2",
            id: "item-2",
            priceText: "610 UAH",
            seriesText: "Хроніка вбивці короля · том 1",
            title: "Імʼя вітру",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Патрік Ротфусс",
            bookHref: "/books/3",
            bookId: "book-3",
            id: "item-3",
            priceText: "640 UAH",
            seriesText: "Хроніка вбивці короля · том 2",
            title: "Страх мудреця",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Марія Матіос",
            bookHref: "/books/7",
            bookId: "book-7",
            id: "item-7",
            priceText: null,
            title: "Солодка Даруся",
          }),
        ],
        expectedDateText: "10 лип. 2026",
        id: "shipment-2",
        trackingHref: "https://tracking.example.com/20450099887766",
        trackingNumber: "20450099887766",
      }),
    ],
    storeName: "Читайлик",
    totalText: "1 250 UAH",
  }),
  multiShipment: makeDeliveryOrderCardModel({
    booksCount: 3,
    id: "order-3",
    orderDateText: "28 черв. 2026",
    orderNumber: "BD-77120",
    shipments: [
      makeDeliveryShipmentGroupModel({
        badge: badges.readyForPickup,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Ерін Морґенштерн",
            bookHref: "/books/4",
            bookId: "book-4",
            id: "item-4",
            priceText: "35 EUR",
            seriesText: "Нічний цирк · том 1",
            title: "Нічний цирк",
          }),
        ],
        expectedDateText: null,
        id: "shipment-3a",
        note: "Відділення №12, тільки до 18:00",
        pickupUntilText: "18 лип. 2026",
        serviceName: "Укрпошта",
        trackingHref: null,
        trackingNumber: "0501234567890",
      }),
      makeDeliveryShipmentGroupModel({
        badge: badges.delayed,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Ніл Ґейман",
            bookHref: "/books/5",
            bookId: "book-5",
            id: "item-5",
            priceText: "22 EUR",
            title: "Американські боги",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Мадлен Міллер",
            bookHref: "/books/6",
            bookId: "book-6",
            id: "item-6",
            priceText: "19 EUR",
            title: "Пісня Ахілла",
          }),
        ],
        expectedDateText: "1 лип. 2026",
        id: "shipment-3b",
        serviceName: "DHL",
        trackingHref: "https://tracking.example.com/DHL-77120",
        trackingNumber: "DHL-77120",
      }),
    ],
    storeName: "Book Depository",
    totalText: "76 EUR",
  }),
  notShipped: makeDeliveryOrderCardModel({
    booksCount: 2,
    id: "order-4",
    orderDateText: "11 лип. 2026",
    orderNumber: null,
    shipments: [
      makeDeliveryShipmentGroupModel({
        badge: badges.ordered,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Оксана Забужко",
            bookHref: "/books/8",
            bookId: "book-8",
            id: "item-8",
            priceText: "390 UAH",
            title: "Музей покинутих секретів",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Софія Андрухович",
            bookHref: "/books/9",
            bookId: "book-9",
            id: "item-9",
            priceText: "310 UAH",
            title: "Амадока",
          }),
        ],
        expectedDateText: null,
        id: null,
        serviceName: null,
        trackingHref: null,
        trackingNumber: null,
      }),
    ],
    storeName: "Книгарня Є",
    totalText: "700 UAH",
  }),
  singleBook: makeDeliveryOrderCardModel(),
} as const satisfies Record<string, DeliveryOrderCardModel>;

export const deliveryOrderCardModels: DeliveryOrderCardModel[] = [
  deliveryOrderCards.singleBook,
  deliveryOrderCards.multipleBooks,
  deliveryOrderCards.multiShipment,
  deliveryOrderCards.notShipped,
];
