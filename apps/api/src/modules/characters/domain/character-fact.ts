import type { CharacterFactView, Nullable } from "@app/shared";

import { CHARACTER_FACT_ERROR_CODES } from "@app/shared";

import type { CharacterFactModel } from "../../../generated/prisma/models.js";

import { ValidationError } from "../../../core/exceptions/errors.js";

export function assertFactPageWithinBook({
  page,
  pagesCount,
}: {
  page: Nullable<number>;
  pagesCount: Nullable<number>;
}): void {
  if (page !== null && pagesCount !== null && page > pagesCount) {
    throw new ValidationError("The page number exceeds the book page count", {
      code: CHARACTER_FACT_ERROR_CODES.pageExceedsBook,
    });
  }
}

export function toCharacterFactView(fact: CharacterFactModel): CharacterFactView {
  return {
    chapter: fact.chapter,
    createdAt: fact.createdAt.toISOString(),
    id: fact.id,
    page: fact.page,
    text: fact.text,
    title: fact.title,
    updatedAt: fact.updatedAt.toISOString(),
  };
}
