import type { HomeNextReadCandidate, Nullable } from "@app/shared";

import { HomeNextReadBookStatusSchema } from "@app/shared";

import type { HomeBookFacts } from "./home-book.mapper.js";
import type { NextReadPick } from "./next-read-ranking.js";

export function toNextReadCandidate({
  facts,
  pick,
}: {
  facts: HomeBookFacts;
  pick: NextReadPick;
}): Nullable<HomeNextReadCandidate> {
  const readingStatus = HomeNextReadBookStatusSchema.safeParse(facts.readingStatus);
  if (!readingStatus.success) {
    return null;
  }

  return {
    action: readingStatus.data === "paused" ? "resume" : "start",
    book: {
      authors: facts.authors,
      cover: facts.cover,
      currentPage: facts.currentPage,
      id: facts.id,
      isFavorite: facts.isFavorite,
      ownershipStatus: facts.ownershipStatus,
      pagesCount: facts.pagesCount,
      progressPercent: facts.progressPercent,
      readingStatus: readingStatus.data,
      title: facts.title,
    },
    queue: facts.queue,
    reason: pick.reason,
    series: facts.series,
    source: pick.source,
  };
}
