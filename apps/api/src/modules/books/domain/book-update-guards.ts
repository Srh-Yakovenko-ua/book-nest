import type { OwnershipStatus, ReadingStatus, UpdateBookInput } from "@app/shared";

import { hasLoanPersonIdentity, LOAN_PERSON_REQUIRED_MESSAGE } from "@app/shared";

import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { ownershipStatusUsesLoan, readingStatusUsesProgress } from "./book-blocks.js";

export function assertCurrentPageWithinPages({
  current,
  input,
  readingStatus,
}: {
  current: BookWithRelations;
  input: UpdateBookInput;
  readingStatus: ReadingStatus;
}): void {
  if (!readingStatusUsesProgress(readingStatus)) {
    return;
  }

  const currentPage =
    input.readingProgress?.currentPage ?? current.readingProgress?.currentPage ?? null;
  const pagesCount = input.pagesCount === undefined ? current.pagesCount : input.pagesCount;

  if (currentPage !== null && pagesCount !== null && currentPage > pagesCount) {
    throw new BadRequestError("Current page cannot exceed the page count", {
      fields: [
        {
          field: "readingProgress.currentPage",
          message: "Current page cannot exceed the page count",
        },
      ],
    });
  }
}

export function assertLoanPersonPresent({
  current,
  input,
  ownershipStatus,
}: {
  current: BookWithRelations;
  input: UpdateBookInput;
  ownershipStatus: OwnershipStatus;
}): void {
  if (!ownershipStatusUsesLoan(ownershipStatus)) {
    return;
  }
  if (hasLoanPersonIdentity(input.loanInfo ?? {}) || current.loans[0] !== undefined) {
    return;
  }

  throw new BadRequestError(LOAN_PERSON_REQUIRED_MESSAGE, {
    fields: [{ field: "loanInfo.personName", message: LOAN_PERSON_REQUIRED_MESSAGE }],
  });
}
