import type { OwnershipStatus, ReadingStatus, UpdateBookInput } from "@app/shared";

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

export function assertLoanPersonNamePresent({
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

  const payloadPersonName = input.loanInfo?.personName ?? "";
  const existingPersonName = current.loans[0]?.personName ?? "";
  if (payloadPersonName.length > 0 || existingPersonName.length > 0) {
    return;
  }

  throw new BadRequestError("Enter the person's name", {
    fields: [{ field: "loanInfo.personName", message: "Enter the person's name" }],
  });
}
