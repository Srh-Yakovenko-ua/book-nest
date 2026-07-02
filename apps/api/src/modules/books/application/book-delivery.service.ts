import type {
  BookView,
  CancelDeliveryInput,
  CreateDeliveryInput,
  DeliveryView,
  OwnershipStatus,
  UpdateDeliveryInput,
} from "@app/shared";

import { DeliveryStatusSchema, isActiveDeliveryStatus, OwnershipStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import {
  computeCancelDelivery,
  computeCreateDelivery,
  computeReceiveDelivery,
  computeUpdateDelivery,
} from "../domain/delivery-transition.js";
import { toDeliveryView } from "../domain/delivery.mapper.js";
import { BookDeliveriesRepository } from "../infrastructure/book-deliveries.repository.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BooksService } from "./books.service.js";

const ACTIVE_DELIVERY_EXISTS_MESSAGE = "This book already has an active delivery";
const START_DELIVERY_MESSAGE = "A delivery can only be started for a book you do not yet own";
const DELIVERY_NOT_ACTIVE_MESSAGE = "This delivery is no longer active";

const START_DELIVERY_STATUSES: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "in_transit",
  "none",
  "want_to_buy",
]);

@Injectable()
export class BookDeliveryService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookDeliveriesRepository: BookDeliveriesRepository,
    private readonly booksService: BooksService,
  ) {}

  async cancel(
    userId: string,
    bookId: string,
    deliveryId: string,
    input: CancelDeliveryInput,
  ): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertActiveRecord(book, deliveryId);

    const transition = computeCancelDelivery({
      keepAsWantToBuy: input.keepAsWantToBuy,
      now: new Date(),
    });
    await this.bookDeliveriesRepository.applyRecordChange(userId, bookId, deliveryId, transition);

    return this.booksService.getById(userId, bookId);
  }

  async create(userId: string, bookId: string, input: CreateDeliveryInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertNoActiveDelivery(book);
    this.assertCanStartDelivery(book);

    const transition = computeCreateDelivery(input);
    try {
      await this.bookDeliveriesRepository.applyCreate(userId, bookId, transition);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(ACTIVE_DELIVERY_EXISTS_MESSAGE);
      }
      throw error;
    }

    return this.booksService.getById(userId, bookId);
  }

  async listHistory(userId: string, bookId: string): Promise<DeliveryView[]> {
    const deliveries = await this.bookDeliveriesRepository.listForOwnedBook({ bookId, userId });
    if (deliveries === null) {
      throw new NotFoundError("Book not found");
    }

    return deliveries.map(toDeliveryView);
  }

  async receive(userId: string, bookId: string, deliveryId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertActiveRecord(book, deliveryId);

    const transition = computeReceiveDelivery(new Date());
    await this.bookDeliveriesRepository.applyRecordChange(userId, bookId, deliveryId, transition);

    return this.booksService.getById(userId, bookId);
  }

  async update(
    userId: string,
    bookId: string,
    deliveryId: string,
    input: UpdateDeliveryInput,
  ): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertActiveRecord(book, deliveryId);

    const transition = computeUpdateDelivery(input);
    await this.bookDeliveriesRepository.applyRecordChange(userId, bookId, deliveryId, transition);

    return this.booksService.getById(userId, bookId);
  }

  private assertActiveRecord(book: BookWithRelations, deliveryId: string): void {
    const record = book.deliveries.find((delivery) => delivery.id === deliveryId);
    if (record === undefined) {
      throw new NotFoundError("Delivery not found");
    }
    if (!isActiveDeliveryStatus(DeliveryStatusSchema.parse(record.status))) {
      throw new ConflictError(DELIVERY_NOT_ACTIVE_MESSAGE);
    }
  }

  private assertCanStartDelivery(book: BookWithRelations): void {
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!START_DELIVERY_STATUSES.has(ownershipStatus)) {
      throw new ConflictError(START_DELIVERY_MESSAGE);
    }
  }

  private assertNoActiveDelivery(book: BookWithRelations): void {
    const active = book.deliveries.find((delivery) =>
      isActiveDeliveryStatus(DeliveryStatusSchema.parse(delivery.status)),
    );
    if (active !== undefined) {
      throw new ConflictError(ACTIVE_DELIVERY_EXISTS_MESSAGE);
    }
  }
}
