import { describe, expect, it } from "vitest";

import { deliveryDateBounds } from "./delivery-ui-status.js";
import { buildInTransitBaseFilter } from "./in-transit-base-filter.js";

const BOUNDS = deliveryDateBounds(new Date("2026-08-18T09:00:00.000Z"));

describe("buildInTransitBaseFilter", () => {
  it("carries every advanced filter and the owner but never a quick filter", () => {
    const base = buildInTransitBaseFilter({
      bounds: BOUNDS,
      query: {
        ageBucket: "8_14",
        booksMax: 3,
        booksMin: 1,
        currency: ["UAH"],
        expectedFrom: "2026-08-01",
        expectedTo: "2026-08-31",
        orderedFrom: "2026-07-01",
        orderedTo: "2026-07-31",
        orderId: "8a2b0d0e-4f3c-4b7a-9d7e-2f1c3b4a5d6e",
        orderState: "partially_received",
        priceCurrency: "UAH",
        priceMax: 900,
        priceMin: 100,
        search: "Dune",
        service: ["Nova Poshta"],
        store: ["Yakaboo"],
        structure: ["single_shipment"],
      },
      userId: "user-1",
    });

    expect(base).toEqual({
      ageBucket: "8_14",
      booksMax: 3,
      booksMin: 1,
      bounds: BOUNDS,
      currency: ["UAH"],
      expectedFrom: "2026-08-01",
      expectedTo: "2026-08-31",
      orderedFrom: "2026-07-01",
      orderedTo: "2026-07-31",
      orderId: "8a2b0d0e-4f3c-4b7a-9d7e-2f1c3b4a5d6e",
      orderState: "partially_received",
      priceCurrency: "UAH",
      priceMax: 900,
      priceMin: 100,
      search: "Dune",
      service: ["Nova Poshta"],
      store: ["Yakaboo"],
      structure: ["single_shipment"],
      userId: "user-1",
    });
    expect(base).not.toHaveProperty("filter");
  });

  it("drops a search made only of whitespace", () => {
    const base = buildInTransitBaseFilter({
      bounds: BOUNDS,
      query: { search: "   " },
      userId: "u",
    });

    expect(base.search).toBeUndefined();
  });
});
