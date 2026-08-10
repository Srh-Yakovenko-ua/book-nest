import type { Nullable, UpdateBookInput } from "@app/shared";

import { OwnershipStatusSchema } from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { resolveFavoriteChange } from "./favorite.js";
import { resolveWishlistAddedAtChange } from "./wishlist-added-at.js";

type ScalarFieldKey = keyof Prisma.BookUncheckedUpdateManyInput & keyof UpdateBookInput;

const SCALAR_KEYS = [
  "ageCategory",
  "description",
  "formats",
  "genres",
  "illustrator",
  "isbn",
  "language",
  "originalTitle",
  "ownershipStatus",
  "pagesCount",
  "publicationYear",
  "readingStatus",
  "title",
  "translator",
] as const satisfies readonly ScalarFieldKey[];

export function applyDedicationFields({
  current,
  fields,
  input,
}: {
  current: BookWithRelations;
  fields: Prisma.BookUncheckedUpdateManyInput;
  input: UpdateBookInput;
}): void {
  const dedication =
    input.dedication === undefined ? current.dedication : normalizeDedication(input.dedication);

  if (input.dedication !== undefined) {
    fields.dedication = dedication;
  }

  if (dedication !== null) {
    return;
  }

  const favoriteAfterPatch = input.isFavoriteDedication ?? current.isFavoriteDedication;
  if (favoriteAfterPatch) {
    fields.isFavoriteDedication = false;
  }
}

export function applyFavoriteDedicationFields({
  fields,
  input,
}: {
  fields: Prisma.BookUncheckedUpdateManyInput;
  input: UpdateBookInput;
}): void {
  if (input.isFavoriteDedication === undefined) {
    return;
  }

  fields.isFavoriteDedication = input.isFavoriteDedication;
}

export function applyFavoriteFields({
  current,
  fields,
  input,
  now,
}: {
  current: BookWithRelations;
  fields: Prisma.BookUncheckedUpdateManyInput;
  input: UpdateBookInput;
  now: Date;
}): void {
  if (input.isFavorite === undefined) {
    return;
  }

  const change = resolveFavoriteChange({
    current: current.isFavorite,
    next: input.isFavorite,
    now,
  });
  if (change === null) {
    return;
  }

  fields.isFavorite = change.isFavorite;
  fields.favoriteAddedAt = change.favoriteAddedAt;
}

export function applyWishlistFields({
  current,
  fields,
  input,
  now,
}: {
  current: BookWithRelations;
  fields: Prisma.BookUncheckedUpdateManyInput;
  input: UpdateBookInput;
  now: Date;
}): void {
  if (input.ownershipStatus === undefined) {
    return;
  }

  const change = resolveWishlistAddedAtChange({
    current: OwnershipStatusSchema.parse(current.ownershipStatus),
    next: input.ownershipStatus,
    now,
  });
  if (change === null) {
    return;
  }

  fields.wishlistAddedAt = change.wishlistAddedAt;
}

export function assignScalarFields({
  fields,
  input,
}: {
  fields: Prisma.BookUncheckedUpdateManyInput;
  input: UpdateBookInput;
}): void {
  for (const key of SCALAR_KEYS) {
    const value = input[key];
    if (value !== undefined) {
      Object.assign(fields, { [key]: value });
    }
  }
}

export function normalizeDedication(value: Nullable<string>): Nullable<string> {
  if (value === null || value.length === 0) {
    return null;
  }
  return value;
}
