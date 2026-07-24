import type { GenreStatsView, GenreView, Nullable } from "@app/shared";

export type GenreCardItem = {
  averageRating: Nullable<number>;
  booksCount: number;
  coverUrls: string[];
  groupKey: Nullable<string>;
  groupName: Nullable<string>;
  hiddenBooksCount: number;
  key: string;
  label: string;
  progressPercent: number;
  readCount: number;
  readingQueueCount: number;
};

export type GenreFilter = "all" | "finished" | "in_queue" | "unread";

export type GenreGroupOption = {
  key: string;
  name: string;
};

export type GenreSort =
  "books_count_desc" | "name_asc" | "queue_count_desc" | "rating_desc" | "read_count_desc";

export const GENRE_FILTERS = [
  "all",
  "unread",
  "in_queue",
  "finished",
] as const satisfies readonly GenreFilter[];

export const GENRE_SORT_OPTIONS = [
  "books_count_desc",
  "name_asc",
  "read_count_desc",
  "queue_count_desc",
  "rating_desc",
] as const satisfies readonly GenreSort[];

export const GENRE_SORT_DEFAULT: GenreSort = "books_count_desc";

export const GENRE_GROUP_ALL = "all";

export const GENRE_PREVIEW_LIMIT = 8;

export const GENRE_COVER_LIMIT = 4;

export function filterGenres({
  filter,
  group,
  items,
  search,
}: {
  filter: GenreFilter;
  group: string;
  items: GenreCardItem[];
  search: string;
}): GenreCardItem[] {
  const normalized = search.trim().toLowerCase().replace(/\s+/g, " ");

  return items.filter((item) => {
    if (group !== GENRE_GROUP_ALL && item.groupKey !== group) return false;
    if (!matchesGenreFilter(item, filter)) return false;
    if (normalized.length === 0) return true;
    return item.label.toLowerCase().includes(normalized);
  });
}

export function genreCoverPreview(item: GenreCardItem): string[] {
  return item.coverUrls.slice(0, GENRE_COVER_LIMIT);
}

export function genreGroupOptions(items: GenreCardItem[]): GenreGroupOption[] {
  const groups = new Map<string, string>();
  for (const item of items) {
    if (item.groupKey === null || item.groupName === null) continue;
    if (groups.has(item.groupKey)) continue;
    groups.set(item.groupKey, item.groupName);
  }
  return [...groups].map(([key, name]) => ({ key, name }));
}

export function sortGenres({
  items,
  sort,
}: {
  items: GenreCardItem[];
  sort: GenreSort;
}): GenreCardItem[] {
  return [...items].sort(GENRE_SORT_COMPARATORS[sort]);
}

export function toGenreCards({
  genres,
  stats,
}: {
  genres: GenreView[];
  stats: GenreStatsView[];
}): GenreCardItem[] {
  const groupByKey = new Map(genres.map((genre) => [genre.key, genre]));

  return stats.map((entry) => {
    const group = groupByKey.get(entry.key);
    const shownCovers = entry.coverUrls.slice(0, GENRE_COVER_LIMIT);

    return {
      averageRating: entry.averageRating,
      booksCount: entry.booksCount,
      coverUrls: entry.coverUrls,
      groupKey: group?.groupKey ?? null,
      groupName: group?.groupName ?? null,
      hiddenBooksCount: Math.max(0, entry.booksCount - shownCovers.length),
      key: entry.key,
      label: entry.label,
      progressPercent:
        entry.booksCount > 0 ? Math.round((entry.readCount / entry.booksCount) * 100) : 0,
      readCount: entry.readCount,
      readingQueueCount: entry.readingQueueCount,
    };
  });
}

function compareRating(a: GenreCardItem, b: GenreCardItem): number {
  if (a.averageRating === null && b.averageRating === null) return a.label.localeCompare(b.label);
  if (a.averageRating === null) return 1;
  if (b.averageRating === null) return -1;
  return b.averageRating - a.averageRating;
}

function matchesGenreFilter(item: GenreCardItem, filter: GenreFilter): boolean {
  if (filter === "unread") return item.booksCount - item.readCount > 0;
  if (filter === "in_queue") return item.readingQueueCount > 0;
  if (filter === "finished") return item.readCount > 0;
  return true;
}

const GENRE_SORT_COMPARATORS: Record<GenreSort, (a: GenreCardItem, b: GenreCardItem) => number> = {
  books_count_desc: (a, b) => b.booksCount - a.booksCount || a.label.localeCompare(b.label),
  name_asc: (a, b) => a.label.localeCompare(b.label),
  queue_count_desc: (a, b) =>
    b.readingQueueCount - a.readingQueueCount || a.label.localeCompare(b.label),
  rating_desc: compareRating,
  read_count_desc: (a, b) => b.readCount - a.readCount || a.label.localeCompare(b.label),
};
