import type { Nullable } from "@app/shared";

import { compareDesc } from "date-fns";

import { addDaysToIsoDate } from "../../../core/iso-date.js";

export const QUOTE_POST_FINISH_POLICY = { windowDays: 30 } as const;

export type PostFinishCandidate = {
  bookId: string;
  finishedAt: Date;
  id: string;
};

export type PostFinishQuoteCounts = {
  favoritesCount: number;
  quotesCount: number;
  withCommentCount: number;
};

export type PostFinishSelection = {
  candidate: PostFinishCandidate;
  counts: PostFinishQuoteCounts;
};

export type PostFinishWindow = {
  earliestFinishedOn: string;
  latestFinishedOn: string;
};

export function postFinishWindow(today: string): PostFinishWindow {
  return {
    earliestFinishedOn: addDaysToIsoDate(today, -QUOTE_POST_FINISH_POLICY.windowDays),
    latestFinishedOn: today,
  };
}

export function selectPostFinishCandidate({
  candidates,
  countsByBookId,
}: {
  candidates: PostFinishCandidate[];
  countsByBookId: Map<string, PostFinishQuoteCounts>;
}): Nullable<PostFinishSelection> {
  const ordered = [...candidates].sort(compareByCompletionRecency);

  for (const candidate of ordered) {
    const counts = countsByBookId.get(candidate.bookId);
    if (counts !== undefined && counts.quotesCount > 0) {
      return { candidate, counts };
    }
  }

  return null;
}

function compareByCompletionRecency(
  first: PostFinishCandidate,
  second: PostFinishCandidate,
): number {
  const byFinishedAt = compareDesc(first.finishedAt, second.finishedAt);
  return byFinishedAt === 0 ? first.id.localeCompare(second.id) : byFinishedAt;
}
