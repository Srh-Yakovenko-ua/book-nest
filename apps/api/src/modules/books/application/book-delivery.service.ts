import type {
  BookView,
  CancelDeliveryInput,
  CreateBookOrderInput,
  CreateDeliveryInput,
  DeliveryView,
  ReceiveDeliveryInput,
  UpdateDeliveryInput,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { SingleBookOrderPatch } from "../../delivery/index.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toUpdateDate } from "../../../core/iso-date.js";
import {
  BookOrderItemService,
  BookOrderItemsRepository,
  BookOrderService,
  DELIVERY_WRITE_MESSAGES,
  SingleBookOrderService,
  toBookDeliveryView,
} from "../../delivery/index.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const DELIVERY_NOT_FOUND_MESSAGE = "Delivery not found";

@Injectable()
export class BookDeliveryService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly bookOrderService: BookOrderService,
    private readonly bookOrderItemService: BookOrderItemService,
    private readonly bookOrderItemsRepository: BookOrderItemsRepository,
    private readonly singleBookOrderService: SingleBookOrderService,
  ) {}

  async cancel(
    userId: string,
    bookId: string,
    deliveryId: string,
    input: CancelDeliveryInput,
  ): Promise<BookView> {
    await this.assertActiveItem({ bookId, itemId: deliveryId, userId });
    await this.bookOrderItemService.cancel({ input, itemId: deliveryId, userId });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async create(userId: string, bookId: string, input: CreateDeliveryInput): Promise<BookView> {
    await this.bookOrderService.create({
      input: toSingleBookOrderInput({ bookId, input }),
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async listHistory(userId: string, bookId: string): Promise<DeliveryView[]> {
    await this.assertBookOwned({ bookId, userId });
    const items = await this.bookOrderItemsRepository.listForBook({ bookId, userId });

    return items.map(toBookDeliveryView);
  }

  async receive(
    userId: string,
    bookId: string,
    deliveryId: string,
    input: ReceiveDeliveryInput,
  ): Promise<BookView> {
    await this.assertActiveItem({ bookId, itemId: deliveryId, userId });
    const result = await this.bookOrderItemService.bulkReceive({
      input: {
        bookIds: [bookId],
        ...(input.receivedAt === undefined ? {} : { receivedAt: input.receivedAt }),
      },
      userId,
    });
    if (result.receivedBookIds.length === 0) {
      throw new ConflictError(DELIVERY_WRITE_MESSAGES.itemNoLongerActive);
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async update(
    userId: string,
    bookId: string,
    deliveryId: string,
    input: UpdateDeliveryInput,
  ): Promise<BookView> {
    await this.assertActiveItem({ bookId, itemId: deliveryId, userId });
    await this.singleBookOrderService.updateActiveItem({
      itemId: deliveryId,
      patch: toSingleBookOrderPatch(input),
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private async assertActiveItem({
    bookId,
    itemId,
    userId,
  }: {
    bookId: string;
    itemId: string;
    userId: string;
  }): Promise<void> {
    await this.assertBookOwned({ bookId, userId });

    const item = await this.bookOrderItemsRepository.findOwnedById({ itemId, userId });
    if (item === null || item.bookId !== bookId) {
      throw new NotFoundError(DELIVERY_NOT_FOUND_MESSAGE);
    }
    if (item.cancelledAt !== null || item.receivedAt !== null) {
      throw new ConflictError(DELIVERY_WRITE_MESSAGES.itemNoLongerActive);
    }
  }

  private async assertBookOwned({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<void> {
    const owned = await this.booksRepository.existsOwned({ bookId, userId });
    if (!owned) {
      throw new NotFoundError(DELIVERY_WRITE_MESSAGES.bookNotFound);
    }
  }
}

function toSingleBookOrderInput({
  bookId,
  input,
}: {
  bookId: string;
  input: CreateDeliveryInput;
}): CreateBookOrderInput {
  return {
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    items: [{ bookId, ...(input.price === undefined ? {} : { price: input.price }) }],
    ...(input.note === undefined ? {} : { note: input.note }),
    orderDate: input.orderDate,
    ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
    shipments: [
      {
        bookIds: [bookId],
        ...(input.deliveryService === undefined ? {} : { deliveryService: input.deliveryService }),
        ...(input.expectedDeliveryDate === undefined
          ? {}
          : { expectedDeliveryDate: input.expectedDeliveryDate }),
        ...(input.trackingNumber === undefined ? {} : { trackingNumber: input.trackingNumber }),
        ...(input.trackingUrl === undefined ? {} : { trackingUrl: input.trackingUrl }),
      },
    ],
    storeName: input.storeName,
  };
}

function toSingleBookOrderPatch(input: UpdateDeliveryInput): SingleBookOrderPatch {
  return {
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.deliveryService === undefined ? {} : { deliveryService: input.deliveryService }),
    ...(input.expectedDeliveryDate === undefined
      ? {}
      : { expectedDeliveryDate: toUpdateDate(input.expectedDeliveryDate) ?? null }),
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.orderDate === undefined ? {} : { orderDate: toUpdateDate(input.orderDate) ?? null }),
    ...(input.orderNumber === undefined ? {} : { orderNumber: input.orderNumber }),
    ...(input.price === undefined ? {} : { price: input.price }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.storeName === undefined ? {} : { storeName: input.storeName }),
    ...(input.trackingNumber === undefined ? {} : { trackingNumber: input.trackingNumber }),
    ...(input.trackingUrl === undefined ? {} : { trackingUrl: input.trackingUrl }),
  };
}
