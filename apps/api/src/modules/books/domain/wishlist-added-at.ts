import type { Nullable, OwnershipStatus } from "@app/shared";

export const WISHLIST_OWNERSHIP_STATUS: OwnershipStatus = "want_to_buy";

type WishlistAddedAtChange = {
  wishlistAddedAt: Nullable<Date>;
};

export function resolveWishlistAddedAtChange({
  current,
  next,
  now,
}: {
  current: Nullable<OwnershipStatus>;
  next: OwnershipStatus;
  now: Date;
}): Nullable<WishlistAddedAtChange> {
  const leaves = current === WISHLIST_OWNERSHIP_STATUS;
  const enters = next === WISHLIST_OWNERSHIP_STATUS;

  if (leaves === enters) {
    return null;
  }

  return { wishlistAddedAt: enters ? now : null };
}
