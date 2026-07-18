import type {
  BookView,
  CreateLoanInput,
  LoanDirection,
  OwnershipStatus,
  UpdateLoanInput,
} from "@app/shared";

import { OwnershipStatusSchema, ownershipStatusUsesLoan } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { buildLoanEditData, computeLoanChange } from "../domain/loan-transition.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const BORROW_REQUIRES_NONE_MESSAGE =
  'Book must have ownership status "none" or "want to buy" to be borrowed';
const LEND_REQUIRES_OWNED_MESSAGE = 'Book must have ownership status "owned" to be lent';

const BORROW_ALLOWED_ORIGINS: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "none",
  "want_to_buy",
]);
const RETURN_REQUIRES_LOAN_MESSAGE = "Book must be borrowed or lent to be returned";
const ACTIVE_LOAN_EXISTS_MESSAGE = "This book already has an active loan";
const LOAN_NOT_FOUND_MESSAGE = "Loan not found";

@Injectable()
export class BookLoanService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async createLoan(userId: string, bookId: string, input: CreateLoanInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    this.assertLoanPrecondition(book, input.direction);

    const patch = computeLoanChange({ fields: input, kind: "create" });
    try {
      await this.booksRepository.applyLoanChange(userId, bookId, patch);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(ACTIVE_LOAN_EXISTS_MESSAGE);
      }
      throw error;
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async editLoan(userId: string, bookId: string, input: UpdateLoanInput): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const active = book.loans[0];
    if (active === undefined) {
      throw new NotFoundError(LOAN_NOT_FOUND_MESSAGE);
    }

    const data = buildLoanEditData({ existingLoanDate: active.loanDate, input });
    await this.booksRepository.updateActiveLoan(userId, bookId, data);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async returnLoan(userId: string, bookId: string): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!ownershipStatusUsesLoan(ownershipStatus)) {
      throw new ConflictError(RETURN_REQUIRES_LOAN_MESSAGE);
    }

    const patch = computeLoanChange({ kind: "return", now: new Date(), ownershipStatus });
    await this.booksRepository.applyLoanChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private assertLoanPrecondition(book: BookWithRelations, direction: LoanDirection): void {
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);

    if (direction === "lent") {
      if (ownershipStatus !== "owned") {
        throw new ConflictError(LEND_REQUIRES_OWNED_MESSAGE);
      }
      return;
    }

    if (!BORROW_ALLOWED_ORIGINS.has(ownershipStatus)) {
      throw new ConflictError(BORROW_REQUIRES_NONE_MESSAGE);
    }
  }
}
