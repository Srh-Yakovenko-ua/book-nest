import type { Nullable } from "@app/shared";

import type { RediscoveryCandidate } from "../../../core/rediscovery.js";

import {
  rankRediscoveryCandidates as rankGenericRediscoveryCandidates,
  REDISCOVERY_POLICY,
  engagementScoreOf as rediscoveryEngagementScoreOf,
  selectRediscoveryCandidateId,
} from "../../../core/rediscovery.js";

export {
  ageScoreOf,
  rediscoveryCreationCutoff,
  rediscoveryScoreOf,
  resolveRediscoveryPool,
} from "../../../core/rediscovery.js";

export const QUOTE_REDISCOVERY_POLICY = REDISCOVERY_POLICY;

export type QuoteRediscoveryCandidate = {
  createdOn: string;
  hasComment: boolean;
  id: string;
  isFavorite: boolean;
  lastShownOn: Nullable<string>;
};

export function engagementScoreOf({
  hasComment,
  isFavorite,
}: {
  hasComment: boolean;
  isFavorite: boolean;
}): number {
  return rediscoveryEngagementScoreOf({ hasSecondarySignal: hasComment, isFavorite });
}

export function rankRediscoveryCandidates({
  candidates,
  localDate,
}: {
  candidates: QuoteRediscoveryCandidate[];
  localDate: string;
}): string[] {
  return rankGenericRediscoveryCandidates({
    candidates: candidates.map(toRediscoveryCandidate),
    localDate,
  });
}

export function selectRediscoveryQuoteId({
  candidates,
  localDate,
  userId,
}: {
  candidates: QuoteRediscoveryCandidate[];
  localDate: string;
  userId: string;
}): Nullable<string> {
  return selectRediscoveryCandidateId({
    candidates: candidates.map(toRediscoveryCandidate),
    diversity: null,
    localDate,
    seedParts: [userId, localDate],
  });
}

function toRediscoveryCandidate(candidate: QuoteRediscoveryCandidate): RediscoveryCandidate {
  return {
    createdOn: candidate.createdOn,
    engagementScore: engagementScoreOf(candidate),
    id: candidate.id,
    lastShownOn: candidate.lastShownOn,
  };
}
