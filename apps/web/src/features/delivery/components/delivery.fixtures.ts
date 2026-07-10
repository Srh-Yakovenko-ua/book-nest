import type { StatusEntry } from "@/lib/book-status";

import type { DeliveryCardModel } from "../model/delivery-card-model";

const delayedBadge: StatusEntry = {
  icon: "alert-triangle",
  label: "Затримується",
  tone: "danger",
  value: "delayed",
};

const arrivingSoonBadge: StatusEntry = {
  icon: "clock",
  label: "Очікується скоро",
  tone: "info",
  value: "arriving_soon",
};

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

const noDateBadge: StatusEntry = {
  icon: "circle-slash",
  label: "Без дати доставки",
  tone: "neutral",
  value: "no_delivery_date",
};

export function makeDeliveryCardModel(
  overrides: Partial<DeliveryCardModel> = {},
): DeliveryCardModel {
  return {
    authorName: "Донна Тартт",
    badge: arrivingSoonBadge,
    bookHref: "/books/1",
    bookId: "1",
    deliveryId: "d1",
    deliveryService: "Нова Пошта",
    expectedDateText: "12 лип. 2026",
    id: "1",
    orderDateText: "5 лип. 2026",
    orderNumber: "ORD-10241",
    priceText: "480 UAH",
    seriesText: null,
    storeName: "Yakaboo",
    title: "Таємна історія",
    trackingHref: "https://tracking.example.com/ORD-10241",
    trackingNumber: "20450012345678",
    ...overrides,
  };
}

export const deliveryCardModels: DeliveryCardModel[] = [
  makeDeliveryCardModel({
    badge: delayedBadge,
    bookId: "1",
    expectedDateText: "1 лип. 2026",
    id: "1",
    title: "Таємна історія",
  }),
  makeDeliveryCardModel({
    authorName: "Ерін Морґенштерн",
    badge: arrivingSoonBadge,
    bookId: "2",
    id: "2",
    priceText: "35 EUR",
    seriesText: "Нічний цирк · том 1",
    storeName: "Book Depository",
    title: "Нічний цирк",
    trackingHref: null,
    trackingNumber: null,
  }),
  makeDeliveryCardModel({
    authorName: "Патрік Ротфусс",
    badge: orderedBadge,
    bookId: "3",
    deliveryService: null,
    expectedDateText: null,
    id: "3",
    orderNumber: null,
    priceText: null,
    storeName: "Читайлик",
    title: "Імʼя вітру",
    trackingHref: null,
    trackingNumber: null,
  }),
  makeDeliveryCardModel({
    authorName: "Ніл Ґейман",
    badge: inTransitBadge,
    bookId: "4",
    id: "4",
    priceText: "520 UAH",
    title: "Американські боги",
  }),
  makeDeliveryCardModel({
    authorName: "Мадлен Міллер",
    badge: noDateBadge,
    bookId: "5",
    expectedDateText: null,
    id: "5",
    title: "Пісня Ахілла",
  }),
];
