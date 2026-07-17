import type {
  BookCharacterImportance,
  CharacterSummaryView,
  Nullable,
  SeriesCharactersSort,
} from "@app/shared";

export type SeriesAppearanceLike = {
  bookId: string;
  characterId: string;
  createdAt: Date;
};

export type SeriesBookLike = {
  id: string;
  partNumber: Nullable<number>;
};

export type SeriesContextBook = {
  id: string;
  partNumber: Nullable<number>;
};

const SERIES_IMPORTANCE_RANK: Record<BookCharacterImportance, number> = {
  central: 0,
  episodic: 3,
  major: 1,
  mentioned: 4,
  supporting: 2,
};

const SERIES_SUMMARY_COMPARATORS: Record<
  SeriesCharactersSort,
  (left: CharacterSummaryView, right: CharacterSummaryView) => number
> = {
  importance: (left, right) =>
    SERIES_IMPORTANCE_RANK[left.importance] - SERIES_IMPORTANCE_RANK[right.importance] ||
    left.name.localeCompare(right.name),
  name: (left, right) => left.name.localeCompare(right.name),
};

export function pickSeriesRepresentatives<Appearance extends SeriesAppearanceLike>({
  appearances,
  contextBookId,
  partNumberByBookId,
}: {
  appearances: Appearance[];
  contextBookId: string | undefined;
  partNumberByBookId: Map<string, Nullable<number>>;
}): Appearance[] {
  const byCharacter = new Map<string, Appearance>();
  for (const appearance of appearances) {
    const current = byCharacter.get(appearance.characterId);
    if (current === undefined) {
      byCharacter.set(appearance.characterId, appearance);
      continue;
    }
    byCharacter.set(
      appearance.characterId,
      chooseSeriesRepresentative({
        candidate: appearance,
        contextBookId,
        current,
        partNumberByBookId,
      }),
    );
  }
  return [...byCharacter.values()];
}

export function resolveAllowedBookIds({
  contextBook,
  includeFuture,
  seriesBooks,
}: {
  contextBook: Nullable<SeriesContextBook>;
  includeFuture: boolean;
  seriesBooks: SeriesBookLike[];
}): string[] {
  if (contextBook === null || includeFuture) {
    return seriesBooks.map((book) => book.id);
  }
  if (contextBook.partNumber === null) {
    return [contextBook.id];
  }
  const limit = contextBook.partNumber;
  return seriesBooks
    .filter((book) => book.partNumber !== null && book.partNumber <= limit)
    .map((book) => book.id);
}

export function sortSeriesSummaries({
  sort,
  summaries,
}: {
  sort: SeriesCharactersSort;
  summaries: CharacterSummaryView[];
}): CharacterSummaryView[] {
  return [...summaries].sort(SERIES_SUMMARY_COMPARATORS[sort]);
}

function chooseSeriesRepresentative<Appearance extends SeriesAppearanceLike>({
  candidate,
  contextBookId,
  current,
  partNumberByBookId,
}: {
  candidate: Appearance;
  contextBookId: string | undefined;
  current: Appearance;
  partNumberByBookId: Map<string, Nullable<number>>;
}): Appearance {
  if (contextBookId !== undefined) {
    if (candidate.bookId === contextBookId) {
      return candidate;
    }
    if (current.bookId === contextBookId) {
      return current;
    }
  }
  const byPartNumber = comparePartNumberDesc(
    partNumberByBookId.get(candidate.bookId) ?? null,
    partNumberByBookId.get(current.bookId) ?? null,
  );
  if (byPartNumber !== 0) {
    return byPartNumber < 0 ? candidate : current;
  }
  return candidate.createdAt >= current.createdAt ? candidate : current;
}

function comparePartNumberDesc(left: Nullable<number>, right: Nullable<number>): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return right - left;
}
