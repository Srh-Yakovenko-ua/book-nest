import type { InTransitSummaryView, NextShipmentView } from "@app/shared";

import { parseISO } from "date-fns";
import { describe, expect, it } from "vitest";

import type { DeliveryNextShipmentLabels } from "./next-shipment-card";

import { buildDeliveryNextShipmentCard } from "./next-shipment-card";

const NOW = parseISO("2026-08-18T10:00:00");

const LABELS: DeliveryNextShipmentLabels = {
  booksCount: (count) => `${count} книг`,
  inDays: (count) => `Через ${count} днів`,
  sameDay: (count) => `Ще ${count} доставок цього дня`,
  today: "Сьогодні",
  tomorrow: "Завтра",
};

function build(shipment: NextShipmentView | null) {
  return buildDeliveryNextShipmentCard({
    labels: LABELS,
    locale: "uk",
    now: NOW,
    summary: { nextShipment: shipment } as InTransitSummaryView,
  });
}

function makeBook(id: string, title: string) {
  return { authorName: "Дженіва Лі", cover: null, id, title };
}

function makeShipment(overrides: Partial<NextShipmentView> = {}): NextShipmentView {
  return {
    bookPreviews: [makeBook("book-a", "Навіки")],
    booksCount: 1,
    deliveryService: { id: "service-1", name: "Нова Пошта" },
    expectedDeliveryDate: "2026-08-20",
    orderId: "order-1",
    sameDayCount: 0,
    shipmentId: "shipment-1",
    status: "in_transit",
    storeName: "Book24",
    trackingNumber: "59000123456789",
    ...overrides,
  };
}

describe("buildDeliveryNextShipmentCard", () => {
  it("returns nothing when no shipment is awaiting arrival", () => {
    expect(build(null)).toBeNull();
  });

  it("returns nothing when there is no summary at all", () => {
    expect(
      buildDeliveryNextShipmentCard({ labels: LABELS, locale: "uk", now: NOW, summary: null }),
    ).toBeNull();
  });

  it("counts the days left rather than repeating the date", () => {
    expect(build(makeShipment())?.relativeDayText).toBe("Через 2 днів");
  });

  it("says today when the parcel is due today", () => {
    expect(build(makeShipment({ expectedDeliveryDate: "2026-08-18" }))?.relativeDayText).toBe(
      "Сьогодні",
    );
  });

  it("says tomorrow when the parcel is due tomorrow", () => {
    expect(build(makeShipment({ expectedDeliveryDate: "2026-08-19" }))?.relativeDayText).toBe(
      "Завтра",
    );
  });

  it("still says today when the expected day has already slipped past", () => {
    expect(build(makeShipment({ expectedDeliveryDate: "2026-08-17" }))?.relativeDayText).toBe(
      "Сьогодні",
    );
  });

  it("shows only the tail of a long tracking number", () => {
    expect(build(makeShipment())?.trackingText).toBe("…6789");
  });

  it("keeps a short tracking number whole", () => {
    expect(build(makeShipment({ trackingNumber: "AB1234" }))?.trackingText).toBe("AB1234");
  });

  it("treats a blank tracking number as no tracking at all", () => {
    expect(build(makeShipment({ trackingNumber: "   " }))?.trackingText).toBeNull();
  });

  it("renders a single book in full", () => {
    expect(build(makeShipment())?.books).toEqual({
      book: {
        authorName: "Дженіва Лі",
        bookHref: "/books/book-a",
        coverSrc: undefined,
        id: "book-a",
        title: "Навіки",
      },
      kind: "single",
    });
  });

  it("collapses several books into a cover stack capped at three", () => {
    const books = build(
      makeShipment({
        bookPreviews: [
          makeBook("book-a", "Навіки"),
          makeBook("book-b", "Фейрі"),
          makeBook("book-c", "Весілля"),
        ],
        booksCount: 7,
      }),
    )?.books;

    expect(books?.kind).toBe("stack");
    expect(books?.kind === "stack" ? books.covers.map((book) => book.id) : []).toEqual([
      "book-a",
      "book-b",
      "book-c",
    ]);
    expect(books?.kind === "stack" ? books.countText : null).toBe("7 книг");
  });

  it("falls back to the stack when a lone preview disagrees with the real count", () => {
    expect(build(makeShipment({ booksCount: 4 }))?.books.kind).toBe("stack");
  });

  it("stays quiet when nothing else arrives the same day", () => {
    expect(build(makeShipment())?.sameDayText).toBeNull();
  });

  it("mentions the other parcels landing the same day", () => {
    expect(build(makeShipment({ sameDayCount: 2 }))?.sameDayText).toBe("Ще 2 доставок цього дня");
  });

  it("carries the identifiers the reveal action needs", () => {
    expect(build(makeShipment())).toMatchObject({
      orderId: "order-1",
      serviceName: "Нова Пошта",
      shipmentId: "shipment-1",
      storeName: "Book24",
    });
  });
});
