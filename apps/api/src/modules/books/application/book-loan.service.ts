import type {
  BookView,
  CreateLoanInput,
  LoanDirection,
  OwnershipStatus,
  UpdateLoanInput,
} from "@app/shared";

import { OwnershipStatusSchema, ownershipStatusUsesLoan } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { GuardedChangeOutcome } from "../infrastructure/books.repository.js";

import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { buildLoanEditData, computeLoanChange } from "../domain/loan-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const BOOK_NOT_FOUND_MESSAGE = "Book not found";
const BORROW_REQUIRES_NONE_MESSAGE =
  'Book must have ownership status "none" or "want to buy" to be borrowed';
const LEND_REQUIRES_OWNED_MESSAGE = 'Book must have ownership status "owned" to be lent';
const RETURN_REQUIRES_LOAN_MESSAGE = "Book must be borrowed or lent to be returned";
const ACTIVE_LOAN_EXISTS_MESSAGE = "This book already has an active loan";
const LOAN_NOT_FOUND_MESSAGE = "Loan not found";

const LOAN_ACTIVE_OWNERSHIP_STATUSES: OwnershipStatus[] = [
  "borrowed_from_someone",
  "lent_to_someone",
];

@Injectable()
export class BookLoanService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async createLoan(userId: string, bookId: string, input: CreateLoanInput): Promise<BookView> {
    const guard = loanCreateGuard(input.direction);
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    if (!guard.expectedStatuses.includes(ownershipStatus)) {
      throw guard.conflictError;
    }

    const patch = computeLoanChange({
      fields: input,
      kind: "create",
      now: new Date(),
      ownershipStatus,
    });
    let outcome: GuardedChangeOutcome;
    try {
      outcome = await this.booksRepository.applyLoanChange(userId, bookId, patch, {
        expectedStatuses: guard.expectedStatuses,
      });
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError(ACTIVE_LOAN_EXISTS_MESSAGE),
      });
    }
    if (outcome === "not-found") {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
    }
    if (outcome === "status-conflict") {
      throw guard.conflictError;
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
    const outcome = await this.booksRepository.applyLoanChange(userId, bookId, patch, {
      expectedStatuses: LOAN_ACTIVE_OWNERSHIP_STATUSES,
    });
    if (outcome === "not-found") {
      throw new NotFoundError(BOOK_NOT_FOUND_MESSAGE);
    }
    if (outcome === "status-conflict") {
      throw new ConflictError(RETURN_REQUIRES_LOAN_MESSAGE);
    }

    return this.viewAssembler.loadView({ bookId, userId });
  }
}

function loanCreateGuard(direction: LoanDirection): {
  conflictError: ConflictError;
  expectedStatuses: OwnershipStatus[];
} {
  if (direction === "lent") {
    return {
      conflictError: new ConflictError(LEND_REQUIRES_OWNED_MESSAGE),
      expectedStatuses: ["owned"],
    };
  }
  return {
    conflictError: new ConflictError(BORROW_REQUIRES_NONE_MESSAGE),
    expectedStatuses: ["none", "want_to_buy"],
  };
}
