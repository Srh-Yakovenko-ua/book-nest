import type {
  BookCharacterImportance,
  BookCharacterImportanceCounts,
  BookCharacterSummaryView,
  CharacterSummaryView,
  Nullable,
  SeriesCharacterSummaryView,
} from "@app/shared";

import { BookCharacterImportanceSchema, CHARACTER_SUMMARY_TOP_LIMIT } from "@app/shared";

const IMPORTANCE_RANK: Record<BookCharacterImportance, number> = {
  central: 0,
  episodic: 3,
  major: 1,
  mentioned: 4,
  supporting: 2,
};

const TOP_IMPORTANCES: ReadonlySet<BookCharacterImportance> = new Set(["central", "major"]);

type ImportanceCountEntry = {
  count: number;
  importance: string;
};

type SummaryFields = {
  byImportance: BookCharacterImportanceCounts;
  favoritesCount: number;
  povCount: number;
  top: CharacterSummaryView[];
  totalVisibleCharacters: number;
};

export function buildBookCharacterSummary({
  bookId,
  byImportanceEntries,
  favoritesCount,
  hasHiddenRecords,
  povCount,
  topCandidates,
  totalVisibleCharacters,
}: {
  bookId: string;
  byImportanceEntries: ImportanceCountEntry[];
  favoritesCount: number;
  hasHiddenRecords: boolean;
  povCount: number;
  topCandidates: CharacterSummaryView[];
  totalVisibleCharacters: number;
}): BookCharacterSummaryView {
  return {
    ...assembleSummaryFields({
      byImportanceEntries,
      favoritesCount,
      povCount,
      topCandidates,
      totalVisibleCharacters,
    }),
    bookId,
    hasHiddenRecords,
  };
}

export function buildSeriesCharacterSummary({
  byImportanceEntries,
  contextBookId,
  favoritesCount,
  hasHiddenRecords,
  povCount,
  seriesId,
  topCandidates,
  totalVisibleCharacters,
}: {
  byImportanceEntries: ImportanceCountEntry[];
  contextBookId: Nullable<string>;
  favoritesCount: number;
  hasHiddenRecords: boolean;
  povCount: number;
  seriesId: string;
  topCandidates: CharacterSummaryView[];
  totalVisibleCharacters: number;
}): SeriesCharacterSummaryView {
  return {
    ...assembleSummaryFields({
      byImportanceEntries,
      favoritesCount,
      povCount,
      topCandidates,
      totalVisibleCharacters,
    }),
    contextBookId,
    hasHiddenRecords,
    seriesId,
  };
}

export function isTopImportance(importance: string): boolean {
  return TOP_IMPORTANCES.has(BookCharacterImportanceSchema.parse(importance));
}

function assembleSummaryFields({
  byImportanceEntries,
  favoritesCount,
  povCount,
  topCandidates,
  totalVisibleCharacters,
}: {
  byImportanceEntries: ImportanceCountEntry[];
  favoritesCount: number;
  povCount: number;
  topCandidates: CharacterSummaryView[];
  totalVisibleCharacters: number;
}): SummaryFields {
  return {
    byImportance: toImportanceCounts(byImportanceEntries),
    favoritesCount,
    povCount,
    top: selectTopCharacters(topCandidates),
    totalVisibleCharacters,
  };
}

function selectTopCharacters(candidates: CharacterSummaryView[]): CharacterSummaryView[] {
  return [...candidates]
    .filter((candidate) => TOP_IMPORTANCES.has(candidate.importance))
    .sort(
      (left, right) =>
        IMPORTANCE_RANK[left.importance] - IMPORTANCE_RANK[right.importance] ||
        left.name.localeCompare(right.name),
    )
    .slice(0, CHARACTER_SUMMARY_TOP_LIMIT);
}

function toImportanceCounts(entries: ImportanceCountEntry[]): BookCharacterImportanceCounts {
  const counts: BookCharacterImportanceCounts = {
    central: 0,
    episodic: 0,
    major: 0,
    mentioned: 0,
    supporting: 0,
  };
  for (const entry of entries) {
    counts[BookCharacterImportanceSchema.parse(entry.importance)] += entry.count;
  }
  return counts;
}
