import type { Currency, Nullable, OwnershipStatus, ShipmentStatus } from "@app/shared";

export type CreateDeliveryData = {
  currency: Nullable<Currency>;
  deliveryService: Nullable<string>;
  expectedDeliveryDate: Nullable<Date>;
  note: Nullable<string>;
  orderDate: Nullable<Date>;
  orderNumber: Nullable<string>;
  price: Nullable<number>;
  status: ShipmentStatus;
  storeName: Nullable<string>;
  trackingNumber: Nullable<string>;
  trackingUrl: Nullable<string>;
};

export type CreateDeliveryTransition = {
  book: DeliveryBookPatch;
  delivery: CreateDeliveryData;
};

export type DeliveryBookPatch = {
  ownershipStatus: OwnershipStatus;
  wishlistAddedAt?: Nullable<Date>;
};

export type RecordDeliveryTransition = {
  book: Nullable<DeliveryBookPatch>;
  delivery: UpdateDeliveryData;
};

export type UpdateDeliveryData = {
  cancelledAt?: Date;
  cancelReason?: Nullable<string>;
  currency?: Nullable<Currency>;
  deliveryService?: Nullable<string>;
  expectedDeliveryDate?: Nullable<Date>;
  note?: Nullable<string>;
  orderDate?: Nullable<Date>;
  orderNumber?: Nullable<string>;
  price?: Nullable<number>;
  receivedAt?: Date;
  status?: ShipmentStatus;
  storeName?: Nullable<string>;
  trackingNumber?: Nullable<string>;
  trackingUrl?: Nullable<string>;
};
