"use client";

import { FavoriteSeriesContinuationsBlock } from "./favorite-series-continuations-block";
import { FavoriteTopGenresBlock } from "./favorite-top-genres-block";
import { FavoritesUnratedBlock } from "./favorites-unrated-block";

export function FavoritesSidebar({ unrated }: { unrated: number }) {
  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0">
      <FavoritesUnratedBlock unrated={unrated} />
      <FavoriteSeriesContinuationsBlock />
      <FavoriteTopGenresBlock />
    </aside>
  );
}
