import type { BookListsView, SetBookListsInput } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BookListsRepository } from "../infrastructure/book-lists.repository.js";
import { ListMembershipRepository } from "../infrastructure/list-membership.repository.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";

type BookScopeInput = {
  bookId: string;
  userId: string;
};

type SetListsInput = {
  bookId: string;
  input: SetBookListsInput;
  userId: string;
};

@Injectable()
export class BookListsService {
  constructor(
    private readonly bookListsRepository: BookListsRepository,
    private readonly membershipRepository: ListMembershipRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async getLists({ bookId, userId }: BookScopeInput): Promise<BookListsView> {
    await this.assertBookOwned({ bookId, userId });
    return this.buildView({ bookId, userId });
  }

  async setLists({ bookId, input, userId }: SetListsInput): Promise<BookListsView> {
    await this.assertBookOwned({ bookId, userId });
    const now = new Date();
    const requestedIds = [...new Set(input.listIds)];

    await this.transactionRunner.run(async (tx) => {
      const ownedTargetIds =
        requestedIds.length === 0
          ? []
          : await this.bookListsRepository.findOwnedListIds(tx, { listIds: requestedIds, userId });
      const targetSet = new Set(ownedTargetIds);

      const currentIds = await this.membershipRepository.findMembershipListIds(tx, { bookId });
      const currentSet = new Set(currentIds);

      const toAdd = ownedTargetIds.filter((listId) => !currentSet.has(listId));
      const toRemove = currentIds.filter((listId) => !targetSet.has(listId));

      const affectedIds = [...new Set([...toAdd, ...toRemove])].sort();
      for (const listId of affectedIds) {
        await this.membershipRepository.acquireListLock(tx, { listId });
      }

      for (const listId of toAdd) {
        await this.membershipRepository.append(tx, { bookId, listId });
      }

      for (const listId of toRemove) {
        const membership = await this.membershipRepository.findMembership(tx, { bookId, listId });
        if (membership === null) {
          continue;
        }
        await this.membershipRepository.deleteMembership(tx, { bookId, listId });
        await this.membershipRepository.shiftUpAfter(tx, { listId, position: membership.position });
      }

      for (const listId of affectedIds) {
        await this.membershipRepository.touchList(tx, { listId, now, userId });
      }
    });

    return this.buildView({ bookId, userId });
  }

  private async assertBookOwned({ bookId, userId }: BookScopeInput): Promise<void> {
    const owned = await this.bookListsRepository.bookBelongsToUser({ bookId, userId });
    if (!owned) {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
    }
  }

  private async buildView({ bookId, userId }: BookScopeInput): Promise<BookListsView> {
    const lists = await this.bookListsRepository.findListsWithMembership({ bookId, userId });
    return {
      lists: lists.map((list) => ({
        bookCount: list._count.items,
        id: list.id,
        isMember: list.items.length > 0,
        name: list.name,
      })),
    };
  }
}
