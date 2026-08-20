import type { BookOrderHistorySummaryView, LatestReceiptView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { DeliveryLatestReceiptLabels } from "./latest-receipt-card";

import { buildDeliveryLatestReceiptCard } from "./latest-receipt-card";

const LABELS: DeliveryLatestReceiptLabels = {
  booksCount: (count) => `books:${count}`,
  daysAgo: (count) => `daysAgo:${count}`,
  sameDay: (count) => `sameDay:${count}`,
  today: "today",
  yesterday: "yesterday",
};

const NOW = new Date("2026-08-20T09:00:00.000Z");

function build(latestReceipt: LatestReceiptView | null) {
  return buildDeliveryLatestReceiptCard({
    labels: LABELS,
    locale: "uk",
    now: NOW,
    summary: summary(latestReceipt),
  });
}

function preview(id: string) {
  return { authorName: `Author ${id}`, cover: null, id, title: `Book ${id}` };
}

function receipt(overrides: Partial<LatestReceiptView> = {}): LatestReceiptView {
  return {
    bookPreviews: [preview("a")],
    booksCount: 1,
    deliveryService: { id: "service-1", name: "Nova Poshta" },
    orderId: "order-1",
    receivedAt: "2026-08-20T07:30:00.000Z",
    sameDayCount: 0,
    shipmentId: "shipment-1",
    storeName: "Yakaboo",
    ...overrides,
  };
}

function summary(latestReceipt: LatestReceiptView | null): BookOrderHistorySummaryView {
  return {
    cancelledBooksCount: 0,
    cancelledOrdersCount: 0,
    completedOrdersCount: 0,
    completedWithCancellationsCount: 0,
    completedWithoutCancellationsCount: 0,
    latestReceipt,
    receivedBooksCount: 0,
    receivedOrdersCount: 0,
    receivedSeriesBooksCount: 0,
    receivedSeriesCount: 0,
    receivedShipmentsCount: 0,
    receivedStandaloneBooksCount: 0,
  };
}

describe("buildDeliveryLatestReceiptCard", () => {
  it("has nothing to show without a summary", () => {
    expect(
      buildDeliveryLatestReceiptCard({ labels: LABELS, locale: "uk", now: NOW, summary: null }),
    ).toBeNull();
  });

  it("has nothing to show while nothing has been received", () => {
    expect(build(null)).toBeNull();
  });

  it("shows one received book in full", () => {
    const model = build(receipt());

    expect(model?.books).toEqual({
      book: {
        authorName: "Author a",
        bookHref: "/books/a",
        coverSrc: undefined,
        id: "a",
        title: "Book a",
      },
      kind: "single",
    });
    expect(model?.relativeDayText).toBe("today");
    expect(model?.serviceName).toBe("Nova Poshta");
  });

  it("stacks the covers once more than one book arrived", () => {
    const model = build(
      receipt({
        bookPreviews: [preview("a"), preview("b"), preview("c")],
        booksCount: 7,
      }),
    );

    expect(model?.books.kind).toBe("stack");
    expect(model?.books.kind === "stack" ? model.books.countText : null).toBe("books:7");
    expect(model?.books.kind === "stack" ? model.books.covers.length : 0).toBe(3);
  });

  it("leaves the service out of a receipt that came without a parcel", () => {
    const model = build(receipt({ deliveryService: null, shipmentId: null }));

    expect(model?.serviceName).toBeNull();
    expect(model?.shipmentId).toBeNull();
  });

  it("names yesterday and older days", () => {
    expect(build(receipt({ receivedAt: "2026-08-19T07:30:00.000Z" }))?.relativeDayText).toBe(
      "yesterday",
    );
    expect(build(receipt({ receivedAt: "2026-08-16T07:30:00.000Z" }))?.relativeDayText).toBe(
      "daysAgo:4",
    );
  });

  it("mentions the other receipts of the same day only when there were any", () => {
    expect(build(receipt())?.sameDayText).toBeNull();
    expect(build(receipt({ sameDayCount: 2 }))?.sameDayText).toBe("sameDay:2");
  });
});
