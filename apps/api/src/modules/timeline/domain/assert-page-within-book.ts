import type { Nullable } from "@app/shared";

import { TIMELINE_ERROR_CODES } from "@app/shared";

import { ValidationError } from "../../../core/exceptions/errors.js";

export function assertPageWithinBook({
  pageNumber,
  pagesCount,
}: {
  pageNumber: Nullable<number>;
  pagesCount: Nullable<number>;
}): void {
  if (pageNumber !== null && pagesCount !== null && pageNumber > pagesCount) {
    throw new ValidationError("The page number exceeds the book page count", {
      code: TIMELINE_ERROR_CODES.pageExceedsBook,
    });
  }
}
