import type {
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  InTransitSummaryView,
  PaginatedBookOrderItemRows,
} from "@app/shared";

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

export function makeDeliveryInTransitPage(
  items: BookOrderItemRowView[],
  overrides: Partial<PaginatedBookOrderItemRows> = {},
): PaginatedBookOrderItemRows {
  return {
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 20,
    totalCount: items.length,
    ...overrides,
  };
}

export function makeDeliveryInTransitSummary(
  overrides: Partial<InTransitSummaryView> = {},
): InTransitSummaryView {
  return {
    activeBooksCount: 0,
    activeBooksTotalByCurrency: [],
    activeOrdersAverageByCurrency: [],
    activeOrdersCount: 0,
    activeOrdersTotalByCurrency: [],
    activeShipmentsCount: 0,
    arrivingSoonCount: 0,
    attention: [],
    delayedCount: 0,
    expectedThisWeekCount: 0,
    inTransitCount: 0,
    nextExpectedDelivery: null,
    nextExpectedThisWeek: null,
    nextShipment: null,
    orderedCount: 0,
    readyForPickupCount: 0,
    splitOrdersCount: 0,
    uniqueStoresCount: 0,
    withoutExpectedDateCount: 0,
    withoutPriceCount: 0,
    withoutTrackingCount: 0,
    ...overrides,
  };
}

export function makeDeliveryItemRow(
  overrides: Partial<BookOrderItemRowView> = {},
): BookOrderItemRowView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Донна Тартт",
      genres: [],
      id: "book-1",
      originalTitle: null,
      ownershipStatus: "in_transit",
      publisher: null,
      readingStatus: "not_started",
      series: null,
      tags: [],
      title: "Таємна історія",
    },
    cancelledAt: null,
    cancelReason: null,
    id: "item-1",
    order: {
      currency: "UAH",
      deliveryPrice: null,
      derivedStatus: "active",
      discount: null,
      effectiveTotalAmount: 480,
      id: "order-1",
      isFree: false,
      itemsCount: 1,
      orderDate: "2026-07-05",
      orderNumber: "ORD-10241",
      pricedItemsCount: 1,
      storeName: "Yakaboo",
      totalAmount: 480,
    },
    price: 480,
    receivedAt: null,
    shipment: makeDeliveryItemRowShipment(),
    uiStatus: null,
    ...overrides,
  };
}

export function makeDeliveryItemRowShipment(
  overrides: Partial<BookOrderItemRowShipmentView> = {},
): BookOrderItemRowShipmentView {
  return {
    activeItemsCount: 1,
    cancelledAt: null,
    cancelReason: null,
    deliveryService: { id: "service-1", name: "Нова Пошта" },
    expectedDeliveryDate: "2026-07-12",
    id: "shipment-1",
    note: null,
    pickupUntil: null,
    receivedAt: null,
    status: "in_transit",
    trackingNumber: "20450012345678",
    trackingUrl: "https://tracking.example.com/20450012345678",
    ...overrides,
  };
}

export function makeDeliveryOrderBookModel(
  overrides: Partial<DeliveryOrderBookModel> = {},
): DeliveryOrderBookModel {
  return {
    authorName: "Донна Тартт",
    bookHref: "/books/1",
    bookId: "book-1",
    currency: "UAH",
    id: "item-1",
    price: 480,
    priceText: "480 UAH",
    resetsOrderTotal: false,
    series: null,
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
    isFree: false,
    orderDate: "2026-07-05",
    orderDateText: "5 лип. 2026",
    orderNumber: "ORD-10241",
    shipments: [makeDeliveryShipmentGroupModel()],
    storeName: "Yakaboo",
    totalText: "545 UAH",
    ...overrides,
  };
}

export function makeDeliveryShipmentGroupModel(
  overrides: Partial<DeliveryShipmentGroupModel> = {},
): DeliveryShipmentGroupModel {
  return {
    activeItemsCount: 1,
    badge: badges.arrivingSoon,
    books: [makeDeliveryOrderBookModel()],
    expectedDate: "2026-07-12",
    expectedDateText: "12 лип. 2026",
    id: "shipment-1",
    note: null,
    pickupUntil: null,
    pickupUntilText: null,
    serviceName: "Нова Пошта",
    status: "in_transit",
    trackingHref: "https://tracking.example.com/20450012345678",
    trackingNumber: "20450012345678",
    trackingUrl: "https://tracking.example.com/20450012345678",
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
        activeItemsCount: 3,
        badge: badges.inTransit,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Патрік Ротфусс",
            bookHref: "/books/2",
            bookId: "book-2",
            id: "item-2",
            price: 610,
            priceText: "610 UAH",
            series: {
              href: "/series/kingkiller-chronicle",
              name: "Хроніка вбивці короля",
              positionLabel: "1 з 2",
            },
            title: "Імʼя вітру",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Патрік Ротфусс",
            bookHref: "/books/3",
            bookId: "book-3",
            id: "item-3",
            price: 640,
            priceText: "640 UAH",
            series: {
              href: "/series/kingkiller-chronicle",
              name: "Хроніка вбивці короля",
              positionLabel: "2 з 2",
            },
            title: "Страх мудреця",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Марія Матіос",
            bookHref: "/books/7",
            bookId: "book-7",
            id: "item-7",
            price: null,
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
            currency: "EUR",
            id: "item-4",
            price: 35,
            priceText: "35 EUR",
            series: {
              href: "/series/night-circus",
              name: "Нічний цирк",
              positionLabel: "1 з 1",
            },
            title: "Нічний цирк",
          }),
        ],
        expectedDateText: null,
        id: "shipment-3a",
        note: "Відділення №12, тільки до 18:00",
        pickupUntil: "2026-07-18",
        pickupUntilText: "18 лип. 2026",
        serviceName: "Укрпошта",
        status: "ready_for_pickup",
        trackingHref: null,
        trackingNumber: "0501234567890",
      }),
      makeDeliveryShipmentGroupModel({
        activeItemsCount: 2,
        badge: badges.delayed,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Ніл Ґейман",
            bookHref: "/books/5",
            bookId: "book-5",
            currency: "EUR",
            id: "item-5",
            price: 22,
            priceText: "22 EUR",
            title: "Американські боги",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Мадлен Міллер",
            bookHref: "/books/6",
            bookId: "book-6",
            currency: "EUR",
            id: "item-6",
            price: 19,
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
        activeItemsCount: 0,
        badge: badges.ordered,
        books: [
          makeDeliveryOrderBookModel({
            authorName: "Оксана Забужко",
            bookHref: "/books/8",
            bookId: "book-8",
            id: "item-8",
            price: 390,
            priceText: "390 UAH",
            title: "Музей покинутих секретів",
          }),
          makeDeliveryOrderBookModel({
            authorName: "Софія Андрухович",
            bookHref: "/books/9",
            bookId: "book-9",
            id: "item-9",
            price: 310,
            priceText: "310 UAH",
            title: "Амадока",
          }),
        ],
        expectedDateText: null,
        id: null,
        serviceName: null,
        status: null,
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
