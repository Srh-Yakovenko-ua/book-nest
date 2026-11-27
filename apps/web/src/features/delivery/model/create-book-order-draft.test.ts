import { CreateBookOrderInputSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

import type {
  CreateBookOrderDraft,
  CreateBookOrderDraftAction,
  OrderBookDraft,
  OrderDraft,
  ShipmentDraft,
} from "./create-book-order-draft";

import {
  createBookOrderDraftReducer,
  createEmptyShipment,
  EMPTY_CREATE_BOOK_ORDER_DRAFT,
  EMPTY_ORDER,
  hasCompleteItemPrices,
  hasCreateBookOrderInput,
  optionalNumber,
  shipmentLayout,
  toCreateBookOrderInput,
  unassignedBooks,
} from "./create-book-order-draft";

const BOOK_1 = "11111111-1111-4111-8111-111111111111";
const BOOK_2 = "22222222-2222-4222-8222-222222222222";
const BOOK_3 = "33333333-3333-4333-8333-333333333333";
const SHIPMENT_1 = "44444444-4444-4444-8444-444444444444";
const SHIPMENT_2 = "55555555-5555-4555-8555-555555555555";
const SHIPMENT_3 = "66666666-6666-4666-8666-666666666666";

function bookPrices({ books }: CreateBookOrderDraft) {
  return books.map(({ book, price }) => ({ id: book.id, price }));
}

function makeDraft(overrides: Partial<CreateBookOrderDraft> = {}): CreateBookOrderDraft {
  return { ...EMPTY_CREATE_BOOK_ORDER_DRAFT, ...overrides };
}

function makeNewInTransitShipment(id: string, bookIds: string[]): ShipmentDraft {
  return {
    bookIds,
    deliveryService: "",
    expectedDeliveryDate: "",
    id,
    note: "",
    pickupUntil: "",
    status: "in_transit",
    trackingNumber: "",
    trackingUrl: "",
  };
}

function makeOrder() {
  return { ...EMPTY_ORDER, storeName: "Yakaboo", totalAmount: "480" };
}

function makeOrderBook(id: string, price = ""): OrderBookDraft {
  return { book: makeBookView({ id }), price };
}

function makeShipment(id: string, bookIds: string[]): ShipmentDraft {
  return { ...createEmptyShipment(id), bookIds };
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
      isFree: false,
      items: [{ bookId: BOOK_1 }],
      storeName: "Yakaboo",
      totalAmount: 480,
    });
  });

  it("sends a free order with no amounts at all", () => {
    const payload = toCreateBookOrderInput({
      books: [{ bookId: BOOK_1, price: "320" }],
      order: { ...makeOrder(), deliveryPrice: "70", isFree: true, totalAmount: "480" },
      shipments: [],
    });

    expect(CreateBookOrderInputSchema.safeParse(payload).success).toBe(true);
    expect(payload).toEqual({
      currency: "UAH",
      isFree: true,
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

describe("createBookOrderDraftReducer", () => {
  describe("bookPriceChanged", () => {
    it.each([
      { name: "an emptied price", price: "" },
      { name: "a price of only spaces", price: "   " },
    ])("clears the final total when a complete breakdown gets $name", ({ price }) => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2, "200")],
        order: { ...EMPTY_ORDER, totalAmount: "480" },
      });

      const next = createBookOrderDraftReducer(draft, {
        bookId: BOOK_1,
        price,
        type: "bookPriceChanged",
      });

      expect(bookPrices(next)).toEqual([
        { id: BOOK_1, price },
        { id: BOOK_2, price: "200" },
      ]);
      expect(next.order.totalAmount).toBe("");
    });

    it.each([
      {
        bookId: BOOK_1,
        firstPrice: "100",
        name: "a complete breakdown stays complete",
        price: "150",
        secondPrice: "200",
      },
      {
        bookId: BOOK_1,
        firstPrice: "100",
        name: "an incomplete breakdown stays incomplete",
        price: "",
        secondPrice: "",
      },
      {
        bookId: BOOK_2,
        firstPrice: "100",
        name: "an incomplete breakdown becomes complete",
        price: "200",
        secondPrice: "",
      },
    ])("keeps the final total when $name", ({ bookId, firstPrice, price, secondPrice }) => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, firstPrice), makeOrderBook(BOOK_2, secondPrice)],
        order: { ...EMPTY_ORDER, totalAmount: "480" },
      });

      const next = createBookOrderDraftReducer(draft, { bookId, price, type: "bookPriceChanged" });

      expect(next.books.find(({ book }) => book.id === bookId)?.price).toBe(price);
      expect(next.order.totalAmount).toBe("480");
    });

    it("applies two price changes dispatched in a row without losing the first", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        financialMode: "items",
      });
      const actions: CreateBookOrderDraftAction[] = [
        { bookId: BOOK_1, price: "100", type: "bookPriceChanged" },
        { bookId: BOOK_2, price: "200", type: "bookPriceChanged" },
      ];

      const next = actions.reduce(createBookOrderDraftReducer, draft);

      expect(bookPrices(next)).toEqual([
        { id: BOOK_1, price: "100" },
        { id: BOOK_2, price: "200" },
      ]);
    });

    it("clears the total when one change completes the breakdown and the next one breaks it", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2)],
        financialMode: "items",
        order: { ...EMPTY_ORDER, totalAmount: "480" },
      });
      const actions: CreateBookOrderDraftAction[] = [
        { bookId: BOOK_2, price: "200", type: "bookPriceChanged" },
        { bookId: BOOK_1, price: "", type: "bookPriceChanged" },
      ];

      const next = actions.reduce(createBookOrderDraftReducer, draft);

      expect(bookPrices(next)).toEqual([
        { id: BOOK_1, price: "" },
        { id: BOOK_2, price: "200" },
      ]);
      expect(next.order.totalAmount).toBe("");
    });
  });

  describe("bookRemoved", () => {
    it("removes the book from the order and from the shipment that carried it", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2), makeOrderBook(BOOK_3)],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2, BOOK_3])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { bookId: BOOK_2, type: "bookRemoved" });

      expect(next.books.map(({ book }) => book.id)).toEqual([BOOK_1, BOOK_3]);
      expect(next.shipments).toEqual([
        makeShipment(SHIPMENT_1, [BOOK_1]),
        makeShipment(SHIPMENT_2, [BOOK_3]),
      ]);
    });

    it("clears the total when the last book of a complete breakdown is removed", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100")],
        order: { ...EMPTY_ORDER, totalAmount: "480" },
      });

      const next = createBookOrderDraftReducer(draft, { bookId: BOOK_1, type: "bookRemoved" });

      expect(next.books).toEqual([]);
      expect(next.order.totalAmount).toBe("");
    });

    it("keeps the total when removing the only unpriced book completes the breakdown", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2)],
        order: { ...EMPTY_ORDER, totalAmount: "480" },
      });

      const next = createBookOrderDraftReducer(draft, { bookId: BOOK_2, type: "bookRemoved" });

      expect(bookPrices(next)).toEqual([{ id: BOOK_1, price: "100" }]);
      expect(next.order.totalAmount).toBe("480");
    });
  });

  describe("book picker", () => {
    it("bookPickerOpened starts the picker from the books already in the order", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2)],
        pickerSelection: [makeBookView({ id: BOOK_3 })],
      });

      const next = createBookOrderDraftReducer(draft, { type: "bookPickerOpened" });

      expect(next.pickerSelection.map(({ id }) => id)).toEqual([BOOK_1, BOOK_2]);
    });

    it("pickerSelectionChanged replaces the selection without touching the ordered books", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100")],
        pickerSelection: [makeBookView({ id: BOOK_1 })],
      });

      const next = createBookOrderDraftReducer(draft, {
        books: [makeBookView({ id: BOOK_2 }), makeBookView({ id: BOOK_3 })],
        type: "pickerSelectionChanged",
      });

      expect(next.pickerSelection.map(({ id }) => id)).toEqual([BOOK_2, BOOK_3]);
      expect(bookPrices(next)).toEqual([{ id: BOOK_1, price: "100" }]);
    });

    it("pickerSelectionApplied keeps the prices of books that stay and leaves new books unpriced", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2, "200")],
        pickerSelection: [makeBookView({ id: BOOK_2 }), makeBookView({ id: BOOK_3 })],
      });

      const next = createBookOrderDraftReducer(draft, { type: "pickerSelectionApplied" });

      expect(bookPrices(next)).toEqual([
        { id: BOOK_2, price: "200" },
        { id: BOOK_3, price: "" },
      ]);
    });

    it("pickerSelectionApplied hands the new selection to the single shipment of a simple layout", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1)],
        pickerSelection: [makeBookView({ id: BOOK_1 }), makeBookView({ id: BOOK_2 })],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "pickerSelectionApplied" });

      expect(next.shipments).toEqual([makeShipment(SHIPMENT_1, [BOOK_1, BOOK_2])]);
    });

    it("pickerSelectionApplied leaves distributed shipments for the user to reassign", () => {
      const shipments = [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2])];
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        pickerSelection: [
          makeBookView({ id: BOOK_1 }),
          makeBookView({ id: BOOK_2 }),
          makeBookView({ id: BOOK_3 }),
        ],
        shipments,
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "pickerSelectionApplied" });

      expect(next.shipments).toEqual(shipments);
    });

    it("pickerSelectionApplied drops a deselected book from every distributed shipment", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2), makeOrderBook(BOOK_3)],
        pickerSelection: [makeBookView({ id: BOOK_1 }), makeBookView({ id: BOOK_3 })],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1, BOOK_2]), makeShipment(SHIPMENT_2, [BOOK_3])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "pickerSelectionApplied" });

      expect(next.shipments).toEqual([
        makeShipment(SHIPMENT_1, [BOOK_1]),
        makeShipment(SHIPMENT_2, [BOOK_3]),
      ]);
    });

    it("pickerSelectionApplied keeps the shipment of a book that stays selected and leaves a new one unassigned", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        pickerSelection: [makeBookView({ id: BOOK_2 }), makeBookView({ id: BOOK_3 })],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "pickerSelectionApplied" });

      expect(next.shipments).toEqual([
        makeShipment(SHIPMENT_1, []),
        makeShipment(SHIPMENT_2, [BOOK_2]),
      ]);
      expect(unassignedBooks(next).map(({ book }) => book.id)).toEqual([BOOK_3]);
    });

    it("pickerSelectionApplied clears a deselected book from the single shipment of a distribution layout", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        pickerSelection: [makeBookView({ id: BOOK_2 })],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1])],
        shipping: "yes",
      });
      expect(shipmentLayout(draft)).toBe("distribution");

      const next = createBookOrderDraftReducer(draft, { type: "pickerSelectionApplied" });

      expect(next.shipments).toEqual([makeShipment(SHIPMENT_1, [])]);
    });
  });

  describe("freeChanged", () => {
    it("wipes delivery, discount, total and every item price when the order becomes free", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2, "200")],
        order: {
          ...EMPTY_ORDER,
          deliveryPrice: "70",
          discount: "20",
          storeName: "Yakaboo",
          totalAmount: "350",
        },
      });

      const next = createBookOrderDraftReducer(draft, { isFree: true, type: "freeChanged" });

      expect(next.order).toEqual({ ...EMPTY_ORDER, isFree: true, storeName: "Yakaboo" });
      expect(bookPrices(next)).toEqual([
        { id: BOOK_1, price: "" },
        { id: BOOK_2, price: "" },
      ]);
    });

    it("only flips the flag when the order stops being free", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100")],
        order: { ...EMPTY_ORDER, deliveryPrice: "70", isFree: true, totalAmount: "170" },
      });

      const next = createBookOrderDraftReducer(draft, { isFree: false, type: "freeChanged" });

      expect(next.order).toEqual({
        ...EMPTY_ORDER,
        deliveryPrice: "70",
        isFree: false,
        totalAmount: "170",
      });
      expect(bookPrices(next)).toEqual([{ id: BOOK_1, price: "100" }]);
    });
  });

  describe("financialModeChanged", () => {
    it("drops the manual total when switching to per-item prices", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        financialMode: "total",
        order: { ...EMPTY_ORDER, totalAmount: "480" },
      });

      const next = createBookOrderDraftReducer(draft, {
        mode: "items",
        type: "financialModeChanged",
      });

      expect(next.financialMode).toBe("items");
      expect(next.order.totalAmount).toBe("");
    });

    it("drops the item prices and keeps the total when switching to a single total", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2, "200")],
        financialMode: "items",
        order: { ...EMPTY_ORDER, totalAmount: "300" },
      });

      const next = createBookOrderDraftReducer(draft, {
        mode: "total",
        type: "financialModeChanged",
      });

      expect(next.financialMode).toBe("total");
      expect(bookPrices(next)).toEqual([
        { id: BOOK_1, price: "" },
        { id: BOOK_2, price: "" },
      ]);
      expect(next.order.totalAmount).toBe("300");
    });
  });

  describe("shipping", () => {
    it("shippingEnabled creates one in-transit shipment carrying every ordered book", () => {
      const draft = makeDraft({ books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)] });

      const next = createBookOrderDraftReducer(draft, {
        shipmentId: SHIPMENT_1,
        type: "shippingEnabled",
      });

      expect(next.shipping).toBe("yes");
      expect(next.shipments).toEqual([makeNewInTransitShipment(SHIPMENT_1, [BOOK_1, BOOK_2])]);
    });

    it("shippingEnabled keeps the shipments the draft already has", () => {
      const existing = { ...makeShipment(SHIPMENT_1, [BOOK_1]), trackingNumber: "20450000000000" };
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments: [existing],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        shipmentId: SHIPMENT_2,
        type: "shippingEnabled",
      });

      expect(next.shipments).toEqual([existing]);
    });

    it("shippingDisabled forgets every shipment", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "shippingDisabled" });

      expect(next.shipping).toBe("no");
      expect(next.shipments).toEqual([]);
    });

    it("shippingSplit empties the first shipment, keeps its details and adds a second one", () => {
      const first = {
        ...makeShipment(SHIPMENT_1, [BOOK_1, BOOK_2]),
        deliveryService: "Nova Poshta",
        trackingNumber: "20450000000000",
      };
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments: [first],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        addedShipmentId: SHIPMENT_2,
        fallbackShipmentId: SHIPMENT_3,
        type: "shippingSplit",
      });

      expect(next.shipments).toEqual([
        { ...first, bookIds: [] },
        makeNewInTransitShipment(SHIPMENT_2, []),
      ]);
    });

    it("shippingSplit starts from a fresh first shipment when the draft has none", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        addedShipmentId: SHIPMENT_2,
        fallbackShipmentId: SHIPMENT_3,
        type: "shippingSplit",
      });

      expect(next.shipments).toEqual([
        makeNewInTransitShipment(SHIPMENT_3, []),
        makeNewInTransitShipment(SHIPMENT_2, []),
      ]);
    });
  });

  describe("shipment edits", () => {
    const first = makeShipment(SHIPMENT_1, [BOOK_1]);
    const second = makeShipment(SHIPMENT_2, [BOOK_2]);
    const distributed = makeDraft({
      books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2), makeOrderBook(BOOK_3)],
      shipments: [first, second],
      shipping: "yes",
    });

    it("shipmentAdded appends an empty in-transit shipment after the existing ones", () => {
      const next = createBookOrderDraftReducer(distributed, {
        shipmentId: SHIPMENT_3,
        type: "shipmentAdded",
      });

      expect(next.shipments).toEqual([first, second, makeNewInTransitShipment(SHIPMENT_3, [])]);
    });

    it("shipmentChanged patches only the target shipment", () => {
      const next = createBookOrderDraftReducer(distributed, {
        patch: { status: "ready_for_pickup", trackingNumber: "20450000000000" },
        shipmentId: SHIPMENT_2,
        type: "shipmentChanged",
      });

      expect(next.shipments).toEqual([
        first,
        { ...second, status: "ready_for_pickup", trackingNumber: "20450000000000" },
      ]);
    });

    it("shipmentBookToggled puts an unassigned book into the target shipment only", () => {
      const next = createBookOrderDraftReducer(distributed, {
        bookId: BOOK_3,
        shipmentId: SHIPMENT_2,
        type: "shipmentBookToggled",
      });

      expect(next.shipments).toEqual([first, makeShipment(SHIPMENT_2, [BOOK_2, BOOK_3])]);
    });

    it("shipmentBookToggled takes a carried book off the target shipment", () => {
      const next = createBookOrderDraftReducer(distributed, {
        bookId: BOOK_2,
        shipmentId: SHIPMENT_2,
        type: "shipmentBookToggled",
      });

      expect(next.shipments).toEqual([first, makeShipment(SHIPMENT_2, [])]);
    });

    it("shipmentsMerged hands every ordered book to the first shipment", () => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2), makeOrderBook(BOOK_3)],
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "shipmentsMerged" });

      expect(next.shipments).toEqual([makeShipment(SHIPMENT_1, [BOOK_1, BOOK_2, BOOK_3])]);
    });
  });

  describe("shipment removal", () => {
    it.each([
      {
        name: "the only shipment",
        shipmentId: SHIPMENT_1,
        shipments: [makeShipment(SHIPMENT_1, [])],
      },
      {
        name: "a shipment the draft does not have",
        shipmentId: SHIPMENT_3,
        shipments: [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [])],
      },
    ])("returns the same draft when asked to remove $name", ({ shipmentId, shipments }) => {
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments,
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        shipmentId,
        type: "shipmentRemovalRequested",
      });

      expect(next).toBe(draft);
    });

    it("removes a shipment that carries no books without asking", () => {
      const first = makeShipment(SHIPMENT_1, [BOOK_1]);
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments: [first, makeShipment(SHIPMENT_2, [])],
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        shipmentId: SHIPMENT_2,
        type: "shipmentRemovalRequested",
      });

      expect(next.shipments).toEqual([first]);
      expect(next.shipmentToRemoveId).toBeNull();
    });

    it("asks for confirmation before removing a shipment that carries books", () => {
      const shipments = [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2])];
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments,
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        shipmentId: SHIPMENT_2,
        type: "shipmentRemovalRequested",
      });

      expect(next.shipmentToRemoveId).toBe(SHIPMENT_2);
      expect(next.shipments).toEqual(shipments);
    });

    it("shipmentRemoved drops the confirmed shipment and closes the confirmation", () => {
      const first = makeShipment(SHIPMENT_1, [BOOK_1]);
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments: [first, makeShipment(SHIPMENT_2, [BOOK_2])],
        shipmentToRemoveId: SHIPMENT_2,
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, {
        shipmentId: SHIPMENT_2,
        type: "shipmentRemoved",
      });

      expect(next.shipments).toEqual([first]);
      expect(next.shipmentToRemoveId).toBeNull();
    });

    it("shipmentRemovalCancelled closes the confirmation and keeps every shipment", () => {
      const shipments = [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2])];
      const draft = makeDraft({
        books: [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)],
        shipments,
        shipmentToRemoveId: SHIPMENT_2,
        shipping: "yes",
      });

      const next = createBookOrderDraftReducer(draft, { type: "shipmentRemovalCancelled" });

      expect(next.shipmentToRemoveId).toBeNull();
      expect(next.shipments).toEqual(shipments);
    });
  });

  it("orderFieldChanged updates only the named order field", () => {
    const draft = makeDraft({ order: { ...EMPTY_ORDER, storeName: "Yakaboo" } });

    const next = createBookOrderDraftReducer(draft, {
      field: "currency",
      type: "orderFieldChanged",
      value: "EUR",
    });

    expect(next.order).toEqual({ ...EMPTY_ORDER, currency: "EUR", storeName: "Yakaboo" });
  });

  it("submitAttempted marks the draft as submitted", () => {
    const next = createBookOrderDraftReducer(makeDraft(), { type: "submitAttempted" });

    expect(next.submitAttempted).toBe(true);
  });
});

