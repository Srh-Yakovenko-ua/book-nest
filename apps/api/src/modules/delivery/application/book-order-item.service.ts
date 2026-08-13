import type {
  BookOrderView,
  BulkReceiveOrderItemsInput,
  BulkReceiveOrderItemsResultView,
  CancelBookOrderItemInput,
  Nullable,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { OrderItemBookRef } from "../infrastructure/book-order-items.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import {
  ORDER_ITEM_CANCEL_REJECTIONS,
  planOrderItemCancellation,
  RECEIVED_BOOK_OWNERSHIP,
} from "../domain/order-item-transition.js";
import { resolveShipmentReceivedAt } from "../domain/shipment-transition.js";
import { BookOrderItemsRepository } from "../infrastructure/book-order-items.repository.js";
import { OrderBooksRepository } from "../infrastructure/order-books.repository.js";
import { BookOrderViewLoader } from "./book-order-view.loader.js";
import { DELIVERY_WRITE_MESSAGES, orderItemCancelError } from "./delivery-write-errors.js";

@Injectable()
export class BookOrderItemService {
  constructor(
    private readonly bookOrderItemsRepository: BookOrderItemsRepository,
    private readonly orderBooksRepository: OrderBooksRepository,
    private readonly viewLoader: BookOrderViewLoader,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  bulkReceive({
    input,
    userId,
  }: {
    input: BulkReceiveOrderItemsInput;
    userId: string;
  }): Promise<BulkReceiveOrderItemsResultView> {
    const { bookIds, receivedAt } = input;
    const now = new Date();
    const requestedBookIds = [...new Set(bookIds)];

    return this.transactionRunner.run(async (tx) => {
      const ownedBookIds = new Set(
        (await this.orderBooksRepository.listOwned({ bookIds: requestedBookIds, userId }, tx)).map(
          (book) => book.id,
        ),
      );

      const received = await this.bookOrderItemsRepository.receiveForBooks(
        {
          bookIds: [...ownedBookIds],
          receivedAt: resolveShipmentReceivedAt({ now, receivedAt }),
          userId,
        },
        tx,
      );
      const receivedBookIds = new Set(received.map((item) => item.bookId));
      await this.orderBooksRepository.applyOwnership(
        {
          bookIds: [...receivedBookIds],
          now,
          ownershipStatus: RECEIVED_BOOK_OWNERSHIP.ownershipStatus,
          userId,
        },
        tx,
      );

      return toBulkReceiveResult({ ownedBookIds, receivedBookIds, requestedBookIds });
    });
  }

  cancel({
    input,
    itemId,
    userId,
  }: {
    input: CancelBookOrderItemInput;
    itemId: string;
    userId: string;
  }): Promise<BookOrderView> {
    const now = new Date();

    return this.transactionRunner.run(async (tx) => {
      const item = await this.bookOrderItemsRepository.findOwnedById({ itemId, userId }, tx);
      if (item === null) {
        throw new NotFoundError(DELIVERY_WRITE_MESSAGES.itemNotFound);
      }

      const plan = planOrderItemCancellation({
        cancelReason: input.cancelReason,
        item,
        keepAsWantToBuy: input.keepAsWantToBuy,
        now,
      });
      if (plan.outcome === "rejected") {
        throw orderItemCancelError(plan.reason);
      }

      const cancelled = await this.bookOrderItemsRepository.cancelOne(
        {
          cancelledAt: plan.cancellation.item.cancelledAt,
          cancelReason: plan.cancellation.item.cancelReason,
          itemId,
          userId,
        },
        tx,
      );
      if (cancelled === 0) {
        throw orderItemCancelError(ORDER_ITEM_CANCEL_REJECTIONS.alreadyCancelled);
      }

      await this.orderBooksRepository.applyOwnership(
        {
          bookIds: [plan.cancellation.bookId],
          now,
          ownershipStatus: plan.cancellation.book.ownershipStatus,
          userId,
        },
        tx,
      );

      return this.viewLoader.loadOrThrow({ orderId: item.orderId, userId }, tx);
    });
  }

  cancelActiveForBooks(
    {
      bookIds,
      cancelReason,
      now,
      userId,
    }: {
      bookIds: string[];
      cancelReason: Nullable<string>;
      now: Date;
      userId: string;
    },
    client: Prisma.TransactionClient,
  ): Promise<OrderItemBookRef[]> {
    return this.bookOrderItemsRepository.cancelActiveForBooks(
      { bookIds, cancelledAt: now, cancelReason, userId },
      client,
    );
  }
}

function toBulkReceiveResult({
  ownedBookIds,
  receivedBookIds,
  requestedBookIds,
}: {
  ownedBookIds: ReadonlySet<string>;
  receivedBookIds: ReadonlySet<string>;
  requestedBookIds: string[];
}): BulkReceiveOrderItemsResultView {
  const skipped: BulkReceiveOrderItemsResultView["skipped"] = [];
  const received: string[] = [];

  for (const bookId of requestedBookIds) {
    if (!ownedBookIds.has(bookId)) {
      skipped.push({ bookId, reason: "not_found" });
      continue;
    }
    if (!receivedBookIds.has(bookId)) {
      skipped.push({ bookId, reason: "not_active" });
      continue;
    }
    received.push(bookId);
  }

  return { receivedBookIds: received, skipped };
}
