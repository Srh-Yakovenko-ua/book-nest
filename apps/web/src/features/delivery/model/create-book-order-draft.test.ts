import { CreateBookOrderInputSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import {
  createEmptyShipment,
  EMPTY_ORDER,
  toCreateBookOrderInput,
} from "./create-book-order-draft";

const BOOK_1 = "11111111-1111-4111-8111-111111111111";
const BOOK_2 = "22222222-2222-4222-8222-222222222222";
const BOOK_3 = "33333333-3333-4333-8333-333333333333";

function makeOrder() {
  return { ...EMPTY_ORDER, storeName: "Yakaboo" };
}

describe("toCreateBookOrderInput", () => {
  it("creates a one-book order without shipments", () => {
    const payload = toCreateBookOrderInput({
      books: [{ bookId: BOOK_1, price: "" }],
      order: makeOrder(),
      shipments: [],
    });

    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
    expect(payload).toEqual({
      currency: "UAH",
      items: [{ bookId: BOOK_1 }],
      storeName: "Yakaboo",
    });
  });

  it("creates a multi-book order without shipments and keeps prices and totals", () => {
    const payload = toCreateBookOrderInput({
      books: [
        { bookId: BOOK_1, price: "320.50" },
        { bookId: BOOK_2, price: "" },
      ],
      order: {
        ...makeOrder(),
        currency: "UAH",
        deliveryPrice: "70",
        totalAmount: "686.25",
      },
      shipments: [],
    });

    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({
      currency: "UAH",
      deliveryPrice: 70,
      items: [{ bookId: BOOK_1, price: 320.5 }, { bookId: BOOK_2 }],
      totalAmount: 686.25,
    });
  });

  it("keeps a manual final total independent from delivery and discount metadata", () => {
    const payload = toCreateBookOrderInput({
      books: [
        { bookId: BOOK_1, price: "" },
        { bookId: BOOK_2, price: "" },
      ],
      order: {
        ...makeOrder(),
        deliveryPrice: "100",
        discount: "200",
        totalAmount: "1800",
      },
      shipments: [],
    });

    expect(payload).toMatchObject({
      deliveryPrice: 100,
      discount: 200,
      items: [{ bookId: BOOK_1 }, { bookId: BOOK_2 }],
      totalAmount: 1800,
    });
    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
  });

  it("derives the final total when every item price is known", () => {
    const payload = toCreateBookOrderInput({
      books: [
        { bookId: BOOK_1, price: "500" },
        { bookId: BOOK_2, price: "600" },
        { bookId: BOOK_3, price: "800" },
      ],
      order: {
        ...makeOrder(),
        deliveryPrice: "100",
        discount: "200",
        totalAmount: "200",
      },
      shipments: [],
    });

    expect(payload.totalAmount).toBe(1800);
    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
  });

  it("creates one shipment containing several ordered books", () => {
    const shipment = {
      ...createEmptyShipment("shipment-1"),
      bookIds: [BOOK_1, BOOK_2],
      deliveryService: "Нова пошта",
      status: "in_transit" as const,
      trackingNumber: "20450000000000",
    };
    const payload = toCreateBookOrderInput({
      books: [
        { bookId: BOOK_1, price: "" },
        { bookId: BOOK_2, price: "" },
      ],
      order: makeOrder(),
      shipments: [shipment],
    });

    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
    expect(payload.shipments).toEqual([
      {
        bookIds: [BOOK_1, BOOK_2],
        deliveryService: "Нова пошта",
        status: "in_transit",
        trackingNumber: "20450000000000",
      },
    ]);
  });

  it("creates two shipments while leaving an ordered book unassigned", () => {
    const payload = toCreateBookOrderInput({
      books: [
        { bookId: BOOK_1, price: "" },
        { bookId: BOOK_2, price: "" },
        { bookId: BOOK_3, price: "" },
      ],
      order: makeOrder(),
      shipments: [
        { ...createEmptyShipment("shipment-1"), bookIds: [BOOK_1] },
        { ...createEmptyShipment("shipment-2"), bookIds: [BOOK_2] },
      ],
    });

    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
    expect(payload.shipments?.flatMap(({ bookIds }) => bookIds)).toEqual([BOOK_1, BOOK_2]);
    expect(payload.items.map(({ bookId }) => bookId)).toContain(BOOK_3);
  });

  it("relies on the shared schema to reject duplicate shipment assignments", () => {
    const payload = toCreateBookOrderInput({
      books: [
        { bookId: BOOK_1, price: "" },
        { bookId: BOOK_2, price: "" },
      ],
      order: makeOrder(),
      shipments: [
        { ...createEmptyShipment("shipment-1"), bookIds: [BOOK_1] },
        { ...createEmptyShipment("shipment-2"), bookIds: [BOOK_1] },
      ],
    });

    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(false);
  });
});
