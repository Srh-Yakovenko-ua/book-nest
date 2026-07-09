import type {
  BooksControllerListBookType,
  BooksControllerListOwnerItem,
  BooksControllerListStatusItem,
} from "@/shared/api/generated/model";

import type { LibraryQueryState, LibraryScope } from "./library-query";

export const LIBRARY_QUICK_FILTER_KEYS = [
  "all",
  "reading",
  "want_to_read",
  "finished",
  "favorites",
  "want_to_buy",
  "in_transit",
  "borrowed",
  "series",
  "solo",
] as const;

export type LibraryQuickFilterKey = (typeof LIBRARY_QUICK_FILTER_KEYS)[number];

const QUICK_FILTERS_OUTSIDE_MY_SCOPE: readonly LibraryQuickFilterKey[] = [
  "want_to_buy",
  "in_transit",
];

export type LibraryQuickFilterPatch = {
  bookType: BooksControllerListBookType | null;
  isFavorite: boolean | null;
  owner: BooksControllerListOwnerItem[] | null;
  status: BooksControllerListStatusItem[] | null;
};

export function quickFilterKeysForScope(scope: LibraryScope): readonly LibraryQuickFilterKey[] {
  if (scope === "all") return LIBRARY_QUICK_FILTER_KEYS;
  return LIBRARY_QUICK_FILTER_KEYS.filter((key) => !QUICK_FILTERS_OUTSIDE_MY_SCOPE.includes(key));
}

const QUICK_FILTER_CLEARED: LibraryQuickFilterPatch = {
  bookType: null,
  isFavorite: null,
  owner: null,
  status: null,
};

export function activeQuickFilter(state: LibraryQueryState): LibraryQuickFilterKey | null {
  const { bookType, isFavorite, owner, status } = state;

  const noStatus = status.length === 0;
  const noOwner = owner.length === 0;
  const noFavorite = isFavorite === null;
  const noType = bookType === null;

  if (noStatus && noOwner && noFavorite && noType) return "all";

  const statusOnly = noOwner && noFavorite && noType;
  if (statusOnly && sameValues(status, ["reading", "rereading"])) return "reading";
  if (statusOnly && sameValues(status, ["want_to_read"])) return "want_to_read";
  if (statusOnly && sameValues(status, ["finished"])) return "finished";

  if (noStatus && noOwner && noType && isFavorite === true) return "favorites";

  const ownerOnly = noStatus && noFavorite && noType;
  if (ownerOnly && sameValues(owner, ["want_to_buy"])) return "want_to_buy";
  if (ownerOnly && sameValues(owner, ["in_transit"])) return "in_transit";
  if (ownerOnly && sameValues(owner, ["borrowed_from_someone", "lent_to_someone"])) {
    return "borrowed";
  }

  const typeOnly = noStatus && noOwner && noFavorite;
  if (typeOnly && bookType === "series_part") return "series";
  if (typeOnly && bookType === "solo") return "solo";

  return null;
}

export function quickFilterPatch(key: LibraryQuickFilterKey): LibraryQuickFilterPatch {
  switch (key) {
    case "all":
      return QUICK_FILTER_CLEARED;
    case "borrowed":
      return { ...QUICK_FILTER_CLEARED, owner: ["borrowed_from_someone", "lent_to_someone"] };
    case "favorites":
      return { ...QUICK_FILTER_CLEARED, isFavorite: true };
    case "finished":
      return { ...QUICK_FILTER_CLEARED, status: ["finished"] };
    case "in_transit":
      return { ...QUICK_FILTER_CLEARED, owner: ["in_transit"] };
    case "reading":
      return { ...QUICK_FILTER_CLEARED, status: ["reading", "rereading"] };
    case "series":
      return { ...QUICK_FILTER_CLEARED, bookType: "series_part" };
    case "solo":
      return { ...QUICK_FILTER_CLEARED, bookType: "solo" };
    case "want_to_buy":
      return { ...QUICK_FILTER_CLEARED, owner: ["want_to_buy"] };
    case "want_to_read":
      return { ...QUICK_FILTER_CLEARED, status: ["want_to_read"] };
  }
}

function sameValues(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  return sortedActual.every((value, index) => value === sortedExpected[index]);
}
