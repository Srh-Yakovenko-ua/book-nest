import type { MediaView, Nullable, PostFinishQuotesView } from "@app/shared";

import type { PostFinishCandidate, PostFinishQuoteCounts } from "./quote-post-finish.js";

import { toIsoDate } from "../../../core/iso-date.js";

export function toPostFinishQuotesView({
  book,
  candidate,
  counts,
  cover,
}: {
  book: { firstAuthorName: string; id: string; title: string };
  candidate: PostFinishCandidate;
  counts: PostFinishQuoteCounts;
  cover: Nullable<MediaView>;
}): PostFinishQuotesView {
  return {
    book: {
      cover,
      firstAuthorName: book.firstAuthorName,
      id: book.id,
      title: book.title,
    },
    favoritesCount: counts.favoritesCount,
    finishedAt: toIsoDate(candidate.finishedAt),
    quotesCount: counts.quotesCount,
    readingCycleId: candidate.id,
    withCommentCount: counts.withCommentCount,
  };
}
