import type { CatalogLocale, Nullable, ValueOf } from "@app/shared";

export const SPECIES_QUERY_TUNING = {
  ownRecentLimit: 2,
  popularKeys: [
    "human",
    "elf",
    "dwarf",
    "orc",
    "vampire",
    "werewolf",
    "dragon",
    "demon",
    "angel",
    "witch",
  ],
  similarLimit: 5,
} as const;

const SPECIES_MATCH_RANK = {
  contains: 3,
  exact: 0,
  prefix: 1,
  wordPrefix: 2,
} as const;

const WORD_SEPARATORS = [" ", "-"] as const;

const SPECIES_NAME_COLLATORS: Record<CatalogLocale, Intl.Collator> = {
  en: new Intl.Collator("en"),
  uk: new Intl.Collator("uk"),
};

export type SpeciesSearchCandidate = {
  displayName: string;
  id: string;
  normalizedNames: readonly string[];
};

type RankedCandidate<Candidate> = {
  candidate: Candidate;
  rank: SpeciesMatchRank;
};

type SpeciesMatchRank = ValueOf<typeof SPECIES_MATCH_RANK>;

export function rankSpeciesMatches<Candidate extends SpeciesSearchCandidate>({
  candidates,
  limit,
  locale,
  normalizedQuery,
}: {
  candidates: readonly Candidate[];
  limit: number;
  locale: CatalogLocale;
  normalizedQuery: string;
}): Candidate[] {
  const collator = SPECIES_NAME_COLLATORS[locale];
  return candidates
    .map((candidate) => ({
      candidate,
      rank: bestMatchRank({ names: candidate.normalizedNames, query: normalizedQuery }),
    }))
    .filter((ranked): ranked is RankedCandidate<Candidate> => ranked.rank !== null)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        collator.compare(left.candidate.displayName, right.candidate.displayName) ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, limit)
    .map((ranked) => ranked.candidate);
}

export function speciesNormalizedNames(species: {
  names: readonly { normalizedName: string }[];
  normalizedName: string;
}): string[] {
  return [
    species.normalizedName,
    ...species.names.map((speciesName) => speciesName.normalizedName),
  ];
}

function bestMatchRank({
  names,
  query,
}: {
  names: readonly string[];
  query: string;
}): Nullable<SpeciesMatchRank> {
  let best: Nullable<SpeciesMatchRank> = null;
  for (const name of names) {
    const rank = matchRank({ name, query });
    if (rank !== null && (best === null || rank < best)) {
      best = rank;
    }
  }
  return best;
}

function matchRank({ name, query }: { name: string; query: string }): Nullable<SpeciesMatchRank> {
  if (name === query) return SPECIES_MATCH_RANK.exact;
  if (name.startsWith(query)) return SPECIES_MATCH_RANK.prefix;
  if (WORD_SEPARATORS.some((separator) => name.includes(`${separator}${query}`))) {
    return SPECIES_MATCH_RANK.wordPrefix;
  }
  if (name.includes(query)) return SPECIES_MATCH_RANK.contains;
  return null;
}
