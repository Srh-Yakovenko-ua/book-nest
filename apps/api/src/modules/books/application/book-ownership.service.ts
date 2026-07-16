import type { BookView, MarkBoughtInput, OwnershipStatus, WantToBuyInput } from "@app/shared";

import { STORE_LINK_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { ConflictError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { computeOwnershipChange } from "../domain/ownership-transition.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

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
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "want_to_buy") {
      throw new ConflictError(MARK_BOUGHT_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST,
      });
    }

    const date = input.purchasedAt ?? this.todayIso();
    const patch = computeOwnershipChange({ date, fields: input, kind: "mark-bought" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async markOwned(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "none" && book.ownershipStatus !== "want_to_buy") {
      throw new ConflictError(MARK_OWNED_MESSAGE);
    }

    const patch = computeOwnershipChange({ kind: "mark-owned" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async removeFromWishlist({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.ownershipStatus !== "want_to_buy") {
      throw new ConflictError(REMOVE_FROM_WISHLIST_MESSAGE, {
        code: STORE_LINK_ERROR_CODES.NOT_IN_WISHLIST,
      });
    }

    const patch = computeOwnershipChange({ kind: "remove-from-wishlist" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async removeOwned(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertOwnershipStatus(book, "owned", REMOVE_OWNED_MESSAGE);

    const patch = computeOwnershipChange({ kind: "remove-owned" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async wantToBuy(userId: string, bookId: string, input: WantToBuyInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertOwnershipStatus(book, "none", WANT_TO_BUY_MESSAGE);

    const patch = computeOwnershipChange({ fields: input, kind: "want-to-buy" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private assertOwnershipStatus(
    book: BookWithRelations,
    expected: OwnershipStatus,
    message: string,
  ): void {
    if (book.ownershipStatus !== expected) {
      throw new ConflictError(message);
    }
  }

  private todayIso(): string {
    return toIsoDate(new Date());
  }
}