describe("shipmentLayout", () => {
  const books = [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2)];

  it.each<{
    layout: ReturnType<typeof shipmentLayout>;
    name: string;
    shipments: ShipmentDraft[];
    shipping: CreateBookOrderDraft["shipping"];
  }>([
    {
      layout: "hidden",
      name: "the order is not shipped, so the dialog shows the awaiting notice even over a leftover shipment",
      shipments: [makeShipment(SHIPMENT_1, [BOOK_1, BOOK_2])],
      shipping: "no",
    },
    {
      layout: "hidden",
      name: "the order is shipped but there is no shipment yet to show a form for",
      shipments: [],
      shipping: "yes",
    },
    {
      layout: "simple",
      name: "a single shipment carries every book, so one shipment form without book toggles is enough",
      shipments: [makeShipment(SHIPMENT_1, [BOOK_1, BOOK_2])],
      shipping: "yes",
    },
    {
      layout: "distribution",
      name: "the single shipment leaves a book unassigned, so the dialog must show it and offer a merge",
      shipments: [makeShipment(SHIPMENT_1, [BOOK_1])],
      shipping: "yes",
    },
    {
      layout: "distribution",
      name: "two shipments share the books, so each needs its own book toggles",
      shipments: [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_2])],
      shipping: "yes",
    },
  ])("is $layout when $name", ({ layout, shipments, shipping }) => {
    expect(shipmentLayout({ books, shipments, shipping })).toBe(layout);
  });
});

