import type {
  BookOrderItemRowOrderView,
  BookOrderItemRowShipmentView,
  BookOrderItemRowView,
  Nullable,
  OrderHistoryBookView,
  OrderHistoryGroupView,
  OrderHistoryShipmentGroupView,
  OrderHistoryShipmentView,
} from "@app/shared";

type PendingOrder = {
  order: BookOrderItemRowOrderView;
  shipments: Map<Nullable<string>, OrderHistoryShipmentGroupView>;
};

export function toOrderHistoryGroups(rows: BookOrderItemRowView[]): OrderHistoryGroupView[] {
  const orders = new Map<string, PendingOrder>();

  for (const row of rows) {
    const pending = orders.get(row.order.id) ?? { order: row.order, shipments: new Map() };
    orders.set(row.order.id, pending);

    const shipmentId = row.shipment?.id ?? null;
    const group = pending.shipments.get(shipmentId);
    if (group === undefined) {
      pending.shipments.set(shipmentId, {
        books: [toHistoryBook(row)],
        shipment: row.shipment === null ? null : toHistoryShipment(row.shipment),
      });
      continue;
    }

    group.books.push(toHistoryBook(row));
  }

  return Array.from(orders.values(), (pending) => {
    const shipments = Array.from(pending.shipments.values());

    return {
      booksCount: shipments.reduce((count, group) => count + group.books.length, 0),
      order: pending.order,
      shipments,
    };
  });
}

function toHistoryBook(row: BookOrderItemRowView): OrderHistoryBookView {
  return {
    book: row.book,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    id: row.id,
    price: row.price,
    receivedAt: row.receivedAt,
  };
}

function toHistoryShipment(shipment: BookOrderItemRowShipmentView): OrderHistoryShipmentView {
  return {
    cancelledAt: shipment.cancelledAt,
    cancelReason: shipment.cancelReason,
    deliveryService: shipment.deliveryService,
    expectedDeliveryDate: shipment.expectedDeliveryDate,
    id: shipment.id,
    note: shipment.note,
    pickupUntil: shipment.pickupUntil,
    receivedAt: shipment.receivedAt,
    status: shipment.status,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
  };
}
