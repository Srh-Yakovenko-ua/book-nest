import type {
  DedicationFilter,
  DedicationQuickFilterKey,
  DedicationsQuickCountsQuery,
} from "@app/shared";

import type { DedicationsFilter } from "../infrastructure/books.repository.js";

export type DedicationsBaseFilter = Omit<DedicationsFilter, "filter">;

export type DedicationsQuickCountFilters = Record<DedicationQuickFilterKey, DedicationsFilter>;

export type DedicationsQuickCountTotals = Record<DedicationQuickFilterKey, number>;

type DedicationsQuickCountsConfig = {
  readonly overlays: Readonly<Record<DedicationQuickFilterKey, DedicationFilter>>;
};

export const DEDICATIONS_QUICK_COUNTS: DedicationsQuickCountsConfig = {
  overlays: {
    all: "all",
    favorites: "favorites",
    finished: "finished",
    unfinished: "unfinished",
  },
};

export function buildDedicationsBaseFilter({
  query,
  search,
  searchGenreKeys,
  userId,
}: {
  query: Pick<DedicationsQuickCountsQuery, "genre">;
  search: string | undefined;
  searchGenreKeys: string[] | undefined;
  userId: string;
}): DedicationsBaseFilter {
  return { genreKey: query.genre, search, searchGenreKeys, userId };
}

export function buildDedicationsQuickCountFilters(
  base: DedicationsBaseFilter,
): DedicationsQuickCountFilters {
  const { overlays } = DEDICATIONS_QUICK_COUNTS;
  return {
    all: { ...base, filter: overlays.all },
    favorites: { ...base, filter: overlays.favorites },
    finished: { ...base, filter: overlays.finished },
    unfinished: { ...base, filter: overlays.unfinished },
  };
}
