import type { Nullable, ValueOf } from "@app/shared";

import { assertNever } from "../../../core/assert-never.js";

const SPECIES_SIMILARITY = {
  closeSpellingMaxDistanceRatio: 0.6,
  distantNameScore: 0,
  maxEditDistanceEvaluations: 200,
  minContainedLength: 3,
  minSharedStemLength: 4,
} as const;

const NAME_MATCH = {
  contained: "contained",
  possibleSpelling: "possibleSpelling",
  sharedStem: "sharedStem",
} as const;

export type SpeciesMatchCandidate = {
  normalizedNames: readonly string[];
};

type NameComparison = {
  lengthDifference: number;
  longestLength: number;
  match: NameMatch;
  maxDistance: number;
  pair: SpelledPair;
};

type NameMatch = ValueOf<typeof NAME_MATCH>;

type NamePair = {
  left: string;
  right: string;
};

type ScoredCandidate<Candidate> = {
  candidate: Candidate;
  score: number;
};

type SpelledName = {
  chars: readonly string[];
  text: string;
};

type SpelledPair = {
  left: SpelledName;
  right: SpelledName;
};

export function findExactSpeciesMatch<Candidate extends SpeciesMatchCandidate>({
  candidates,
  normalizedName,
}: {
  candidates: readonly Candidate[];
  normalizedName: string;
}): Nullable<Candidate> {
  return candidates.find((candidate) => candidate.normalizedNames.includes(normalizedName)) ?? null;
}

