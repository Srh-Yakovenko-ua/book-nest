import type { BookOrderDerivedStatus, ShipmentStatus } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { DerivedStatusItem, DerivedStatusShipment } from "./order-derived-status.js";

import { computeBookOrderDerivedStatus } from "./order-derived-status.js";

type DerivedStatusCase = {
  expected: BookOrderDerivedStatus;
  items: DerivedStatusItem[];
  name: string;
  shipments: DerivedStatusShipment[];
};

const CANCELLED_AT = new Date("2026-03-02T09:00:00.000Z");
const RECEIVED_AT = new Date("2026-03-05T09:00:00.000Z");

const LIVE_PARCEL = "shipment-live";
const OTHER_LIVE_PARCEL = "shipment-live-2";
const CANCELLED_PARCEL = "shipment-cancelled";

function makeItem(overrides: Partial<DerivedStatusItem> = {}): DerivedStatusItem {
  return { cancelledAt: null, receivedAt: null, shipmentId: null, ...overrides };
}

function makeShipment(id: string, status: ShipmentStatus): DerivedStatusShipment {
  return { id, status };
}

const LIVE_SHIPMENTS: DerivedStatusShipment[] = [
  makeShipment(LIVE_PARCEL, "in_transit"),
  makeShipment(OTHER_LIVE_PARCEL, "ordered"),
];

const DERIVED_STATUS_CASES: DerivedStatusCase[] = [
  {
    expected: "cancelled",
    items: [makeItem({ cancelledAt: CANCELLED_AT }), makeItem({ cancelledAt: CANCELLED_AT })],
    name: "an order whose every item is cancelled reads as cancelled",
    shipments: [],
  },
  {
    expected: "received",
    items: [
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
    ],
    name: "an order whose every live item is received reads as received",
    shipments: LIVE_SHIPMENTS,
  },
  {
    expected: "received",
    items: [
      makeItem({ cancelledAt: CANCELLED_AT }),
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
    ],
    name: "a cancelled item does not hold back an order whose remaining book arrived",
    shipments: LIVE_SHIPMENTS,
  },
  {
    expected: "partially_received",
    items: [
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
      makeItem({ shipmentId: OTHER_LIVE_PARCEL }),
    ],
    name: "an order with one book arrived and one still travelling reads as partially received",
    shipments: LIVE_SHIPMENTS,
  },
  {
    expected: "partially_shipped",
    items: [makeItem({ shipmentId: LIVE_PARCEL }), makeItem()],
    name: "an order with one book in a parcel and one not yet assigned reads as partially shipped",
    shipments: LIVE_SHIPMENTS,
  },
  {
    expected: "shipped",
    items: [makeItem({ shipmentId: LIVE_PARCEL }), makeItem({ shipmentId: OTHER_LIVE_PARCEL })],
    name: "an order with every book in a parcel and nothing arrived reads as shipped",
    shipments: LIVE_SHIPMENTS,
  },
  {
    expected: "active",
    items: [makeItem(), makeItem()],
    name: "an order whose books are in no parcel at all reads as active",
    shipments: [],
  },
  {
    expected: "active",
    items: [],
    name: "an order that carries no items reads as active rather than cancelled",
    shipments: [],
  },
  {
    expected: "active",
    items: [makeItem({ shipmentId: CANCELLED_PARCEL })],
    name: "a book left in a cancelled parcel counts as unshipped",
    shipments: [makeShipment(CANCELLED_PARCEL, "cancelled")],
  },
  {
    expected: "partially_shipped",
    items: [makeItem({ shipmentId: LIVE_PARCEL }), makeItem({ shipmentId: CANCELLED_PARCEL })],
    name: "an order split between a live parcel and a cancelled one reads as partially shipped",
    shipments: [
      makeShipment(LIVE_PARCEL, "in_transit"),
      makeShipment(CANCELLED_PARCEL, "cancelled"),
    ],
  },
  {
    expected: "received",
    items: [
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: CANCELLED_PARCEL }),
    ],
    name: "a received book keeps the order received even when its parcel was later cancelled",
    shipments: [makeShipment(LIVE_PARCEL, "received"), makeShipment(CANCELLED_PARCEL, "cancelled")],
  },
];

describe("computeBookOrderDerivedStatus", () => {
  it.each(DERIVED_STATUS_CASES)("$name", ({ expected, items, shipments }) => {
    expect(computeBookOrderDerivedStatus({ items, shipments })).toBe(expected);
  });

  it("walks a two-book order from active to received without ever stepping back", () => {
    const shipments = [makeShipment(LIVE_PARCEL, "in_transit")];
    const stages: DerivedStatusItem[][] = [
      [makeItem(), makeItem()],
      [makeItem({ shipmentId: LIVE_PARCEL }), makeItem()],
      [makeItem({ shipmentId: LIVE_PARCEL }), makeItem({ shipmentId: LIVE_PARCEL })],
      [
        makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
        makeItem({ shipmentId: LIVE_PARCEL }),
      ],
      [
        makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
        makeItem({ receivedAt: RECEIVED_AT, shipmentId: LIVE_PARCEL }),
      ],
    ];

    const walk = stages.map((items) => computeBookOrderDerivedStatus({ items, shipments }));

    expect(walk).toEqual([
      "active",
      "partially_shipped",
      "shipped",
      "partially_received",
      "received",
    ]);
  });
});
