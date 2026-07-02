import type { BookView, OwnershipStatus, WantToBuyInput } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ConflictError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { computeOwnershipChange } from "../domain/ownership-transition.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BooksService } from "./books.service.js";

const MARK_OWNED_MESSAGE = 'Book must have ownership status "none" to be marked as owned';
const REMOVE_OWNED_MESSAGE = 'Book must have ownership status "owned" to remove ownership';
const WANT_TO_BUY_MESSAGE = 'Book must have ownership status "none" to be marked as want to buy';
const MARK_BOUGHT_MESSAGE = 'Book must have ownership status "want_to_buy" to be marked as bought';

@Injectable()
export class BookOwnershipService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly booksService: BooksService,
  ) {}

  async markBought(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertOwnershipStatus(book, "want_to_buy", MARK_BOUGHT_MESSAGE);

    const patch = computeOwnershipChange({ date: this.todayIso(), kind: "mark-bought" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.booksService.getById(userId, bookId);
  }

  async markOwned(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertOwnershipStatus(book, "none", MARK_OWNED_MESSAGE);

    const patch = computeOwnershipChange({ kind: "mark-owned" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.booksService.getById(userId, bookId);
  }

  async removeOwned(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertOwnershipStatus(book, "owned", REMOVE_OWNED_MESSAGE);

    const patch = computeOwnershipChange({ kind: "remove-owned" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.booksService.getById(userId, bookId);
  }

  async wantToBuy(userId: string, bookId: string, input: WantToBuyInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertOwnershipStatus(book, "none", WANT_TO_BUY_MESSAGE);

    const patch = computeOwnershipChange({ fields: input, kind: "want-to-buy" });
    await this.booksRepository.applyOwnershipChange(userId, bookId, patch);

    return this.booksService.getById(userId, bookId);
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
