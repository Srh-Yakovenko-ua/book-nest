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

  const shipmentIds = liveShipmentIds(shipments);
  const shippedItems = liveItems.filter((item) => isShipped({ item, shipmentIds }));
  if (shippedItems.length === liveItems.length) {
    return DERIVED_STATUS.shipped;
  }
  if (shippedItems.length > 0) {
    return DERIVED_STATUS.partially_shipped;
  }

  return DERIVED_STATUS.active;
}

function isShipped({
  item,
  shipmentIds,
}: {
  item: DerivedStatusItem;
  shipmentIds: ReadonlySet<string>;
}): boolean {
  return item.shipmentId !== null && shipmentIds.has(item.shipmentId);
}

function liveShipmentIds(shipments: readonly DerivedStatusShipment[]): ReadonlySet<string> {
  return new Set(
    shipments
      .filter((shipment) => shipment.status !== ShipmentStatusSchema.enum.cancelled)
      .map((shipment) => shipment.id),
  );
}
