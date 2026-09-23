import type { GenreStatsView } from "@app/shared";

import type { GenreAggregate } from "./genre-aggregate.js";

export function toGenreStatsView({
  coverUrls,
  genre,
}: {
  coverUrls: string[];
  genre: GenreAggregate;
}): GenreStatsView {
  return {
    averageRating: genre.averageRating,
    booksCount: genre.booksCount,
    coverUrls,
    groupKey: genre.groupKey,
    groupName: genre.groupName,
    key: genre.key,
    label: genre.label,
    ratedBooksCount: genre.ratedBooksCount,
    readCount: genre.readCount,
    readingQueueCount: genre.readingQueueCount,
    wantToBuyCount: genre.wantToBuyCount,
  };
}
