import type { Nullable } from "@app/shared";

import { addDaysToIsoDate, daysBetweenIsoDates, toZonedDayStart } from "./iso-date.js";

export const REDISCOVERY_POLICY = {
  ageScore: { matureFromDays: 180, matureScore: 2, oldFromDays: 365, oldScore: 3, youngScore: 0 },
  cooldown: { fallbackDays: 14, primaryDays: 30 },
  engagement: { favoriteAndSecondary: 4, favoriteOnly: 3, none: 0, secondaryOnly: 2 },
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

const SEED_SEPARATOR = ":";

export type RediscoveryCandidate = {
  createdOn: string;
  engagementScore: number;
  id: string;
  lastShownOn: Nullable<string>;
};

export type RediscoveryDiversity = {
  lastSourceKey: string;
  sourceKeyById: ReadonlyMap<string, string>;
};

export type RediscoveryPool<TCandidate extends RediscoveryHistory> = {
  candidates: TCandidate[];
  stage: RediscoveryPoolStage;
};

export type RediscoveryPoolStage =
  "cooldown_fallback" | "cooldown_primary" | "least_recently_shown";

export type RediscoverySelection = {
  candidates: RediscoveryCandidate[];
  diversity: Nullable<RediscoveryDiversity>;
  localDate: string;
  seedParts: readonly string[];
};

type RediscoveryHistory = {
  lastShownOn: Nullable<string>;
};

type ScoredCandidate = {
  daysSinceLastShown: Nullable<number>;
  id: string;
  totalScore: number;
};

export function ageScoreOf(ageDays: number): number {
  const { matureFromDays, matureScore, oldFromDays, oldScore, youngScore } =
    REDISCOVERY_POLICY.ageScore;
  if (ageDays >= oldFromDays) {
    return oldScore;
  }
  if (ageDays >= matureFromDays) {
    return matureScore;
  }
  return youngScore;
}

export function engagementScoreOf({
  hasSecondarySignal,
  isFavorite,
}: {
  hasSecondarySignal: boolean;
  isFavorite: boolean;
}): number {
  const { favoriteAndSecondary, favoriteOnly, none, secondaryOnly } = REDISCOVERY_POLICY.engagement;
  if (isFavorite && hasSecondarySignal) {
    return favoriteAndSecondary;
  }
  if (isFavorite) {
    return favoriteOnly;
  }
  if (hasSecondarySignal) {
    return secondaryOnly;
  }
  return none;
}

export function rankRediscoveryCandidates({
  candidates,
  localDate,
}: {
  candidates: RediscoveryCandidate[];
  localDate: string;
}): string[] {
  return rankScoredCandidates({ candidates, localDate }).map((entry) => entry.id);
}

export function rediscoveryCreationCutoff({
  localDate,
  timeZone,
}: {
  localDate: string;
  timeZone: string;
}): Date {
  const newestEligibleCreationDay = addDaysToIsoDate(localDate, -REDISCOVERY_POLICY.minimumAgeDays);
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
  } = REDISCOVERY_POLICY.rediscovery;
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

export function resolveRediscoveryPool<TCandidate extends RediscoveryHistory>({
  candidates,
  localDate,
}: {
  candidates: TCandidate[];
  localDate: string;
}): RediscoveryPool<TCandidate> {
  const { fallbackDays, primaryDays } = REDISCOVERY_POLICY.cooldown;

  const primary = candidates.filter((candidate) =>
    isOutsideCooldown({ cooldownDays: primaryDays, lastShownOn: candidate.lastShownOn, localDate }),
  );
  if (primary.length > 0) {
    return { candidates: primary, stage: "cooldown_primary" };
  }

  const fallback = candidates.filter((candidate) =>
    isOutsideCooldown({
      cooldownDays: fallbackDays,
      lastShownOn: candidate.lastShownOn,
      localDate,
    }),
  );
  if (fallback.length > 0) {
    return { candidates: fallback, stage: "cooldown_fallback" };
  }

  return { candidates, stage: "least_recently_shown" };
}

export function selectRediscoveryCandidateId({
  candidates,
  diversity,
  localDate,
  seedParts,
}: RediscoverySelection): Nullable<string> {
  if (candidates.length < REDISCOVERY_POLICY.minimumCandidates) {
    return null;
  }

  const top = rankScoredCandidates({ candidates, localDate }).slice(
    0,
    REDISCOVERY_POLICY.topPoolSize,
  );
  const seed = seedParts.join(SEED_SEPARATOR);
  const picked = top[seedIndex({ modulo: top.length, seed })];
  if (picked === undefined) {
    return null;
  }
  if (diversity === null) {
    return picked.id;
  }
  return diversifyWithinTopCohort({ diversity, picked, seed, top }).id;
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
  lastShownOn,
  localDate,
}: {
  lastShownOn: Nullable<string>;
  localDate: string;
}): Nullable<number> {
  if (lastShownOn === null) {
    return null;
  }
  return daysBetweenIsoDates({ endIsoDate: localDate, startIsoDate: lastShownOn });
}

function diversifyWithinTopCohort({
  diversity,
  picked,
  seed,
  top,
}: {
  diversity: RediscoveryDiversity;
  picked: ScoredCandidate;
  seed: string;
  top: ScoredCandidate[];
}): ScoredCandidate {
  const highestScore = Math.max(...top.map((entry) => entry.totalScore));
  const repeatsLastSource = (entry: ScoredCandidate): boolean =>
    diversity.sourceKeyById.get(entry.id) === diversity.lastSourceKey;
  if (picked.totalScore !== highestScore || !repeatsLastSource(picked)) {
    return picked;
  }

  const freshSources = top.filter(
    (entry) => entry.totalScore === highestScore && !repeatsLastSource(entry),
  );
  return freshSources[seedIndex({ modulo: freshSources.length, seed })] ?? picked;
}

function isOutsideCooldown({
  cooldownDays,
  lastShownOn,
  localDate,
}: {
  cooldownDays: number;
  lastShownOn: Nullable<string>;
  localDate: string;
}): boolean {
  const daysSinceLastShown = daysSinceLastShownOf({ lastShownOn, localDate });
  return daysSinceLastShown === null || daysSinceLastShown >= cooldownDays;
}

function rankScoredCandidates({
  candidates,
  localDate,
}: {
  candidates: RediscoveryCandidate[];
  localDate: string;
}): ScoredCandidate[] {
  const pool = resolveRediscoveryPool({ candidates, localDate });
  const scored = pool.candidates.map((candidate) => scoreCandidate({ candidate, localDate }));
  const compare = pool.stage === "least_recently_shown" ? compareByStaleness : compareByScore;
  return scored.sort(compare);
}

function scoreCandidate({
  candidate,
  localDate,
}: {
  candidate: RediscoveryCandidate;
  localDate: string;
}): ScoredCandidate {
  const daysSinceLastShown = daysSinceLastShownOf({
    lastShownOn: candidate.lastShownOn,
    localDate,
  });
  const ageDays = daysBetweenIsoDates({
    endIsoDate: localDate,
    startIsoDate: candidate.createdOn,
  });

  return {
    daysSinceLastShown,
    id: candidate.id,
    totalScore:
      candidate.engagementScore + ageScoreOf(ageDays) + rediscoveryScoreOf(daysSinceLastShown),
  };
}

function seedIndex({ modulo, seed }: { modulo: number; seed: string }): number {
  let hash: number = FNV_32.offsetBasis;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), FNV_32.prime);
  }
  return modulo === 0 ? 0 : Math.abs(hash % modulo);
}
