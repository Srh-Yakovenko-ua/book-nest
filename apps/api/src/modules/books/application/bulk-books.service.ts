import type {
  BulkActionResult,
  BulkBookIds,
  BulkFavoriteInput,
  BulkListsInput,
  BulkOwnershipStatusInput,
  BulkPagesCountInput,
  BulkPagesCountResult,
  BulkReadingStatusInput,
  BulkTagsInput,
  QueuePriority,
} from "@app/shared";

import { Injectable } from "@nestjs/common";
import { parseISO } from "date-fns";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError } from "../../../core/exceptions/errors.js";
import { ListsService } from "../../lists/index.js";
import { TagsService } from "../../tags/index.js";
import {
  ownershipStatusKeepsPurchase,
  ownershipStatusUsesDelivery,
  ownershipStatusUsesLoan,
  readingStatusUsesProgress,
} from "../domain/book-blocks.js";
import { BulkBooksRepository } from "../infrastructure/bulk-books.repository.js";
import { BookPurgeScheduler } from "./book-purge.scheduler.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";

@Injectable()
export class BulkBooksService {
  constructor(
    private readonly bulkBooksRepository: BulkBooksRepository,
    private readonly tagsService: TagsService,
    private readonly listsService: ListsService,
    private readonly purgeScheduler: BookPurgeScheduler,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async addTags({
    input,
    userId,
  }: {
    input: BulkTagsInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const ownedBookIds = await this.bulkBooksRepository.findOwnedIds({
      bookIds: input.bookIds,
      userId,
    });
    if (ownedBookIds.length === 0) {
      return { affected: 0 };
    }
    const tagIds = await this.tagsService.resolveOrCreateMany(userId, input.tags);
    if (tagIds.length === 0) {
      return { affected: 0 };
    }
    const affected = await this.bulkBooksRepository.addTags({
      bookIds: ownedBookIds,
      tagIds,
      userId,
    });
    return { affected };
  }

  async addToLists({
    input,
    userId,
  }: {
    input: BulkListsInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const ownedBookIds = await this.bulkBooksRepository.findOwnedIds({
      bookIds: input.bookIds,
      userId,
    });
    if (ownedBookIds.length === 0) {
      return { affected: 0 };
    }

    const affected = await this.transactionRunner.run(async (tx) => {
      const listIds = await this.listsService.resolveListsForBook(
        { input: { listIds: input.listIds, newLists: input.newLists }, userId },
        tx,
      );
      if (listIds.length === 0) {
        return 0;
      }
      return this.bulkBooksRepository.addToLists(
        { bookIds: ownedBookIds, listIds, now: new Date(), userId },
        tx,
      );
    });
    return { affected };
  }

  async addToReadingQueue({
    input,
    userId,
  }: {
    input: BulkBookIds;
    userId: string;
  }): Promise<BulkActionResult> {
    const affected = await this.bulkBooksRepository.addToReadingQueue({
      bookIds: input.bookIds,
      queuePriority: DEFAULT_QUEUE_PRIORITY,
      userId,
    });
    return { affected };
  }

  async delete({
    input,
    userId,
  }: {
    input: BulkBookIds;
    userId: string;
  }): Promise<BulkActionResult> {
    const deletedIds = await this.bulkBooksRepository.softDelete({
      bookIds: input.bookIds,
      deletedAt: new Date(),
      userId,
    });
    await this.purgeScheduler.scheduleMany({ bookIds: deletedIds, userId });
    return { affected: deletedIds.length };
  }

  async setFavorite({
    input,
    userId,
  }: {
    input: BulkFavoriteInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const affected = await this.bulkBooksRepository.setFavorite({
      bookIds: input.bookIds,
      isFavorite: input.isFavorite,
      now: new Date(),
      userId,
    });
    return { affected };
  }

  async setOwnershipStatus({
    input,
    userId,
  }: {
    input: BulkOwnershipStatusInput;
    userId: string;
  }): Promise<BulkActionResult> {
    if (ownershipStatusUsesLoan(input.ownershipStatus)) {
      throw new BadRequestError(
        "A loan status requires a per-book borrower; set it on each book individually",
      );
    }

    const affected = await this.bulkBooksRepository.setOwnershipStatus({
      bookIds: input.bookIds,
      clearDelivery: !ownershipStatusUsesDelivery(input.ownershipStatus),
      clearLoan: true,
      clearPurchase: !ownershipStatusKeepsPurchase(input.ownershipStatus),
      now: new Date(),
      ownershipStatus: input.ownershipStatus,
      userId,
    });
    return { affected };
  }

  async setReadingStatus({
    input,
    userId,
  }: {
    input: BulkReadingStatusInput;
    userId: string;
  }): Promise<BulkActionResult> {
    const affected = await this.bulkBooksRepository.setReadingStatus({
      bookIds: input.bookIds,
      clearProgress: !readingStatusUsesProgress(input.readingStatus),
      readingStatus: input.readingStatus,
      userId,
    });
    return { affected };
  }

  async updatePagesCount({
    input,
    userId,
  }: {
    input: BulkPagesCountInput;
    userId: string;
  }): Promise<BulkPagesCountResult> {
    return this.transactionRunner.run(async (tx) => {
      const bookIds = input.items.map((item) => item.bookId);
      const snapshots = await this.bulkBooksRepository.findPagesCountSnapshots(
        { bookIds, userId },
        tx,
      );
      const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));

      const failed: BulkPagesCountResult["failed"] = [];
      const updated: string[] = [];

      for (const item of input.items) {
        const snapshot = snapshotById.get(item.bookId);
        if (snapshot === undefined) {
          failed.push({ bookId: item.bookId, reason: "not_found" });
          continue;
        }
        if (snapshot.updatedAt.toISOString() !== item.expectedUpdatedAt) {
          failed.push({ bookId: item.bookId, reason: "stale" });
          continue;
        }
        const expectedUpdatedAt = parseISO(item.expectedUpdatedAt);
        if (item.kind === "pages_count") {
          if (snapshot.currentPage !== null && snapshot.currentPage > item.pagesCount) {
            failed.push({ bookId: item.bookId, reason: "below_current_page" });
            continue;
          }
          const changed = await this.bulkBooksRepository.setPagesCount(
            { bookId: item.bookId, expectedUpdatedAt, pagesCount: item.pagesCount, userId },
            tx,
          );
          if (changed === 0) {
            failed.push({ bookId: item.bookId, reason: "stale" });
            continue;
          }
          updated.push(item.bookId);
          continue;
        }
        const changed = await this.bulkBooksRepository.markPagesCountUnavailable(
          { bookId: item.bookId, expectedUpdatedAt, userId },
          tx,
        );
        if (changed === 0) {
          failed.push({ bookId: item.bookId, reason: "stale" });
          continue;
        }
        updated.push(item.bookId);
      }

      return { failed, updated };
    });
  }
}
