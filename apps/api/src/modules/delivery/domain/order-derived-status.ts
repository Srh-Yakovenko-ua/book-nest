import type { BookOrderDerivedStatus, Nullable, ShipmentStatus } from "@app/shared";

import { BookOrderDerivedStatusSchema, ShipmentStatusSchema } from "@app/shared";

export type DerivedStatusItem = {
  cancelledAt: Nullable<Date>;
  receivedAt: Nullable<Date>;
  shipmentId: Nullable<string>;
};

export type DerivedStatusShipment = {
  id: string;
  status: ShipmentStatus;
};

const DERIVED_STATUS = BookOrderDerivedStatusSchema.enum;
const SHIPMENT_STATUS = ShipmentStatusSchema.enum;

const DISPATCHED_SHIPMENT_STATUSES: ReadonlySet<ShipmentStatus> = new Set([
  SHIPMENT_STATUS.in_transit,
  SHIPMENT_STATUS.ready_for_pickup,
  SHIPMENT_STATUS.received,
]);

export function computeBookOrderDerivedStatus({
  items,
  shipments,
}: {
  items: readonly DerivedStatusItem[];
  shipments: readonly DerivedStatusShipment[];
}): BookOrderDerivedStatus {
  if (items.length === 0) {
    return DERIVED_STATUS.active;
  }

  const liveItems = items.filter((item) => item.cancelledAt === null);
  if (liveItems.length === 0) {
    return DERIVED_STATUS.cancelled;
  }

  const receivedItems = liveItems.filter((item) => item.receivedAt !== null);
  if (receivedItems.length === liveItems.length) {
    return DERIVED_STATUS.received;
  }
  if (receivedItems.length > 0) {
    return DERIVED_STATUS.partially_received;
  }

  const dispatchedIds = dispatchedShipmentIds(shipments);
  const shippedItems = liveItems.filter((item) => isShipped({ dispatchedIds, item }));
  if (shippedItems.length === liveItems.length) {
    return DERIVED_STATUS.shipped;
  }
  if (shippedItems.length > 0) {
    return DERIVED_STATUS.partially_shipped;
  }

  return DERIVED_STATUS.active;
}

function dispatchedShipmentIds(shipments: readonly DerivedStatusShipment[]): ReadonlySet<string> {
  return new Set(
    shipments
      .filter((shipment) => DISPATCHED_SHIPMENT_STATUSES.has(shipment.status))
      .map((shipment) => shipment.id),
  );
}

function isShipped({
  dispatchedIds,
  item,
}: {
  dispatchedIds: ReadonlySet<string>;
  item: DerivedStatusItem;
}): boolean {
  return item.shipmentId !== null && dispatchedIds.has(item.shipmentId);
}
