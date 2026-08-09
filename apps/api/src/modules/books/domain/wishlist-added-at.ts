import type { Nullable, OwnershipStatus } from "@app/shared";

const WISHLIST_STATUS: OwnershipStatus = "want_to_buy";

export function wishlistAddedAtOnCreate({
  now,
  ownershipStatus,
}: {
  now: Date;
  ownershipStatus: OwnershipStatus;
}): Nullable<Date> {
  return ownershipStatus === WISHLIST_STATUS ? now : null;
}

export function wishlistAddedAtOnTransition({
  current,
  next,
  now,
}: {
  current: OwnershipStatus;
  next: OwnershipStatus;
  now: Date;
}): Nullable<Date> | undefined {
  if (next === current) return undefined;
  if (next === WISHLIST_STATUS) return now;
  if (current === WISHLIST_STATUS) return null;
  return undefined;
}
