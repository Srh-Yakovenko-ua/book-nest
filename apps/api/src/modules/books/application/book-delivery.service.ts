import type {
  BookView,
  CancelDeliveryInput,
  CreateDeliveryInput,
  DeliveryView,
  Nullable,
  OwnershipStatus,
  ReceiveDeliveryInput,
  UpdateDeliveryInput,
} from "@app/shared";

import { DeliveryStatusSchema, isActiveDeliveryStatus, OwnershipStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  CreateDeliveryOutcome,
  RecordDeliveryOutcome,
} from "../infrastructure/book-deliveries.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { DeliveryServicesService } from "../../delivery-services/index.js";
import {
  computeCancelDelivery,
  computeCreateDelivery,
  computeReceiveDelivery,
  computeUpdateDelivery,
} from "../domain/delivery-transition.js";
import { toDeliveryView } from "../domain/delivery.mapper.js";
import {
  BookDeliveriesRepository,
  type CreateDeliveryTransition,
} from "../infrastructure/book-deliveries.repository.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const ACTIVE_DELIVERY_EXISTS_MESSAGE = "This book already has an active delivery";
const ACTIVE_DELIVERY_CONFLICT_COLUMN = "book_id";
const START_DELIVERY_MESSAGE = "A delivery can only be started for a book you do not yet own";
const DELIVERY_NOT_ACTIVE_MESSAGE = "This delivery is no longer active";

const uniqueViolationConstraintSchema = z.object({
  meta: z.object({
    driverAdapterError: z.object({
      cause: z.object({
        constraint: z.object({ fields: z.array(z.string()) }),
      }),
    }),
  }),
});

function isActiveDeliveryConflict(error: unknown): boolean {
  if (!isUniqueConstraintError(error)) {
    return false;
  }
  const parsed = uniqueViolationConstraintSchema.safeParse(error);
  return (
    parsed.success &&
    parsed.data.meta.driverAdapterError.cause.constraint.fields.includes(
      ACTIVE_DELIVERY_CONFLICT_COLUMN,
    )
  );
}

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
    private readonly viewAssembler: BookViewAssembler,
    private readonly transactionRunner: TransactionRunner,
    private readonly deliveryServicesService: DeliveryServicesService,
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
      cancelReason: input.cancelReason,
      keepAsWantToBuy: input.keepAsWantToBuy,
      now: new Date(),
    });
    const outcome = await this.bookDeliveriesRepository.applyRecordChange(
      userId,
      bookId,
      deliveryId,
      transition,
    );
    this.ensureRecordChangeApplied(outcome);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async create(userId: string, bookId: string, input: CreateDeliveryInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertNoActiveDelivery(book);
    this.assertCanStartDelivery(book);

    const transition = computeCreateDelivery(input);
    const outcome = await this.applyCreate({
      bookId,
      deliveryService: input.deliveryService ?? null,
      transition,
      userId,
    });
    if (outcome === "book-not-found") {
      throw new NotFoundError("Book not found");
    }
    if (outcome === "status-conflict") {
      throw new ConflictError(START_DELIVERY_MESSAGE);
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async listHistory(userId: string, bookId: string): Promise<DeliveryView[]> {
    const deliveries = await this.bookDeliveriesRepository.listForOwnedBook({ bookId, userId });
    if (deliveries === null) {
      throw new NotFoundError("Book not found");
    }

    return deliveries.map(toDeliveryView);
  }

  async receive(
    userId: string,
    bookId: string,
    deliveryId: string,
    input: ReceiveDeliveryInput,
  ): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertActiveRecord(book, deliveryId);

    const transition = computeReceiveDelivery({ now: new Date(), receivedAt: input.receivedAt });
    const outcome = await this.bookDeliveriesRepository.applyRecordChange(
      userId,
      bookId,
      deliveryId,
      transition,
    );
    this.ensureRecordChangeApplied(outcome);

    return this.viewAssembler.loadView({ bookId, userId });
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
    const outcome = await this.transactionRunner.run(async (tx) => {
      await this.ensureCustomDeliveryService(
        { deliveryService: input.deliveryService ?? null, userId },
        tx,
      );
      return this.bookDeliveriesRepository.applyRecordChange(
        userId,
        bookId,
        deliveryId,
        transition,
        tx,
      );
    });
    this.ensureRecordChangeApplied(outcome);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private async applyCreate({
    bookId,
    deliveryService,
    transition,
    userId,
  }: {
    bookId: string;
    deliveryService: Nullable<string>;
    transition: CreateDeliveryTransition;
    userId: string;
  }): Promise<CreateDeliveryOutcome> {
    try {
      return await this.transactionRunner.run(async (tx) => {
        await this.ensureCustomDeliveryService({ deliveryService, userId }, tx);
        return this.bookDeliveriesRepository.applyCreate(
          userId,
          bookId,
          transition,
          [...START_DELIVERY_STATUSES],
          tx,
        );
      });
    } catch (error) {
      if (isActiveDeliveryConflict(error)) {
        throw new ConflictError(ACTIVE_DELIVERY_EXISTS_MESSAGE);
      }
      throw error;
    }
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

  private async ensureCustomDeliveryService(
    { deliveryService, userId }: { deliveryService: Nullable<string>; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    if (deliveryService === null) {
      return;
    }
    await this.deliveryServicesService.ensureCustomForName(
      { name: deliveryService, userId },
      client,
    );
  }

  private ensureRecordChangeApplied(outcome: RecordDeliveryOutcome): void {
    if (outcome === "not-found") {
      throw new NotFoundError("Delivery not found");
    }
    if (outcome === "not-active") {
      throw new ConflictError(DELIVERY_NOT_ACTIVE_MESSAGE);
    }
  }
}
