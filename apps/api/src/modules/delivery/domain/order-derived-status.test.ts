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

const TRAVELLING_PARCEL = "shipment-travelling";
const WAITING_PARCEL = "shipment-waiting";
const UNSENT_PARCEL = "shipment-unsent";
const CANCELLED_PARCEL = "shipment-cancelled";

function makeItem(overrides: Partial<DerivedStatusItem> = {}): DerivedStatusItem {
  return { cancelledAt: null, receivedAt: null, shipmentId: null, ...overrides };
}

function makeShipment(id: string, status: ShipmentStatus): DerivedStatusShipment {
  return { id, status };
}

const DISPATCHED_SHIPMENTS: DerivedStatusShipment[] = [
  makeShipment(TRAVELLING_PARCEL, "in_transit"),
  makeShipment(WAITING_PARCEL, "ready_for_pickup"),
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
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
    ],
    name: "an order whose every live item is received reads as received",
    shipments: DISPATCHED_SHIPMENTS,
  },
  {
    expected: "received",
    items: [
      makeItem({ cancelledAt: CANCELLED_AT }),
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
    ],
    name: "a cancelled item does not hold back an order whose remaining book arrived",
    shipments: DISPATCHED_SHIPMENTS,
  },
  {
    expected: "partially_received",
    items: [
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
      makeItem({ shipmentId: WAITING_PARCEL }),
    ],
    name: "an order with one book arrived and one still travelling reads as partially received",
    shipments: DISPATCHED_SHIPMENTS,
  },
  {
    expected: "partially_shipped",
    items: [makeItem({ shipmentId: TRAVELLING_PARCEL }), makeItem()],
    name: "an order with one book in a parcel and one not yet assigned reads as partially shipped",
    shipments: DISPATCHED_SHIPMENTS,
  },
  {
    expected: "shipped",
    items: [makeItem({ shipmentId: TRAVELLING_PARCEL }), makeItem({ shipmentId: WAITING_PARCEL })],
    name: "an order whose every book rides a parcel that has left reads as shipped, and a parcel waiting at a pickup point counts as one that left",
    shipments: DISPATCHED_SHIPMENTS,
  },
  {
    expected: "active",
    items: [makeItem({ shipmentId: UNSENT_PARCEL }), makeItem({ shipmentId: UNSENT_PARCEL })],
    name: "an order whose books all sit in a parcel nobody has sent yet reads as active, not shipped",
    shipments: [makeShipment(UNSENT_PARCEL, "ordered")],
  },
  {
    expected: "partially_shipped",
    items: [makeItem({ shipmentId: TRAVELLING_PARCEL }), makeItem({ shipmentId: UNSENT_PARCEL })],
    name: "an order with one parcel on the road and one still unsent reads as partially shipped",
    shipments: [
      makeShipment(TRAVELLING_PARCEL, "in_transit"),
      makeShipment(UNSENT_PARCEL, "ordered"),
    ],
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
    items: [
      makeItem({ shipmentId: TRAVELLING_PARCEL }),
      makeItem({ shipmentId: CANCELLED_PARCEL }),
    ],
    name: "an order split between a live parcel and a cancelled one reads as partially shipped",
    shipments: [
      makeShipment(TRAVELLING_PARCEL, "in_transit"),
      makeShipment(CANCELLED_PARCEL, "cancelled"),
    ],
  },
  {
    expected: "received",
    items: [
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
      makeItem({ receivedAt: RECEIVED_AT, shipmentId: CANCELLED_PARCEL }),
    ],
    name: "a received book keeps the order received even when its parcel was later cancelled",
    shipments: [
      makeShipment(TRAVELLING_PARCEL, "received"),
      makeShipment(CANCELLED_PARCEL, "cancelled"),
    ],
  },
];

describe("computeBookOrderDerivedStatus", () => {
  it.each(DERIVED_STATUS_CASES)("$name", ({ expected, items, shipments }) => {
    expect(computeBookOrderDerivedStatus({ items, shipments })).toBe(expected);
  });

  it("walks a two-book order from active to received without ever stepping back", () => {
    const shipments = [makeShipment(TRAVELLING_PARCEL, "in_transit")];
    const stages: DerivedStatusItem[][] = [
      [makeItem(), makeItem()],
      [makeItem({ shipmentId: TRAVELLING_PARCEL }), makeItem()],
      [makeItem({ shipmentId: TRAVELLING_PARCEL }), makeItem({ shipmentId: TRAVELLING_PARCEL })],
      [
        makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
        makeItem({ shipmentId: TRAVELLING_PARCEL }),
      ],
      [
        makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
        makeItem({ receivedAt: RECEIVED_AT, shipmentId: TRAVELLING_PARCEL }),
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

  it("moves an order to shipped only once its parcel actually leaves, not when the books are packed into it", () => {
    const items = [
      makeItem({ shipmentId: UNSENT_PARCEL }),
      makeItem({ shipmentId: UNSENT_PARCEL }),
    ];

    const packed = computeBookOrderDerivedStatus({
      items,
      shipments: [makeShipment(UNSENT_PARCEL, "ordered")],
    });
    const sent = computeBookOrderDerivedStatus({
      items,
      shipments: [makeShipment(UNSENT_PARCEL, "in_transit")],
    });

    expect([packed, sent]).toEqual(["active", "shipped"]);
  });
});
