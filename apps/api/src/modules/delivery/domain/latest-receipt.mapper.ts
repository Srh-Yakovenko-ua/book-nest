import type { DeliveryBookPreview, LatestReceiptView, Nullable } from "@app/shared";

export type LatestReceiptEvent = {
  booksCount: number;
  deliveryServiceId: Nullable<string>;
  deliveryServiceName: Nullable<string>;
  orderId: string;
  receivedAt: Date;
  sameDayCount: number;
  shipmentId: Nullable<string>;
  storeName: string;
};

export function toLatestReceiptView({
  bookPreviews,
  event,
}: {
  bookPreviews: DeliveryBookPreview[];
  event: LatestReceiptEvent;
}): LatestReceiptView {
  return {
    bookPreviews,
    booksCount: event.booksCount,
    deliveryService:
      event.deliveryServiceName === null
        ? null
        : { id: event.deliveryServiceId, name: event.deliveryServiceName },
    orderId: event.orderId,
    receivedAt: event.receivedAt.toISOString(),
    sameDayCount: event.sameDayCount,
    shipmentId: event.shipmentId,
    storeName: event.storeName,
  };
}
