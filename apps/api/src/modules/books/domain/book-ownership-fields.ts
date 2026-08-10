import type { Nullable, OwnershipStatus } from "@app/shared";

import type { BookOwnershipFields } from "../infrastructure/books.repository.js";

import { resolveWishlistAddedAtChange } from "./wishlist-added-at.js";

export function buildBookOwnershipFields({
  current,
  next,
  now,
}: {
  current: Nullable<OwnershipStatus>;
  next: OwnershipStatus;
  now: Date;
}): BookOwnershipFields {
  const change = resolveWishlistAddedAtChange({ current, next, now });
  if (change === null) {
    return { ownershipStatus: next };
  }

  return { ownershipStatus: next, wishlistAddedAt: change.wishlistAddedAt };
}
