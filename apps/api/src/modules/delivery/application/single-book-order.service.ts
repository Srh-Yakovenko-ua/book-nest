import type { ActiveShipmentStatus, Currency, Nullable } from "@app/shared";

import { ShipmentStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookOrderItemWithContext } from "../infrastructure/book-order-items.repository.js";
import type { BookOrderPatch, NewShipmentData } from "../infrastructure/book-orders.repository.js";
import type { ShipmentPatch } from "../infrastructure/shipments.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { NO_STORE_NAME } from "../domain/book-delivery.mapper.js";
import { evaluateShipmentEdit } from "../domain/shipment-transition.js";
import { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import { ShipmentsRepository } from "../infrastructure/shipments.repository.js";
import {
  assertShipmentsExpectedAfter,
  DELIVERY_WRITE_MESSAGES,
  sharedOrderError,
  sharedShipmentError,
  shipmentNotActiveError,
  toActiveOrderItemConflict,
} from "./delivery-write-errors.js";
import { ShipmentDeliveryServiceResolver } from "./shipment-delivery-service.resolver.js";

export type NewSingleBookOrder = {
  currency: Nullable<Currency>;
  deliveryService: Nullable<string>;
  expectedDeliveryDate: Nullable<Date>;
  note: Nullable<string>;
  orderDate: Nullable<Date>;
  orderNumber: Nullable<string>;
  price: Nullable<number>;
  status: ActiveShipmentStatus;
  storeName: Nullable<string>;
  trackingNumber: Nullable<string>;
  trackingUrl: Nullable<string>;
};

export type SingleBookOrderBlockChange =
  | { cancelledAt: Date; kind: "cancel" }
  | { create: NewSingleBookOrder; kind: "upsertActive"; update: SingleBookOrderPatch }
  | { kind: "skip" };

export type SingleBookOrderPatch = {
  currency?: Nullable<Currency>;
  deliveryService?: Nullable<string>;
  expectedDeliveryDate?: Nullable<Date>;
  note?: Nullable<string>;
  orderDate?: Nullable<Date>;
  orderNumber?: Nullable<string>;
  price?: Nullable<number>;
  status?: ActiveShipmentStatus;
  storeName?: Nullable<string>;
  trackingNumber?: Nullable<string>;
  trackingUrl?: Nullable<string>;
};

@Injectable()
export class SingleBookOrderService {
  constructor(
    private readonly bookOrdersRepository: BookOrdersRepository,
    private readonly bookOrderItemsRepository: BookOrderItemsRepository,
    private readonly shipmentsRepository: ShipmentsRepository,
    private readonly deliveryServiceResolver: ShipmentDeliveryServiceResolver,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async applyBlock(
    {
      bookId,
      change,
      userId,
    }: {
      bookId: string;
      change: SingleBookOrderBlockChange;
      userId: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    switch (change.kind) {
      case "cancel":
        await this.bookOrderItemsRepository.cancelActiveForBooks(
          { bookIds: [bookId], cancelledAt: change.cancelledAt, cancelReason: null, userId },
          client,
        );
        return;
      case "skip":
        return;
      case "upsertActive": {
        const active = await this.bookOrderItemsRepository.findActiveForBook(
          { bookId, userId },
          client,
        );
        if (active === null) {
          await this.create({ bookId, draft: change.create, userId }, client);
          return;
        }
        await this.patchItemContext({ client, item: active, patch: change.update, userId });
        return;
      }
      default:
        return assertNever(change);
    }
  }

  async create(
    {
      bookId,
      draft,
      userId,
    }: {
      bookId: string;
      draft: NewSingleBookOrder;
      userId: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const service = await this.deliveryServiceResolver.resolve(
      { name: draft.deliveryService, userId },
      client,
    );

    try {
      const order = await this.bookOrdersRepository.create(
        {
          items: [{ bookId, price: draft.price }],
          order: {
            currency: draft.currency,
            deliveryPrice: null,
            discount: null,
            note: draft.note,
            orderDate: draft.orderDate,
            orderNumber: draft.orderNumber,
            storeName: draft.storeName ?? NO_STORE_NAME,
            totalAmount: null,
          },
          shipments: [{ bookIds: [bookId], data: toNewShipmentData({ draft, service }) }],
          userId,
        },
        client,
      );
      if (order === null) {
        throw new NotFoundError(DELIVERY_WRITE_MESSAGES.bookNotFound);
      }
    } catch (error) {
      throw toActiveOrderItemConflict(error);
    }
  }

  updateActiveItem({
    itemId,
    patch,
    userId,
  }: {
    itemId: string;
    patch: SingleBookOrderPatch;
    userId: string;
  }): Promise<void> {
    return this.transactionRunner.run(async (tx) => {
      const item = await this.bookOrderItemsRepository.findOwnedById({ itemId, userId }, tx);
      if (item === null) {
        throw new NotFoundError(DELIVERY_WRITE_MESSAGES.itemNotFound);
      }
      if (item.cancelledAt !== null || item.receivedAt !== null) {
        throw new ConflictError(DELIVERY_WRITE_MESSAGES.itemNoLongerActive);
      }

      await this.patchItemContext({ client: tx, item, patch, userId });
    });
  }

  private async attachNewShipment(
    {
      data,
      item,
      userId,
    }: {
      data: NewShipmentData;
      item: BookOrderItemWithContext;
      userId: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const shipment = await this.shipmentsRepository.create(
      { data, orderId: item.orderId, userId },
      client,
    );
    if (shipment === null) {
      throw new NotFoundError(DELIVERY_WRITE_MESSAGES.orderNotFound);
    }

    const moved = await this.bookOrderItemsRepository.moveToShipment(
      { itemIds: [item.id], orderId: item.orderId, shipmentId: shipment.id, userId },
      client,
    );
    if (moved === 0) {
      throw shipmentNotActiveError();
    }
  }

  private async patchItemContext({
    client,
    item,
    patch,
    userId,
  }: {
    client: Prisma.TransactionClient;
    item: BookOrderItemWithContext;
    patch: SingleBookOrderPatch;
    userId: string;
  }): Promise<void> {
    assertShipmentsExpectedAfter({
      orderDate: patch.orderDate === undefined ? item.order.orderDate : patch.orderDate,
      shipments: mergeShipmentDates({ item, patch }),
    });

    const orderPatch = toOrderPatch(patch);
    if (Object.keys(orderPatch).length > 0) {
      if (countBooksInOrder(item) > 1) {
        throw sharedOrderError();
      }

      const updated = await this.bookOrdersRepository.updateOwned(
        { data: orderPatch, orderId: item.orderId, userId },
        client,
      );
      if (updated === 0) {
        throw new NotFoundError(DELIVERY_WRITE_MESSAGES.orderNotFound);
      }
    }

    if (patch.price !== undefined) {
      const priced = await this.bookOrderItemsRepository.updateActivePrice(
        { itemId: item.id, price: patch.price, userId },
        client,
      );
      if (priced === 0) {
        throw new ConflictError(DELIVERY_WRITE_MESSAGES.itemNoLongerActive);
      }
    }

    await this.patchShipment({ client, item, patch, userId });
  }

  private async patchShipment({
    client,
    item,
    patch,
    userId,
  }: {
    client: Prisma.TransactionClient;
    item: BookOrderItemWithContext;
    patch: SingleBookOrderPatch;
    userId: string;
  }): Promise<void> {
    const serviceSnapshot = await this.deliveryServiceResolver.resolvePatch(
      { name: patch.deliveryService, userId },
      client,
    );
    const shipmentPatch: ShipmentPatch = {
      ...serviceSnapshot,
      ...(patch.expectedDeliveryDate === undefined
        ? {}
        : { expectedDeliveryDate: patch.expectedDeliveryDate }),
      ...(patch.trackingNumber === undefined ? {} : { trackingNumber: patch.trackingNumber }),
      ...(patch.trackingUrl === undefined ? {} : { trackingUrl: patch.trackingUrl }),
    };
    const hasShipmentPatch = Object.keys(shipmentPatch).length > 0 || patch.status !== undefined;
    if (!hasShipmentPatch) {
      return;
    }
    if (countBooksInShipment(item) > 1) {
      throw sharedShipmentError();
    }

    const { shipment } = item;
    if (shipment === null) {
      await this.attachNewShipment(
        {
          data: {
            deliveryServiceId: serviceSnapshot.deliveryServiceId ?? null,
            deliveryServiceName: serviceSnapshot.deliveryServiceName ?? null,
            expectedDeliveryDate: patch.expectedDeliveryDate ?? null,
            note: null,
            pickupUntil: null,
            status: patch.status ?? ShipmentStatusSchema.enum.ordered,
            trackingNumber: patch.trackingNumber ?? null,
            trackingUrl: patch.trackingUrl ?? null,
          },
          item,
          userId,
        },
        client,
      );
      return;
    }

    const status = ShipmentStatusSchema.parse(shipment.status);
    if (evaluateShipmentEdit(status).outcome === "rejected") {
      throw shipmentNotActiveError();
    }

    const updated =
      patch.status === undefined
        ? await this.shipmentsRepository.updateActive(
            { data: shipmentPatch, shipmentId: shipment.id, userId },
            client,
          )
        : await this.shipmentsRepository.updateActiveStatus(
            { data: { ...shipmentPatch, status: patch.status }, shipmentId: shipment.id, userId },
            client,
          );
    if (updated === 0) {
      throw shipmentNotActiveError();
    }
  }
}

function countBooksInOrder(item: BookOrderItemWithContext): number {
  return new Set(item.order.items.map((sibling) => sibling.bookId)).size;
}

function countBooksInShipment(item: BookOrderItemWithContext): number {
  if (item.shipmentId === null) {
    return 1;
  }
  return new Set(
    item.order.items
      .filter((sibling) => sibling.shipmentId === item.shipmentId)
      .map((sibling) => sibling.bookId),
  ).size;
}

function mergeShipmentDates({
  item,
  patch,
}: {
  item: BookOrderItemWithContext;
  patch: SingleBookOrderPatch;
}): { expectedDeliveryDate: Nullable<Date> }[] {
  const patchedDate =
    patch.expectedDeliveryDate === undefined
      ? (item.shipment?.expectedDeliveryDate ?? null)
      : patch.expectedDeliveryDate;

  return [
    { expectedDeliveryDate: patchedDate },
    ...item.order.shipments.filter((shipment) => shipment.id !== item.shipmentId),
  ];
}

function toNewShipmentData({
  draft,
  service,
}: {
  draft: NewSingleBookOrder;
  service: { deliveryServiceId: Nullable<string>; deliveryServiceName: Nullable<string> };
}): NewShipmentData {
  return {
    ...service,
    expectedDeliveryDate: draft.expectedDeliveryDate,
    note: null,
    pickupUntil: null,
    status: draft.status,
    trackingNumber: draft.trackingNumber,
    trackingUrl: draft.trackingUrl,
  };
}

function toOrderPatch(patch: SingleBookOrderPatch): BookOrderPatch {
  return {
    ...(patch.currency === undefined ? {} : { currency: patch.currency }),
    ...(patch.note === undefined ? {} : { note: patch.note }),
    ...(patch.orderDate === undefined ? {} : { orderDate: patch.orderDate }),
    ...(patch.orderNumber === undefined ? {} : { orderNumber: patch.orderNumber }),
    ...(patch.storeName === undefined ? {} : { storeName: patch.storeName ?? NO_STORE_NAME }),
  };
}
