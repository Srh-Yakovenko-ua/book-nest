import type { ListGenreFacet, ListOverviewView } from "@app/shared";

type CurrentlyReadingBook = NonNullable<ListOverviewView["currentlyReading"]>["book"];

type CurrentlyReadingInput = {
  book: CurrentlyReadingBook | undefined;
  readingCount: number;
};

type GenreCountRow = {
  count: number;
  key: string;
};

export const LIST_OVERVIEW = {
  relatedListsLimit: 10,
  topGenresLimit: 3,
} as const;

export function buildCurrentlyReading({
  book,
  readingCount,
}: CurrentlyReadingInput): ListOverviewView["currentlyReading"] {
  if (book === undefined) {
    return null;
  }
  return { book, othersCount: Math.max(0, readingCount - 1) };
}

export function countDistinctGenres(rows: GenreCountRow[]): number {
  return new Set(rows.map((row) => row.key)).size;
}

export function nameGenreFacets({
  nameByKey,
  rows,
}: {
  nameByKey: Map<string, string>;
  rows: GenreCountRow[];
}): ListGenreFacet[] {
  return rows.map((row) => ({
    count: row.count,
    key: row.key,
    name: nameByKey.get(row.key) ?? row.key,
  }));
}

export function selectTopGenres({
  limit,
  nameByKey,
  rows,
}: {
  limit: number;
  nameByKey: Map<string, string>;
  rows: GenreCountRow[];
}): ListGenreFacet[] {
  return nameGenreFacets({ nameByKey, rows: rows.slice(0, limit) });
}
