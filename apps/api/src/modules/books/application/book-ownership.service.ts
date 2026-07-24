import type { BookView, MarkBoughtInput, OwnershipStatus, WantToBuyInput } from "@app/shared";

import { STORE_LINK_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { OwnershipChangePatch } from "../infrastructure/books.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { computeOwnershipChange } from "../domain/ownership-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const MARK_OWNED_MESSAGE =
  'Book must have ownership status "none" or "want_to_buy" to be marked as owned';
const REMOVE_OWNED_MESSAGE = 'Book must have ownership status "owned" to remove ownership';
const WANT_TO_BUY_MESSAGE = 'Book must have ownership status "none" to be marked as want to buy';
const MARK_BOUGHT_MESSAGE = 'Book must have ownership status "want_to_buy" to be marked as bought';
const REMOVE_FROM_WISHLIST_MESSAGE =
  'Book must have ownership status "want_to_buy" to be removed from the wishlist';

@Injectable()
export class BookOwnershipService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async markBought(userId: string, bookId: string, input: MarkBoughtInput): Promise<BookView> {
    const conflictError = new ConflictError(MARK_BOUGHT_MESSAGE, {
      code: STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST,
    });
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "want_to_buy") {
      throw conflictError;
    }

    const date = input.purchasedAt ?? this.todayIso();
    const patch = computeOwnershipChange({ date, fields: input, kind: "mark-bought" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["want_to_buy"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async markOwned(userId: string, bookId: string): Promise<BookView> {
    const conflictError = new ConflictError(MARK_OWNED_MESSAGE);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "none" && book.ownershipStatus !== "want_to_buy") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "mark-owned" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["none", "want_to_buy"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async removeFromWishlist({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookView> {
    const conflictError = new ConflictError(REMOVE_FROM_WISHLIST_MESSAGE, {
      code: STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST,
    });
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "want_to_buy") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "remove-from-wishlist" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["want_to_buy"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async removeOwned(userId: string, bookId: string): Promise<BookView> {
    const conflictError = new ConflictError(REMOVE_OWNED_MESSAGE);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "owned") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ kind: "remove-owned" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["owned"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async wantToBuy(userId: string, bookId: string, input: WantToBuyInput): Promise<BookView> {
    const conflictError = new ConflictError(WANT_TO_BUY_MESSAGE);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "none") {
      throw conflictError;
    }

    const patch = computeOwnershipChange({ fields: input, kind: "want-to-buy" });
    await this.applyGuardedOwnershipChange({
      bookId,
      conflictError,
      expectedStatuses: ["none"],
      patch,
      userId,
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private async applyGuardedOwnershipChange({
    bookId,
    conflictError,
    expectedStatuses,
    patch,
    userId,
  }: {
    bookId: string;
    conflictError: ConflictError;
    expectedStatuses: OwnershipStatus[];
    patch: OwnershipChangePatch;
    userId: string;
  }): Promise<void> {
    const outcome = await this.booksRepository.applyOwnershipChange(userId, bookId, patch, {
      expectedStatuses,
    });
    if (outcome === "not-found") {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
    }
    if (outcome === "status-conflict") {
      throw conflictError;
    }
  }

  private todayIso(): string {
    return toIsoDate(new Date());
  }
}
