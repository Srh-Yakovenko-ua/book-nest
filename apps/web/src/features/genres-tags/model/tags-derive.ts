import type { Nullable, TagStatsView, TagType } from "@app/shared";

import type { TagColor } from "./tag-color";

import { resolveTagColor } from "./tag-color";

export type TagCardItem = {
  booksCount: number;
  color: TagColor;
  description: Nullable<string>;
  id: string;
  name: string;
  type: TagType;
};

export type TagFilter = "all" | "unused" | TagType;

export type TagSort = "books_count_desc" | "name_asc" | "type_asc";

export const TAG_TYPES = [
  "trope",
  "atmosphere",
  "theme",
  "character",
  "format",
  "custom",
] as const satisfies readonly TagType[];

export const TAG_FILTERS = ["all", ...TAG_TYPES, "unused"] as const satisfies readonly TagFilter[];

export const TAG_SORT_OPTIONS = [
  "books_count_desc",
  "name_asc",
  "type_asc",
] as const satisfies readonly TagSort[];

export const TAG_SORT_DEFAULT: TagSort = "books_count_desc";

export const TAG_PREVIEW_LIMIT = 16;

export const TAG_POPULAR_LIMIT = 8;

export function filterTags({
  filter,
  items,
  search,
}: {
  filter: TagFilter;
  items: TagCardItem[];
  search: string;
}): TagCardItem[] {
  const normalized = search.trim().toLowerCase().replace(/\s+/g, " ");

  return items.filter((item) => {
    if (!matchesTagFilter(item, filter)) return false;
    if (normalized.length === 0) return true;
    return item.name.toLowerCase().includes(normalized);
  });
}

export function popularTags(items: TagCardItem[]): TagCardItem[] {
  return sortTags({
    items: items.filter((item) => item.booksCount > 0),
    sort: "books_count_desc",
  }).slice(0, TAG_POPULAR_LIMIT);
}

export function sortTags({ items, sort }: { items: TagCardItem[]; sort: TagSort }): TagCardItem[] {
  return [...items].sort(TAG_SORT_COMPARATORS[sort]);
}

export function toTagCards(stats: TagStatsView[]): TagCardItem[] {
  return stats.map((entry) => ({
    booksCount: entry.booksCount,
    color: resolveTagColor(entry.color),
    description: entry.description,
    id: entry.id,
    name: entry.name,
    type: entry.type,
  }));
}

function matchesTagFilter(item: TagCardItem, filter: TagFilter): boolean {
  if (filter === "all") return true;
  if (filter === "unused") return item.booksCount === 0;
  return item.type === filter;
}

const TAG_TYPE_ORDER: Record<TagType, number> = {
  atmosphere: 1,
  character: 3,
  custom: 5,
  format: 4,
  theme: 2,
  trope: 0,
};

const TAG_SORT_COMPARATORS: Record<TagSort, (a: TagCardItem, b: TagCardItem) => number> = {
  books_count_desc: (a, b) => b.booksCount - a.booksCount || a.name.localeCompare(b.name),
  name_asc: (a, b) => a.name.localeCompare(b.name),
  type_asc: (a, b) =>
    TAG_TYPE_ORDER[a.type] - TAG_TYPE_ORDER[b.type] || a.name.localeCompare(b.name),
};
