import type {
  BulkActionResult,
  BulkBookIds,
  BulkFavoriteInput,
  BulkListsInput,
  BulkOwnershipStatusInput,
  BulkReadingStatusInput,
  BulkTagsInput,
  QueuePriority,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

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
import { BookCoverCleanup } from "./book-cover-cleanup.js";

const DEFAULT_QUEUE_PRIORITY: QueuePriority = "normal";

@Injectable()
export class BulkBooksService {
  constructor(
    private readonly bulkBooksRepository: BulkBooksRepository,
    private readonly tagsService: TagsService,
    private readonly listsService: ListsService,
    private readonly coverCleanup: BookCoverCleanup,
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
    const listIds = await this.listsService.resolveListsForBook({
      input: { listIds: input.listIds, newLists: input.newLists },
      userId,
    });
    if (listIds.length === 0) {
      return { affected: 0 };
    }
    const affected = await this.bulkBooksRepository.addToLists({
      bookIds: ownedBookIds,
      listIds,
      userId,
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
    const { affected, coverMediaIds } = await this.bulkBooksRepository.deleteOwned({
      bookIds: input.bookIds,
      userId,
    });
    await this.deleteOrphanedCovers({ coverMediaIds, userId });
    return { affected };
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

  private async deleteOrphanedCovers({
    coverMediaIds,
    userId,
  }: {
    coverMediaIds: string[];
    userId: string;
  }): Promise<void> {
    for (const mediaId of coverMediaIds) {
      await this.coverCleanup.deleteIfOrphaned({ mediaId, userId });
    }
  }
}