export function findSimilarSpecies<Candidate extends SpeciesMatchCandidate>({
  candidates,
  limit,
  normalizedName,
}: {
  candidates: readonly Candidate[];
  limit: number;
  normalizedName: string;
}): Candidate[] {
  const query = spell(normalizedName);
  const comparisonsByCandidate = candidates.map((candidate) => ({
    candidate,
    comparisons: candidate.normalizedNames.includes(normalizedName)
      ? []
      : candidate.normalizedNames.flatMap((candidateName) => {
          const comparison = compareCheaply({ left: query, right: spell(candidateName) });
          return comparison === null ? [] : [comparison];
        }),
  }));
  const measurable = selectMeasurable(comparisonsByCandidate.flatMap((entry) => entry.comparisons));
  const scored: ScoredCandidate<Candidate>[] = [];

  for (const { candidate, comparisons } of comparisonsByCandidate) {
    const scores = comparisons.flatMap((comparison) => {
      const score = similarityScore({ comparison, measurable: measurable.has(comparison) });
      return score === null ? [] : [score];
    });
    if (scores.length === 0) continue;
    scored.push({ candidate, score: Math.max(...scores) });
  }

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

export function isSimilarSpeciesName(pair: NamePair): boolean {
  if (pair.left === pair.right) return false;
  const comparison = compareCheaply({ left: spell(pair.left), right: spell(pair.right) });
  return comparison !== null && similarityScore({ comparison, measurable: true }) !== null;
}

function boundedEditDistance({ maxDistance, pair }: NameComparison): Nullable<number> {
  const leftChars = pair.left.chars;
  const rightChars = pair.right.chars;
  if (Math.abs(leftChars.length - rightChars.length) > maxDistance) return null;

  const beyondCap = maxDistance + 1;
  let previousRow = Array.from({ length: rightChars.length + 1 }, (_, column) =>
    Math.min(column, beyondCap),
  );
  let currentRow = Array.from({ length: rightChars.length + 1 }, () => beyondCap);

  for (const [rowIndex, leftChar] of leftChars.entries()) {
    const row = rowIndex + 1;
    const firstColumn = Math.max(1, row - maxDistance);
    const lastColumn = Math.min(rightChars.length, row + maxDistance);
    const bandEdge = firstColumn === 1 ? Math.min(row, beyondCap) : beyondCap;
    currentRow[firstColumn - 1] = bandEdge;
    let rowMinimum = bandEdge;

    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const substitutionCost = leftChar === rightChars[column - 1] ? 0 : 1;
      const cell = Math.min(
        (previousRow[column] ?? beyondCap) + 1,
        (currentRow[column - 1] ?? beyondCap) + 1,
        (previousRow[column - 1] ?? beyondCap) + substitutionCost,
        beyondCap,
      );
      currentRow[column] = cell;
      rowMinimum = Math.min(rowMinimum, cell);
    }

    if (rowMinimum > maxDistance) return null;
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  const distance = previousRow[rightChars.length] ?? beyondCap;
  return distance > maxDistance ? null : distance;
}

function classifyMatch({
  lengthDifference,
  maxDistance,
  pair,
}: {
  lengthDifference: number;
  maxDistance: number;
  pair: SpelledPair;
}): Nullable<NameMatch> {
  if (oneContainsTheOther(pair)) return NAME_MATCH.contained;
  if (sharedStemLength(pair) >= SPECIES_SIMILARITY.minSharedStemLength) {
    return NAME_MATCH.sharedStem;
  }
  if (startWithSameCodePoint(pair) && lengthDifference <= maxDistance) {
    return NAME_MATCH.possibleSpelling;
  }
  return null;
}

function closeness({
  distance,
  longestLength,
}: {
  distance: number;
  longestLength: number;
}): number {
  return 1 - distance / longestLength;
}

function compareCheaply(pair: SpelledPair): Nullable<NameComparison> {
  const longestLength = Math.max(pair.left.chars.length, pair.right.chars.length);
  const lengthDifference = Math.abs(pair.left.chars.length - pair.right.chars.length);
  const maxDistance = Math.floor(SPECIES_SIMILARITY.closeSpellingMaxDistanceRatio * longestLength);
  const match = classifyMatch({ lengthDifference, maxDistance, pair });
  return match === null ? null : { lengthDifference, longestLength, match, maxDistance, pair };
}

function oneContainsTheOther({ left, right }: SpelledPair): boolean {
  const [shorter, longer] = left.text.length <= right.text.length ? [left, right] : [right, left];
  return (
    shorter.chars.length >= SPECIES_SIMILARITY.minContainedLength &&
    longer.text.includes(shorter.text)
  );
}

function selectMeasurable(comparisons: readonly NameComparison[]): ReadonlySet<NameComparison> {
  return new Set(
    comparisons
      .filter(
        (comparison) =>
          comparison.match !== NAME_MATCH.contained &&
          comparison.lengthDifference <= comparison.maxDistance,
      )
      .sort((left, right) => left.lengthDifference - right.lengthDifference)
      .slice(0, SPECIES_SIMILARITY.maxEditDistanceEvaluations),
  );
}

function sharedStemLength({ left, right }: SpelledPair): number {
  const firstDifference = left.chars.findIndex((char, index) => char !== right.chars[index]);
  return firstDifference === -1 ? left.chars.length : firstDifference;
}

function similarityScore({
  comparison,
  measurable,
}: {
  comparison: NameComparison;
  measurable: boolean;
}): Nullable<number> {
  const { lengthDifference, longestLength, match } = comparison;
  const measuredDistance = (): Nullable<number> =>
    measurable ? boundedEditDistance(comparison) : null;

  switch (match) {
    case NAME_MATCH.contained:
      return closeness({ distance: lengthDifference, longestLength });
    case NAME_MATCH.possibleSpelling: {
      const distance = measuredDistance();
      return distance === null ? null : closeness({ distance, longestLength });
    }
    case NAME_MATCH.sharedStem: {
      const distance = measuredDistance();
      return distance === null
        ? SPECIES_SIMILARITY.distantNameScore
        : closeness({ distance, longestLength });
    }
    default:
      return assertNever(match);
  }
}

function spell(text: string): SpelledName {
  return { chars: Array.from(text), text };
}

function startWithSameCodePoint({ left, right }: SpelledPair): boolean {
  return left.text.codePointAt(0) === right.text.codePointAt(0);
}
