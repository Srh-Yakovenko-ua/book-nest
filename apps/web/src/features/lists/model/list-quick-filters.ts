import type { CustomListDetail, Nullable } from "@app/shared";

import { LIST_TAB_READING_STATUSES } from "@app/shared";

import {
  ListDetailsControllerDetailBookType,
  ListDetailsControllerDetailTab,
} from "@/shared/api/generated/model";

import type { ListDetailQueryState, ListDetailStatus } from "./list-detail-query";

export const LIST_QUICK_FILTER_KEYS = [
  "all",
  "not_started",
  "reading",
  "finished",
  "favorites",
  "in_queue",
  "series",
] as const;

export type ListQuickFilterCounts = CustomListDetail["quickCounts"];

export type ListQuickFilterKey = (typeof LIST_QUICK_FILTER_KEYS)[number];

export type ListQuickFilterPatch = {
  bookType: Nullable<ListDetailQueryState["bookType"]>;
  inQueue: Nullable<boolean>;
  isFavorite: Nullable<boolean>;
  status: null;
  tab: Nullable<ListDetailQueryState["tab"]>;
};

const READING_QUICK_FILTERS = [
  ListDetailsControllerDetailTab.not_started,
  ListDetailsControllerDetailTab.reading,
  ListDetailsControllerDetailTab.finished,
] as const;

const QUICK_FILTER_CLEARED: ListQuickFilterPatch = {
  bookType: null,
  inQueue: null,
  isFavorite: null,
  status: null,
  tab: null,
};

export function activeListQuickFilter(state: ListDetailQueryState): Nullable<ListQuickFilterKey> {
  const { bookType, inQueue, isFavorite, status, tab } = state;

  const noStatus = status.length === 0;
  const noTab = tab === ListDetailsControllerDetailTab.all;
  const noFavorite = isFavorite === null;
  const noQueue = inQueue === null;
  const noType = bookType === null;

  if (noStatus && noTab && noFavorite && noQueue && noType) return "all";

  const tabOnly = noStatus && noFavorite && noQueue && noType;
  if (tabOnly && tab !== ListDetailsControllerDetailTab.all) return tab;

  const statusOnly = noTab && noFavorite && noQueue && noType;
  if (statusOnly) return readingQuickFilterOf(status);

  const favoriteOnly = noStatus && noTab && noQueue && noType;
  if (favoriteOnly && isFavorite === true) return "favorites";

  const queueOnly = noStatus && noTab && noFavorite && noType;
  if (queueOnly && inQueue === true) return "in_queue";

  const typeOnly = noStatus && noTab && noFavorite && noQueue;
  if (typeOnly && bookType === ListDetailsControllerDetailBookType.series_part) return "series";

  return null;
}

export function listDetailStatusPatch(
  status: readonly ListDetailStatus[],
): { status: ListDetailStatus[]; tab: null } | { status: null } {
  if (status.length === 0) return { status: null };
  return { status: [...status], tab: null };
}

export function listQuickFilterPatch(key: ListQuickFilterKey): ListQuickFilterPatch {
  switch (key) {
    case "all":
      return QUICK_FILTER_CLEARED;
    case "favorites":
      return { ...QUICK_FILTER_CLEARED, isFavorite: true };
    case "finished":
      return { ...QUICK_FILTER_CLEARED, tab: ListDetailsControllerDetailTab.finished };
    case "in_queue":
      return { ...QUICK_FILTER_CLEARED, inQueue: true };
    case "not_started":
      return { ...QUICK_FILTER_CLEARED, tab: ListDetailsControllerDetailTab.not_started };
    case "reading":
      return { ...QUICK_FILTER_CLEARED, tab: ListDetailsControllerDetailTab.reading };
    case "series":
      return { ...QUICK_FILTER_CLEARED, bookType: ListDetailsControllerDetailBookType.series_part };
  }
}

function readingQuickFilterOf(status: readonly ListDetailStatus[]): Nullable<ListQuickFilterKey> {
  const match = READING_QUICK_FILTERS.find((key) =>
    sameValues(status, LIST_TAB_READING_STATUSES[key] ?? []),
  );
  return match ?? null;
}

function sameValues(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((value, index) => value === sortedExpected[index]);
}
