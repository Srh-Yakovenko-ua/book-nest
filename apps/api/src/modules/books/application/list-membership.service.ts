import type {
  AddBooksToListInput,
  AddBooksToListResult,
  MoveListBookDirection,
  MoveListBookInput,
  RemoveBooksFromListInput,
  RemoveBooksFromListResult,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isForeignKeyConstraintError } from "../../../core/prisma-errors.js";
import { ListsService } from "../../lists/index.js";
import {
  LIST_LIMITS,
  ListMembershipRepository,
} from "../infrastructure/list-membership.repository.js";

const BOOK_NOT_IN_LIST_MESSAGE = "Book is not in this list";
const LIST_NOT_FOUND_MESSAGE = "List not found";
const ALREADY_AT_TOP_MESSAGE = "Book is already at the top";
const ALREADY_AT_BOTTOM_MESSAGE = "Book is already at the bottom";
const LIST_TOO_LARGE_TO_REORDER_MESSAGE = `A list with more than ${LIST_LIMITS.reorderMax} books cannot be reordered`;

type AddBooksInput = {
  input: AddBooksToListInput;
  listId: string;
  userId: string;
};

type MoveBookInput = {
  bookId: string;
  input: MoveListBookInput;
  listId: string;
  userId: string;
};

type MoveByStepInput = {
  bookId: string;
  direction: MoveListBookDirection;
  listId: string;
  now: Date;
  userId: string;
};

type MoveToIndexInput = {
  bookId: string;
  listId: string;
  now: Date;
  targetPosition: number;
  userId: string;
};

type RemoveBookInput = {
  bookId: string;
  listId: string;
  userId: string;
};

type RemoveBooksInput = {
  input: RemoveBooksFromListInput;
  listId: string;
  userId: string;
};

@Injectable()
export class ListMembershipService {
  constructor(
    private readonly listsService: ListsService,
    private readonly membershipRepository: ListMembershipRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async addBooks({ input, listId, userId }: AddBooksInput): Promise<AddBooksToListResult> {
    await this.listsService.assertOwned({ listId, userId });
    const now = new Date();

    return this.transactionRunner.run(async (tx) => {
      await this.membershipRepository.acquireListLock(tx, { listId });

      const ownedIds = new Set(
        await this.membershipRepository.findOwnedBookIds(tx, { bookIds: input.bookIds, userId }),
      );
      const orderedOwnedIds = dedupeInOrder(input.bookIds.filter((bookId) => ownedIds.has(bookId)));

      const before = await this.membershipRepository.countItems(tx, { listId });
      try {
        for (const bookId of orderedOwnedIds) {
          await this.membershipRepository.append(tx, { bookId, listId });
        }
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          throw new NotFoundError(LIST_NOT_FOUND_MESSAGE);
        }
        throw error;
      }
      const bookCount = await this.membershipRepository.countItems(tx, { listId });
      const added = bookCount - before;

      if (added > 0) {
        await this.membershipRepository.touchList(tx, { listId, now, userId });
      }

      return { added, bookCount };
    });
  }

  async moveBook({ bookId, input, listId, userId }: MoveBookInput): Promise<void> {
    await this.listsService.assertOwned({ listId, userId });
    const now = new Date();

    if (input.kind === "step") {
      await this.moveByStep({ bookId, direction: input.direction, listId, now, userId });
      return;
    }

    await this.moveToIndex({ bookId, listId, now, targetPosition: input.position, userId });
  }

  async removeBook({ bookId, listId, userId }: RemoveBookInput): Promise<void> {
    await this.listsService.assertOwned({ listId, userId });
    const now = new Date();

    await this.transactionRunner.run(async (tx) => {
      await this.membershipRepository.acquireListLock(tx, { listId });

      const membership = await this.membershipRepository.findMembership(tx, { bookId, listId });
      if (membership === null) {
        throw new NotFoundError(BOOK_NOT_IN_LIST_MESSAGE);
      }

      await this.membershipRepository.deleteMembership(tx, { bookId, listId });
      await this.membershipRepository.shiftUpAfter(tx, { listId, position: membership.position });

      await this.membershipRepository.touchList(tx, { listId, now, userId });
    });
  }

  async removeBooks({
    input,
    listId,
    userId,
  }: RemoveBooksInput): Promise<RemoveBooksFromListResult> {
    await this.listsService.assertOwned({ listId, userId });
    const now = new Date();

    return this.transactionRunner.run(async (tx) => {
      await this.membershipRepository.acquireListLock(tx, { listId });

      const removed = await this.membershipRepository.deleteMemberships(tx, {
        bookIds: dedupeInOrder(input.bookIds),
        listId,
        userId,
      });
      if (removed > 0) {
        await this.membershipRepository.resequence(tx, { listId });
        await this.membershipRepository.touchList(tx, { listId, now, userId });
      }

      return { bookCount: await this.membershipRepository.countItems(tx, { listId }), removed };
    });
  }

  private async moveByStep({
    bookId,
    direction,
    listId,
    now,
    userId,
  }: MoveByStepInput): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      await this.membershipRepository.acquireListLock(tx, { listId });

      const membership = await this.membershipRepository.findMembership(tx, { bookId, listId });
      if (membership === null) {
        throw new NotFoundError(BOOK_NOT_IN_LIST_MESSAGE);
      }

      const neighbor = await this.membershipRepository.findNeighbor(tx, {
        direction,
        listId,
        position: membership.position,
      });
      if (neighbor === null) {
        throw new BadRequestError(
          direction === "up" ? ALREADY_AT_TOP_MESSAGE : ALREADY_AT_BOTTOM_MESSAGE,
        );
      }

      await this.membershipRepository.setPosition(tx, {
        bookId: membership.bookId,
        listId,
        position: neighbor.position,
      });
      await this.membershipRepository.setPosition(tx, {
        bookId: neighbor.bookId,
        listId,
        position: membership.position,
      });

      await this.membershipRepository.touchList(tx, { listId, now, userId });
    });
  }

  private async moveToIndex({
    bookId,
    listId,
    now,
    targetPosition,
    userId,
  }: MoveToIndexInput): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      await this.membershipRepository.acquireListLock(tx, { listId });

      const memberships = await this.membershipRepository.findActiveMemberships(tx, { listId });
      if (memberships.length > LIST_LIMITS.reorderMax) {
        throw new BadRequestError(LIST_TOO_LARGE_TO_REORDER_MESSAGE);
      }

      const moved = memberships.find((membership) => membership.bookId === bookId);
      if (moved === undefined) {
        throw new NotFoundError(BOOK_NOT_IN_LIST_MESSAGE);
      }

      const others = memberships.filter((membership) => membership.bookId !== bookId);
      const maxIndex = others.length;
      const targetIndex = Math.min(Math.max(targetPosition - 1, 0), maxIndex);
      const reordered = [...others.slice(0, targetIndex), moved, ...others.slice(targetIndex)];

      await this.membershipRepository.applyPositions(tx, {
        listId,
        positions: reordered.map((membership, index) => ({
          bookId: membership.bookId,
          position: index + 1,
        })),
      });

      await this.membershipRepository.touchList(tx, { listId, now, userId });
    });
  }
}

function dedupeInOrder(bookIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const bookId of bookIds) {
    if (seen.has(bookId)) {
      continue;
    }
    seen.add(bookId);
    result.push(bookId);
  }
  return result;
}
