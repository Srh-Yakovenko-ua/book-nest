import type { Nullable } from "@app/shared";

import { addDaysToIsoDate, daysBetweenIsoDates, toZonedDayStart } from "../../../core/iso-date.js";

export const QUOTE_REDISCOVERY_POLICY = {
  ageScore: { matureFromDays: 180, matureScore: 2, oldFromDays: 365, oldScore: 3, youngScore: 0 },
  cooldown: { fallbackDays: 14, primaryDays: 30 },
  engagement: { commentOnly: 2, favoriteAndComment: 4, favoriteOnly: 3, none: 0 },
  minimumAgeDays: 30,
  minimumCandidates: 2,
  rediscovery: {
    distantFromDays: 180,
    distantScore: 2,
    neverShownScore: 3,
    recentScore: 0,
    returningFromDays: 60,
    returningScore: 1,
  },
  topPoolSize: 10,
} as const;

const FNV_32 = { offsetBasis: 0x811c9dc5, prime: 0x01000193 } as const;

export type QuoteRediscoveryCandidate = {
  createdOn: string;
  hasComment: boolean;
  id: string;
  isFavorite: boolean;
  lastShownOn: Nullable<string>;
};

export type QuoteRediscoveryPool = {
  candidates: QuoteRediscoveryCandidate[];
  stage: QuoteRediscoveryPoolStage;
};

export type QuoteRediscoveryPoolStage =
  "cooldown_fallback" | "cooldown_primary" | "least_recently_shown";

type ScoredCandidate = {
  daysSinceLastShown: Nullable<number>;
  id: string;
  totalScore: number;
};

export function ageScoreOf(ageDays: number): number {
  const { matureFromDays, matureScore, oldFromDays, oldScore, youngScore } =
    QUOTE_REDISCOVERY_POLICY.ageScore;
  if (ageDays >= oldFromDays) {
    return oldScore;
  }
  if (ageDays >= matureFromDays) {
    return matureScore;
  }
  return youngScore;
}

export function engagementScoreOf({
  hasComment,
  isFavorite,
}: {
  hasComment: boolean;
  isFavorite: boolean;
}): number {
  const { commentOnly, favoriteAndComment, favoriteOnly, none } =
    QUOTE_REDISCOVERY_POLICY.engagement;
  if (isFavorite && hasComment) {
    return favoriteAndComment;
  }
  if (isFavorite) {
    return favoriteOnly;
  }
  if (hasComment) {
    return commentOnly;
  }
  return none;
}

export function rankRediscoveryCandidates({
  candidates,
  localDate,
}: {
  candidates: QuoteRediscoveryCandidate[];
  localDate: string;
}): string[] {
  const pool = resolveRediscoveryPool({ candidates, localDate });
  const scored = pool.candidates.map((candidate) => scoreCandidate({ candidate, localDate }));
  const compare = pool.stage === "least_recently_shown" ? compareByStaleness : compareByScore;
  return scored.sort(compare).map((entry) => entry.id);
}

export function rediscoveryCreationCutoff({
  localDate,
  timeZone,
}: {
  localDate: string;
  timeZone: string;
}): Date {
  const newestEligibleCreationDay = addDaysToIsoDate(
    localDate,
    -QUOTE_REDISCOVERY_POLICY.minimumAgeDays,
  );
  return toZonedDayStart({ isoDate: addDaysToIsoDate(newestEligibleCreationDay, 1), timeZone });
}

export function rediscoveryScoreOf(daysSinceLastShown: Nullable<number>): number {
  const {
    distantFromDays,
    distantScore,
    neverShownScore,
    recentScore,
    returningFromDays,
    returningScore,
  } = QUOTE_REDISCOVERY_POLICY.rediscovery;
  if (daysSinceLastShown === null) {
    return neverShownScore;
  }
  if (daysSinceLastShown >= distantFromDays) {
    return distantScore;
  }
  if (daysSinceLastShown >= returningFromDays) {
    return returningScore;
  }
  return recentScore;
}

export function resolveRediscoveryPool({
  candidates,
  localDate,
}: {
  candidates: QuoteRediscoveryCandidate[];
  localDate: string;
}): QuoteRediscoveryPool {
  const { fallbackDays, primaryDays } = QUOTE_REDISCOVERY_POLICY.cooldown;

  const primary = candidates.filter((candidate) =>
    isOutsideCooldown({ candidate, cooldownDays: primaryDays, localDate }),
  );
  if (primary.length > 0) {
    return { candidates: primary, stage: "cooldown_primary" };
  }

  const fallback = candidates.filter((candidate) =>
    isOutsideCooldown({ candidate, cooldownDays: fallbackDays, localDate }),
  );
  if (fallback.length > 0) {
    return { candidates: fallback, stage: "cooldown_fallback" };
  }

  return { candidates, stage: "least_recently_shown" };
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
  if (candidates.length < QUOTE_REDISCOVERY_POLICY.minimumCandidates) {
    return null;
  }

  const top = rankRediscoveryCandidates({ candidates, localDate }).slice(
    0,
    QUOTE_REDISCOVERY_POLICY.topPoolSize,
  );
  const picked = top[seedIndex({ modulo: top.length, seed: `${userId}:${localDate}` })];
  return picked ?? null;
}

function compareByScore(first: ScoredCandidate, second: ScoredCandidate): number {
  const byScore = second.totalScore - first.totalScore;
  return byScore === 0 ? first.id.localeCompare(second.id) : byScore;
}

function compareByStaleness(first: ScoredCandidate, second: ScoredCandidate): number {
  if (first.daysSinceLastShown === null && second.daysSinceLastShown === null) {
    return compareByScore(first, second);
  }
  if (first.daysSinceLastShown === null) {
    return -1;
  }
  if (second.daysSinceLastShown === null) {
    return 1;
  }
  const byStaleness = second.daysSinceLastShown - first.daysSinceLastShown;
  return byStaleness === 0 ? compareByScore(first, second) : byStaleness;
}

function daysSinceLastShownOf({
  candidate,
  localDate,
}: {
  candidate: QuoteRediscoveryCandidate;
  localDate: string;
}): Nullable<number> {
  if (candidate.lastShownOn === null) {
    return null;
  }
  return daysBetweenIsoDates({ endIsoDate: localDate, startIsoDate: candidate.lastShownOn });
}

function isOutsideCooldown({
  candidate,
  cooldownDays,
  localDate,
}: {
  candidate: QuoteRediscoveryCandidate;
  cooldownDays: number;
  localDate: string;
}): boolean {
  const daysSinceLastShown = daysSinceLastShownOf({ candidate, localDate });
  return daysSinceLastShown === null || daysSinceLastShown >= cooldownDays;
}

function scoreCandidate({
  candidate,
  localDate,
}: {
  candidate: QuoteRediscoveryCandidate;
  localDate: string;
}): ScoredCandidate {
  const daysSinceLastShown = daysSinceLastShownOf({ candidate, localDate });
  const ageDays = daysBetweenIsoDates({
    endIsoDate: localDate,
    startIsoDate: candidate.createdOn,
  });

  return {
    daysSinceLastShown,
    id: candidate.id,
    totalScore:
      engagementScoreOf(candidate) + ageScoreOf(ageDays) + rediscoveryScoreOf(daysSinceLastShown),
  };
}

function seedIndex({ modulo, seed }: { modulo: number; seed: string }): number {
  let hash: number = FNV_32.offsetBasis;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), FNV_32.prime);
  }
  return modulo === 0 ? 0 : Math.abs(hash % modulo);
}
