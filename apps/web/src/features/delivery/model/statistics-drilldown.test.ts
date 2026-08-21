import type { BookOrderStatisticsTopOrder } from "@app/shared";

import { describe, expect, it } from "vitest";

import { activeAgeHref, dayHref, monthHref, orderHref, storeHref } from "./statistics-drilldown";

const NO_FILTERS = { currency: null, store: null };

const ORDER: BookOrderStatisticsTopOrder = {
  booksCount: 2,
  currency: "UAH",
  derivedStatus: "received",
  id: "order-1",
  orderDate: "2026-08-11",
  orderNumber: "ST-20260811-50",
  storeName: "Vivat",
  totalAmount: 3670,
};

describe("monthHref", () => {
  it("spans the whole calendar month", () => {
    expect(monthHref("2026-02", NO_FILTERS)).toBe(
      "/delivery/history?from=2026-02-01&to=2026-02-28",
    );
  });

  it("carries the currency and store the reader was already looking at", () => {
    expect(monthHref("2026-02", { currency: "EUR", store: "Book Depository" })).toBe(
      "/delivery/history?from=2026-02-01&to=2026-02-28&currency=EUR&store=Book+Depository",
    );
  });
});

describe("dayHref", () => {
  it("pins both bounds to the same day", () => {
    expect(dayHref("2026-08-12", NO_FILTERS)).toBe(
      "/delivery/history?from=2026-08-12&to=2026-08-12",
    );
  });
});

describe("storeHref", () => {
  it("filters the history by store", () => {
    expect(storeHref("КСД", NO_FILTERS)).toBe("/delivery/history?store=%D0%9A%D0%A1%D0%94");
  });

  it("ignores a blank store name", () => {
    expect(storeHref("Vivat", { currency: null, store: "   " })).toBe(
      "/delivery/history?store=Vivat",
    );
  });
});

describe("activeAgeHref", () => {
  it("opens the in-transit list on that bucket, oldest first", () => {
    expect(activeAgeHref("31_plus", NO_FILTERS)).toBe(
      "/delivery/in-transit?ageBucket=31_plus&sort=oldest_orders",
    );
  });

  it("never turns the bucket into the delayed filter", () => {
    expect(activeAgeHref("31_plus", NO_FILTERS)).not.toContain("delayed");
  });
});

describe("orderHref", () => {
  it("searches the history for a settled order", () => {
    expect(orderHref(ORDER)).toBe("/delivery/history?q=ST-20260811-50");
  });

  it("opens the cancelled tab for a cancelled order", () => {
    expect(orderHref({ ...ORDER, derivedStatus: "cancelled" })).toBe(
      "/delivery/history?q=ST-20260811-50&tab=cancelled",
    );
  });

  it("searches the in-transit list while the order is still moving", () => {
    expect(orderHref({ ...ORDER, derivedStatus: "shipped" })).toBe(
      "/delivery/in-transit?q=ST-20260811-50",
    );
  });

  it("has nowhere to send a reader when the order carries no number", () => {
    expect(orderHref({ ...ORDER, orderNumber: null })).toBeNull();
  });
});
