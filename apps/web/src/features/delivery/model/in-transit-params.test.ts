import { describe, expect, it } from "vitest";

import type { DeliveryAdvancedState, DeliveryQueryState } from "./in-transit-params";

import {
  countActiveDeliveryDimensions,
  DELIVERY_ADVANCED_EMPTY,
  DELIVERY_FILTER_DEFAULT,
  DELIVERY_PAGE_SIZE,
  DELIVERY_SORT_DEFAULT,
  hasActiveDeliveryFilters,
  hasInvalidDeliveryRange,
  resolveDeliveryPriceCurrency,
  toDeliveryListParams,
} from "./in-transit-params";

function advanced(overrides: Partial<DeliveryAdvancedState> = {}): DeliveryAdvancedState {
  return { ...DELIVERY_ADVANCED_EMPTY, ...overrides };
}

function state(overrides: Partial<DeliveryQueryState> = {}): DeliveryQueryState {
  return {
    ...DELIVERY_ADVANCED_EMPTY,
    filter: DELIVERY_FILTER_DEFAULT,
    q: "",
    sort: DELIVERY_SORT_DEFAULT,
    ...overrides,
  };
}

describe("counting the active advanced dimensions", () => {
  it("counts nothing on an untouched panel", () => {
    expect(countActiveDeliveryDimensions(advanced())).toBe(0);
  });

  it("counts a multiselect once however many values it holds", () => {
    expect(countActiveDeliveryDimensions(advanced({ store: ["Yakaboo"] }))).toBe(1);
    expect(
      countActiveDeliveryDimensions(advanced({ store: ["Yakaboo", "Book24", "Amazon"] })),
    ).toBe(1);
  });

  it("counts a range once whether one bound is filled or both", () => {
    expect(countActiveDeliveryDimensions(advanced({ booksMin: 2 }))).toBe(1);
    expect(countActiveDeliveryDimensions(advanced({ booksMax: 5, booksMin: 2 }))).toBe(1);
  });

  it("counts currency and the total range as two separate dimensions", () => {
    expect(countActiveDeliveryDimensions(advanced({ currency: ["UAH"], priceMin: 100 }))).toBe(2);
  });

  it("leaves the total range uncounted while it cannot apply", () => {
    expect(
      countActiveDeliveryDimensions(advanced({ currency: ["UAH", "EUR"], priceMin: 100 })),
    ).toBe(1);
  });

  it("treats an advanced dimension as an active filter of the page", () => {
    expect(hasActiveDeliveryFilters(state())).toBe(false);
    expect(hasActiveDeliveryFilters(state({ structure: ["no_shipment"] }))).toBe(true);
  });
});

describe("gating the order total range on a single currency", () => {
  it("names the currency when exactly one is chosen and a bound is set", () => {
    expect(resolveDeliveryPriceCurrency(advanced({ currency: ["EUR"], priceMax: 90 }))).toBe("EUR");
  });

  it("names nothing when no currency, several currencies or no bound", () => {
    expect(resolveDeliveryPriceCurrency(advanced({ priceMin: 100 }))).toBeNull();
    expect(
      resolveDeliveryPriceCurrency(advanced({ currency: ["UAH", "USD"], priceMin: 100 })),
    ).toBeNull();
    expect(resolveDeliveryPriceCurrency(advanced({ currency: ["UAH"] }))).toBeNull();
  });

  it("names nothing when the range reads backwards", () => {
    expect(
      resolveDeliveryPriceCurrency(advanced({ currency: ["UAH"], priceMax: 10, priceMin: 100 })),
    ).toBeNull();
  });
});

describe("spotting a backwards range", () => {
  it("accepts a half-open range", () => {
    expect(hasInvalidDeliveryRange(advanced({ orderedFrom: "2026-08-01" }))).toBe(false);
    expect(hasInvalidDeliveryRange(advanced({ booksMax: 4 }))).toBe(false);
  });

  it("rejects a start that sits past its end", () => {
    expect(
      hasInvalidDeliveryRange(advanced({ orderedFrom: "2026-08-10", orderedTo: "2026-08-01" })),
    ).toBe(true);
    expect(hasInvalidDeliveryRange(advanced({ booksMax: 1, booksMin: 4 }))).toBe(true);
  });
});

describe("turning the page state into request params", () => {
  it("sends the quick filter, sort and page size on an untouched page", () => {
    expect(toDeliveryListParams(state())).toEqual({
      currency: [],
      filter: DELIVERY_FILTER_DEFAULT,
      pageSize: DELIVERY_PAGE_SIZE,
      service: [],
      sort: DELIVERY_SORT_DEFAULT,
      store: [],
      structure: [],
    });
  });

  it("carries every advanced dimension alongside the quick filter and the search", () => {
    const params = toDeliveryListParams(
      state({
        booksMax: 5,
        booksMin: 2,
        currency: ["UAH"],
        expectedFrom: "2026-08-01",
        expectedTo: "2026-08-31",
        filter: "delayed",
        orderedFrom: "2026-07-01",
        priceMin: 250,
        pricePresence: "known",
        q: "  dune  ",
        service: ["Nova Poshta"],
        store: ["Yakaboo", "Book24"],
        structure: ["multiple_shipments"],
      }),
    );

    expect(params).toMatchObject({
      booksMax: 5,
      booksMin: 2,
      currency: ["UAH"],
      expectedFrom: "2026-08-01",
      expectedTo: "2026-08-31",
      filter: "delayed",
      orderedFrom: "2026-07-01",
      priceCurrency: "UAH",
      priceMin: 250,
      pricePresence: "known",
      search: "dune",
      service: ["Nova Poshta"],
      store: ["Yakaboo", "Book24"],
      structure: ["multiple_shipments"],
    });
  });

  it("holds back a backwards range instead of asking the server for nothing", () => {
    const params = toDeliveryListParams(
      state({ booksMax: 1, booksMin: 9, orderedFrom: "2026-08-10", orderedTo: "2026-08-01" }),
    );

    expect(params.booksMin).toBeUndefined();
    expect(params.booksMax).toBeUndefined();
    expect(params.orderedFrom).toBeUndefined();
    expect(params.orderedTo).toBeUndefined();
  });

  it("holds back the total range until one currency gates it", () => {
    const params = toDeliveryListParams(state({ currency: ["UAH", "EUR"], priceMin: 100 }));

    expect(params.priceCurrency).toBeUndefined();
    expect(params.priceMin).toBeUndefined();
    expect(params.currency).toEqual(["UAH", "EUR"]);
  });
});
