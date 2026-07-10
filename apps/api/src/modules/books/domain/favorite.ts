import type { Nullable } from "@app/shared";

type FavoriteChange = {
  favoriteAddedAt: Nullable<Date>;
  isFavorite: boolean;
};

export function resolveFavoriteChange({
  current,
  next,
  now,
}: {
  current: boolean;
  next: boolean;
  now: Date;
}): Nullable<FavoriteChange> {
  if (next === current) {
    return null;
  }
  return { favoriteAddedAt: next ? now : null, isFavorite: next };
}