describe("unassignedBooks", () => {
  it("lists the ordered books that no shipment carries", () => {
    const books = [makeOrderBook(BOOK_1), makeOrderBook(BOOK_2), makeOrderBook(BOOK_3)];
    const shipments = [makeShipment(SHIPMENT_1, [BOOK_1]), makeShipment(SHIPMENT_2, [BOOK_3])];

    expect(unassignedBooks({ books, shipments }).map(({ book }) => book.id)).toEqual([BOOK_2]);
  });
});

describe("hasCompleteItemPrices", () => {
  it.each([
    { books: [], complete: false, name: "an order without books" },
    {
      books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2, "0")],
      complete: true,
      name: "every book priced, zero included",
    },
    {
      books: [makeOrderBook(BOOK_1, "100"), makeOrderBook(BOOK_2, "   ")],
      complete: false,
      name: "a price of only spaces",
    },
  ])("is $complete for $name", ({ books, complete }) => {
    expect(hasCompleteItemPrices(books)).toBe(complete);
  });
});

describe("hasCreateBookOrderInput", () => {
  it("sees no input in an untouched draft", () => {
    expect(hasCreateBookOrderInput(EMPTY_CREATE_BOOK_ORDER_DRAFT)).toBe(false);
  });

  it.each<{ name: string; order: OrderDraft }>([
    { name: "a store", order: { ...EMPTY_ORDER, storeName: "Yakaboo" } },
    { name: "an order number", order: { ...EMPTY_ORDER, orderNumber: "A-1024" } },
    { name: "an order date", order: { ...EMPTY_ORDER, orderDate: "2026-03-01" } },
    { name: "a total", order: { ...EMPTY_ORDER, totalAmount: "480" } },
    { name: "a delivery price", order: { ...EMPTY_ORDER, deliveryPrice: "60" } },
    { name: "a discount", order: { ...EMPTY_ORDER, discount: "10" } },
    { name: "a note", order: { ...EMPTY_ORDER, note: "Gift" } },
    { name: "another currency", order: { ...EMPTY_ORDER, currency: "EUR" } },
    { name: "a cleared currency", order: { ...EMPTY_ORDER, currency: "" } },
    { name: "a free order", order: { ...EMPTY_ORDER, isFree: true } },
  ])("sees input in $name", ({ order }) => {
    expect(hasCreateBookOrderInput(makeDraft({ order }))).toBe(true);
  });

  it.each([
    { draft: makeDraft({ books: [makeOrderBook(BOOK_1)] }), name: "a chosen book" },
    {
      draft: makeDraft({ pickerSelection: [makeBookView({ id: BOOK_1 })] }),
      name: "a picker selection",
    },
    { draft: makeDraft({ shipping: "yes" }), name: "shipping turned on" },
    { draft: makeDraft({ financialMode: "items" }), name: "per-book prices" },
  ])("sees input in $name", ({ draft }) => {
    expect(hasCreateBookOrderInput(draft)).toBe(true);
  });
});

describe("optionalNumber", () => {
  it.each([
    { expected: null, value: "" },
    { expected: null, value: "   " },
    { expected: 0, value: "0" },
    { expected: 320.5, value: " 320.50 " },
  ])("reads $value as $expected", ({ expected, value }) => {
    expect(optionalNumber(value)).toBe(expected);
  });
});
