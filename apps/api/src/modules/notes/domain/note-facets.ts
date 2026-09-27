import type {
  NoteAuthorFacet,
  NoteCategory,
  NoteCategoryFacet,
  NoteFilter,
  NoteQuickCounts,
  NoteValueFacet,
  Nullable,
} from "@app/shared";

import { NoteCategorySchema, NoteFilterSchema } from "@app/shared";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";

export type NoteAuthorLink = {
  author: { id: string; name: string };
  entityId: string;
};

export type NoteCategoryCount = {
  category: Nullable<string>;
  count: number;
  customCategory: Nullable<string>;
};

export type NoteCategoryDimension = {
  categories: NoteCategory[] | undefined;
  customCategories: string[] | undefined;
};

export type NoteEntityCount = {
  count: number;
  entityId: string;
  label: string;
};

export type NoteFlagGroup = NoteFlags & { count: number };

type NoteFlags = {
  isFavorite: boolean;
  isPinned: boolean;
  isSpoiler: boolean;
};

const NOTE_QUICK_FILTER_MATCHES: Record<NoteFilter, (flags: NoteFlags) => boolean> = {
  all: () => true,
  favorite: (flags) => flags.isFavorite,
  no_spoiler: (flags) => !flags.isSpoiler,
  pinned: (flags) => flags.isPinned,
  with_spoiler: (flags) => flags.isSpoiler,
};

type RankedFacet = { count: number; id: string };

export function rankEntityCounts(entityCounts: NoteEntityCount[]): NoteEntityCount[] {
  return rankFacets(
    entityCounts.map((entry) => ({ ...entry, id: entry.entityId })),
    (facet) => facet.label,
  ).map(({ count, entityId, label }) => ({ count, entityId, label }));
}

export function toAuthorFacets({
  entityCounts,
  links,
}: {
  entityCounts: NoteEntityCount[];
  links: NoteAuthorLink[];
}): NoteAuthorFacet[] {
  const countByEntity = new Map(entityCounts.map((entry) => [entry.entityId, entry.count]));
  const facetById = new Map<string, NoteAuthorFacet>();

  for (const link of links) {
    const count = countByEntity.get(link.entityId);
    if (count === undefined) {
      continue;
    }
    const existing = facetById.get(link.author.id);
    if (existing === undefined) {
      facetById.set(link.author.id, { count, id: link.author.id, name: link.author.name });
      continue;
    }
    existing.count += count;
  }

  return rankFacets([...facetById.values()], (facet) => facet.name);
}

export function toCategoryFacets(rows: NoteCategoryCount[]): {
  categories: NoteCategoryFacet[];
  customCategories: NoteValueFacet[];
} {
  const categoryCounts = new Map<NoteCategory, number>();
  const customCategoryCounts = new Map<string, number>();

  for (const row of rows) {
    const category = NoteCategorySchema.safeParse(row.category);
    if (category.success) {
      categoryCounts.set(category.data, (categoryCounts.get(category.data) ?? 0) + row.count);
    }
    if (row.customCategory !== null) {
      customCategoryCounts.set(
        row.customCategory,
        (customCategoryCounts.get(row.customCategory) ?? 0) + row.count,
      );
    }
  }

  return {
    categories: [...categoryCounts]
      .map(([category, count]) => ({ category, count, id: category }))
      .sort(compareRankedFacets((facet) => facet.category))
      .map(({ category, count }) => ({ category, count })),
    customCategories: toValueFacets(
      [...customCategoryCounts].map(([value, count]) => ({ count, value })),
    ),
  };
}

export function toNoteQuickCounts(groups: NoteFlagGroup[]): NoteQuickCounts {
  const counts: NoteQuickCounts = {
    all: 0,
    favorite: 0,
    no_spoiler: 0,
    pinned: 0,
    with_spoiler: 0,
  };
  for (const group of groups) {
    for (const filter of NoteFilterSchema.options) {
      if (NOTE_QUICK_FILTER_MATCHES[filter](group)) {
        counts[filter] += group.count;
      }
    }
  }
  return counts;
}

export function toValueFacets(rows: NoteValueFacet[]): NoteValueFacet[] {
  return rankFacets(
    rows.map((row) => ({ count: row.count, id: row.value })),
    (facet) => facet.id,
  ).map(({ count, id }) => ({ count, value: id }));
}

export function withoutCategoryDimension<TDataset extends NoteCategoryDimension>(
  dataset: TDataset,
): TDataset {
  return { ...dataset, categories: undefined, customCategories: undefined };
}

function compareRankedFacets<TFacet extends RankedFacet>(
  label: (facet: TFacet) => string,
): (left: TFacet, right: TFacet) => number {
  return (left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }

    const byLabel = UKRAINIAN_COLLATION.compare(label(left), label(right));
    if (byLabel !== 0) {
      return byLabel;
    }

    if (left.id === right.id) {
      return 0;
    }
    return left.id < right.id ? -1 : 1;
  };
}

function rankFacets<TFacet extends RankedFacet>(
  facets: TFacet[],
  label: (facet: TFacet) => string,
): TFacet[] {
  return facets.filter((facet) => facet.count > 0).sort(compareRankedFacets(label));
}
