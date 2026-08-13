import type {
  BookOrderShipmentInput,
  BookOrderView,
  CreateBookOrderInput,
  Nullable,
  UpdateBookOrderInput,
} from "@app/shared";

import { OwnershipStatusSchema, ShipmentStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BookOrderPatch,
  NewBookOrderData,
  NewOrderShipment,
} from "../infrastructure/book-orders.repository.js";
import type { DeliveryDay } from "./delivery-write-errors.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { toCreateDate, toUpdateDate } from "../../../core/iso-date.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import { evaluateBookOrderEntry, ORDER_ENTRY_REJECTIONS } from "../domain/order-item-transition.js";
import { toBookOrderView } from "../domain/order.mapper.js";
import { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import { BookOrdersRepository } from "../infrastructure/book-orders.repository.js";
import { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import { BookOrderViewLoader } from "./book-order-view.loader.js";
import {
  ACTIVE_ORDER_ITEM_CONSTRAINT,
  assertExpectedDeliveryNotBeforeOrder,
  DELIVERY_WRITE_MESSAGES,
  orderEntryError,
  orderNotFoundError,
} from "./delivery-write-errors.js";
import { ShipmentDeliveryServiceResolver } from "./shipment-delivery-service.resolver.js";

const ORDERED_BOOK_OWNERSHIP = OwnershipStatusSchema.enum.in_transit;

@Injectable()
export class BookOrderService {
  constructor(
    private readonly bookOrdersRepository: BookOrdersRepository,
    private readonly bookOrderItemsRepository: BookOrderItemsRepository,
    private readonly orderBooksRepository: OrderBooksRepository,
    private readonly deliveryServiceResolver: ShipmentDeliveryServiceResolver,
    private readonly viewLoader: BookOrderViewLoader,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async create({
    input,
    userId,
  }: {
    input: CreateBookOrderInput;
    userId: string;
  }): Promise<BookOrderView> {
    const now = new Date();
    const bookIds = input.items.map((item) => item.bookId);
    assertShipmentsExpectedAfter({ orderDate: input.orderDate, shipments: input.shipments ?? [] });

    try {
      return await this.transactionRunner.run(async (tx) => {
        await this.assertBooksCanBeOrdered({ bookIds, client: tx, userId });

        const order = await this.bookOrdersRepository.create(
          {
            items: input.items.map((item) => ({
              bookId: item.bookId,
              price: item.price ?? null,
            })),
            order: toNewOrderData(input),
            shipments: await this.buildShipments({ client: tx, input, userId }),
            userId,
          },
          tx,
        );
        if (order === null) {
          throw new NotFoundError(DELIVERY_WRITE_MESSAGES.bookNotFound);
        }

        await this.orderBooksRepository.applyOwnership(
          { bookIds, now, ownershipStatus: ORDERED_BOOK_OWNERSHIP, userId },
          tx,
        );

        return toBookOrderView(order);
      });
    } catch (error) {
      throw toActiveOrderItemConflict(error);
    }
  }

  findById({ orderId, userId }: { orderId: string; userId: string }): Promise<BookOrderView> {
    return this.viewLoader.loadOrThrow({ orderId, userId });
  }

  update({
    input,
    orderId,
    userId,
  }: {
    input: UpdateBookOrderInput;
    orderId: string;
    userId: string;
  }): Promise<BookOrderView> {
    return this.transactionRunner.run(async (tx) => {
      const order = await this.bookOrdersRepository.findOwnedById({ orderId, userId }, tx);
      if (order === null) {
        throw orderNotFoundError();
      }

      const patch = toOrderPatch(input);
      assertShipmentsExpectedAfter({
        orderDate: patch.orderDate ?? order.orderDate,
        shipments: order.shipments,
      });

      const updated = await this.bookOrdersRepository.updateOwned(
        { data: patch, orderId, userId },
        tx,
      );
      if (updated === 0) {
        throw orderNotFoundError();
      }

      return this.viewLoader.loadOrThrow({ orderId, userId }, tx);
    });
  }

  private async assertBooksCanBeOrdered({
    bookIds,
    client,
    userId,
  }: {
    bookIds: string[];
    client: Prisma.TransactionClient;
    userId: string;
  }): Promise<void> {
    const books = await this.orderBooksRepository.listOwned({ bookIds, userId }, client);
    if (books.length !== new Set(bookIds).size) {
      throw new NotFoundError(DELIVERY_WRITE_MESSAGES.bookNotFound);
    }

    const alreadyOrdered = new Set(
      await this.bookOrderItemsRepository.findActiveBookIds({ bookIds, userId }, client),
    );
    for (const book of books) {
      const entry = evaluateBookOrderEntry({
        hasActiveOrderItem: alreadyOrdered.has(book.id),
        ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
      });
      if (entry.outcome === "rejected") {
        throw orderEntryError(entry.reason);
      }
    }
  }

  private async buildShipments({
    client,
    input,
    userId,
  }: {
    client: Prisma.TransactionClient;
    input: CreateBookOrderInput;
    userId: string;
  }): Promise<NewOrderShipment[]> {
    const built: NewOrderShipment[] = [];
    for (const shipment of input.shipments ?? []) {
      built.push({
        bookIds: shipment.bookIds,
        data: await this.toNewShipmentData({ client, shipment, userId }),
      });
    }
    return built;
  }

  private async toNewShipmentData({
    client,
    shipment,
    userId,
  }: {
    client: Prisma.TransactionClient;
    shipment: BookOrderShipmentInput;
    userId: string;
  }): Promise<NewOrderShipment["data"]> {
    const service = await this.deliveryServiceResolver.resolve(
      { name: shipment.deliveryService, userId },
      client,
    );

    return {
      ...service,
      expectedDeliveryDate: toCreateDate(shipment.expectedDeliveryDate),
      note: shipment.note ?? null,
      pickupUntil: toCreateDate(shipment.pickupUntil),
      status: shipment.status ?? ShipmentStatusSchema.enum.ordered,
      trackingNumber: shipment.trackingNumber ?? null,
      trackingUrl: shipment.trackingUrl ?? null,
    };
  }
}

function assertShipmentsExpectedAfter({
  orderDate,
  shipments,
}: {
  orderDate: DeliveryDay;
  shipments: readonly { expectedDeliveryDate?: DeliveryDay }[];
}): void {
  for (const shipment of shipments) {
    assertExpectedDeliveryNotBeforeOrder({
      expectedDeliveryDate: shipment.expectedDeliveryDate,
      orderDate,
    });
  }
}

function toActiveOrderItemConflict(error: unknown): unknown {
  if (isUniqueConstraintErrorOn(error, ACTIVE_ORDER_ITEM_CONSTRAINT)) {
    return orderEntryError(ORDER_ENTRY_REJECTIONS.bookAlreadyOrdered);
  }
  return error;
}

function toNewOrderData(input: CreateBookOrderInput): NewBookOrderData {
  return {
    currency: input.currency ?? null,
    deliveryPrice: input.deliveryPrice ?? null,
    discount: input.discount ?? null,
    note: input.note ?? null,
    orderDate: toCreateDate(input.orderDate),
    orderNumber: input.orderNumber ?? null,
    storeName: input.storeName,
    totalAmount: input.totalAmount ?? null,
  };
}

function toOrderPatch(input: UpdateBookOrderInput): BookOrderPatch {
  return {
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.deliveryPrice === undefined ? {} : { deliveryPrice: input.deliveryPrice }),
    ...(input.discount === undefined ? {} : { discount: input.discount }),
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.orderDate === undefined ? {} : { orderDate: toUpdateDate(input.orderDate) ?? null }),
    ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
    ...(input.storeName === undefined ? {} : { storeName: input.storeName }),
    ...(input.totalAmount === undefined ? {} : { totalAmount: input.totalAmount }),
  };
}
